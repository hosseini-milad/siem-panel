import { useEffect, useState } from 'react';
import { Search, Send } from 'lucide-react';
import { api, liveApi } from './api.js';
import { Badge, Card, eventColumns, logLevels, number, Pagination, Resource, statuses, Table, useResource } from './ui.jsx';

const pageSize = 10;
const initialBatch = () => JSON.stringify({
  batch_id: crypto.randomUUID(),
  events: [{
    timestamp: new Date().toISOString(), source: 'firewall-01', level: 'INFO',
    message: 'رویداد آزمایشی از پنل', attributes: {},
  }],
}, null, 2);

export function Ingestion({ canWrite }) {
  const [input, setInput] = useState(initialBatch);
  const [feedback, setFeedback] = useState({});
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const logs = useResource('/logs', { limit: 5 }, revision);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setFeedback({});
    try {
      const body = JSON.parse(input);
      const result = await api('/ingestion/batches', { method: 'POST', body });
      const batch = await api('/ingestion/batches/' + result.batch_id);
      setFeedback({ message: `${number.format(result.inserted)} ثبت، ${number.format(result.deduplicated)} تکراری`, id: batch.id });
      setRevision(value => value + 1);
    } catch (error) {
      setFeedback({ error: error instanceof SyntaxError ? 'ساختار JSON معتبر نیست.' : error.message });
    } finally {
      setPending(false);
    }
  }

  return <div className="stack">
    {canWrite && <Card title="ارسال گروه رویدادها" detail="ساختار ورودی مطابق POST /ingestion/batches">
      <form className="batch-form" onSubmit={submit}>
        <label htmlFor="batch">بدنهٔ درخواست JSON</label>
        <textarea id="batch" dir="ltr" spellCheck={false} value={input} onChange={event => setInput(event.target.value)} required />
        <div className="actions">
          <button className="primary" disabled={pending}><Send size={16} /> ارسال گروه</button>
          <button type="button" className="button" onClick={() => { setInput(initialBatch()); setFeedback({}); }} disabled={pending}>گروه نمونهٔ تازه</button>
        </div>
        {feedback.error && <p className="notice error" role="alert">{feedback.error}</p>}
        {feedback.message && <p className="notice" role="status">{feedback.message} · <bdi className="mono">{feedback.id}</bdi></p>}
      </form>
    </Card>}
    <Card title="آخرین لاگ‌ها"><Resource result={logs}>{data => <Table columns={eventColumns} rows={data.items} />}</Resource></Card>
  </div>;
}

export function Events() {
  const [query, setQuery] = useState({});
  const [offset, setOffset] = useState(0);
  const events = useResource('/search/events', { ...query, limit: pageSize, offset });
  return <Card title="رویدادها" detail="جست‌وجو در پیام یا نام منبع در ۲۴ ساعت اخیر">
    <form className="filters" onSubmit={event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      setQuery({ ...values, q: values.q.trim(), source: values.source.trim() });
      setOffset(0);
    }}>
      <label>متن جست‌وجو<input name="q" placeholder="پیام یا منبع" maxLength={1024} /></label>
      <label>منبع دقیق<input name="source" placeholder="firewall-01" maxLength={255} /></label>
      <label>سطح<select name="level"><option value="">همه</option>{logLevels.map(level => <option key={level}>{level}</option>)}</select></label>
      <button className="primary"><Search size={16} /> جست‌وجو</button>
    </form>
    <Resource result={events}>{data => <>
      <Table columns={eventColumns} rows={data.items} />
      <Pagination page={data} onOffset={setOffset} />
    </>}</Resource>
  </Card>;
}

export function Worklist({ mode, canWrite }) {
  const [revision, setRevision] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const rules = mode === 'detections';
  const alerts = mode === 'alerts';
  const path = rules ? '/detections/rules' : '/' + mode;
  const options = alerts ? ['open', 'acknowledged', 'resolved'] : ['open', 'investigating', 'contained', 'closed'];
  const result = useResource(path, { ...query, limit: pageSize, offset }, revision);
  async function change(id, body) {
    setError('');
    setPending(true);
    try {
      await api(path + '/' + id, { method: 'PATCH', body });
      setRevision(value => value + 1);
    } catch (error) {
      setError(error.message);
    } finally {
      setPending(false);
    }
  }
  const columns = [
    { key: rules ? 'name' : 'title', label: 'عنوان', render: row => <><strong>{rules ? row.name : row.title}</strong><small className="row-detail">{row.description}</small></> },
    { key: 'severity', label: 'شدت', render: row => <Badge value={row.severity} /> },
    ...(rules ? [{ key: 'threshold', label: 'آستانه', render: row => number.format(row.threshold) }] : []),
    { key: 'state', label: 'وضعیت', render: row => rules
      ? <label className="toggle"><input type="checkbox" checked={row.enabled} aria-label={`فعال بودن ${row.name}`} disabled={pending || !canWrite}
          onChange={event => change(row.id, { enabled: event.target.checked })} />{row.enabled ? 'فعال' : 'غیرفعال'}</label>
      : <select aria-label={`وضعیت ${row.title}`} value={row.status} disabled={pending || !canWrite}
          onChange={event => change(row.id, { status: event.target.value })}>
          {options.map(status => <option key={status} value={status}>{statuses[status]}</option>)}
        </select> },
  ];
  return <Card title={rules ? 'قواعد شمارشی' : alerts ? 'فهرست هشدارها' : 'پرونده‌های بررسی'}>
    {!rules && <div className="filters">
      <label>وضعیت<select value={query.status ?? ''} onChange={event => { setQuery({ status: event.target.value }); setOffset(0); }}>
        <option value="">همه</option>{options.map(key => <option key={key} value={key}>{statuses[key]}</option>)}
      </select></label>
    </div>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <Resource result={result}>{data => <>
      <Table columns={columns} rows={data.items} />
      <Pagination page={data} onOffset={setOffset} />
    </>}</Resource>
  </Card>;
}

function SystemLogDatasetImport({ canWrite }) {
  const [path, setPath] = useState('');
  const [job, setJob] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!job?.id || job.status !== 'running') return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const current = await liveApi('/system-log-datasets/imports/' + job.id);
        if (active) setJob(current);
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    };
    const timer = window.setInterval(refresh, 1500);
    refresh();
    return () => { active = false; window.clearInterval(timer); };
  }, [job?.id, job?.status]);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    setJob(null);
    try {
      setJob(await liveApi('/system-log-datasets/imports', { method: 'POST', body: { path } }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  const labels = { running: 'در حال ذخیره', completed: 'تکمیل‌شده', failed: 'ناموفق', interrupted: 'متوقف‌شده' };
  return <Card title="ورود دیتاست لاگ سیستم" detail="مسیر فایل یا پوشه روی خود سرور؛ CSV، JSON، JSONL، NDJSON، LOG، TXT و Gzip">
    {canWrite ? <form className="batch-form" onSubmit={submit}>
      <label htmlFor="system-log-dataset-path">مسیر روی سرور</label>
      <input id="system-log-dataset-path" dir="ltr" value={path} onChange={event => setPath(event.target.value)}
        placeholder="F:\PY\Server\SIEM\ds\OS\LMD-2023...\Labelled LMD-2023" maxLength={1024} required />
      <div className="actions"><button className="primary" disabled={pending || job?.status === 'running'}>
        <Send size={16} /> شروع ذخیره‌سازی
      </button></div>
    </form> : <p className="notice">برای شروع عملیات، دسترسی نوشتن بخش تحلیل هوشمند لازم است.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {job && <div className="notice" role="status">
      <strong>{labels[job.status] ?? job.status}</strong>
      {' · '}{number.format(job.processed ?? 0)} رکورد پردازش‌شده
      {' · '}{number.format(job.inserted ?? 0)} رکورد تازه
      {job.file_count != null && <> {' · '}{number.format(job.completed_files ?? 0)} از {number.format(job.file_count)} فایل</>}
      {job.error && <p className="error">{job.error}</p>}
    </div>}
  </Card>;
}

function SystemLogModelPipeline({ canWrite }) {
  const [normalization, setNormalization] = useState(null);
  const [training, setTraining] = useState(null);
  const [model, setModel] = useState(null);
  const [labels, setLabels] = useState(null);
  const [maxRecords, setMaxRecords] = useState(200000);
  const [rounds, setRounds] = useState(300);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');

  async function refreshSummary() {
    try {
      setLabels(await liveApi('/system-log-ml/labels'));
    } catch (requestError) {
      setError(requestError.message);
    }
    try {
      setModel(await liveApi('/system-log-ml/models/current'));
    } catch (requestError) {
      if (requestError.status !== 404) setError(requestError.message);
    }
  }

  useEffect(() => { refreshSummary(); }, []);

  useEffect(() => {
    const job = normalization?.status === 'running' ? normalization : training?.status === 'running' ? training : null;
    if (!job) return undefined;
    const base = job === normalization ? '/system-log-ml/normalization/runs/' : '/system-log-ml/training/runs/';
    let active = true;
    const refresh = async () => {
      try {
        const current = await liveApi(base + job.id);
        if (!active) return;
        if (job === normalization) setNormalization(current); else setTraining(current);
        if (current.status !== 'running') refreshSummary();
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    };
    const timer = window.setInterval(refresh, 2000);
    refresh();
    return () => { active = false; window.clearInterval(timer); };
  }, [normalization?.id, normalization?.status, training?.id, training?.status]);

  async function start(kind) {
    setPending(kind);
    setError('');
    try {
      if (kind === 'normalization') {
        setNormalization(await liveApi('/system-log-ml/normalization/runs', { method: 'POST' }));
      } else {
        setTraining(await liveApi('/system-log-ml/training/runs', {
          method: 'POST', body: { max_records: Number(maxRecords), rounds: Number(rounds), random_seed: 42 },
        }));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending('');
    }
  }

  const running = normalization?.status === 'running' || training?.status === 'running';
  const metrics = model?.evaluation?.ensemble;
  return <Card title="مدل تشخیص Label لاگ سیستم" detail="نرمال‌سازی Sysmon، آموزش LightGBM + CatBoost و ارزیابی روی دادهٔ test مستقل">
    {canWrite && <div className="stack">
      <div className="actions">
        <button className="primary" type="button" disabled={pending || running} onClick={() => start('normalization')}>
          نرمال‌سازی دیتاست
        </button>
        <label>حداکثر نمونه آموزش<input type="number" min="100" max="1000000" value={maxRecords}
          onChange={event => setMaxRecords(event.target.value)} /></label>
        <label>تعداد دور<input type="number" min="10" max="2000" value={rounds}
          onChange={event => setRounds(event.target.value)} /></label>
        <button className="primary" type="button" disabled={pending || running} onClick={() => start('training')}>
          آموزش و ارزیابی
        </button>
      </div>
    </div>}
    {!canWrite && <p className="notice">برای اجرای نرمال‌سازی و آموزش، دسترسی نوشتن تحلیل هوشمند لازم است.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {normalization && <p className="notice" role="status">نرمال‌سازی: {normalization.status}
      {' · '}{number.format(normalization.processed ?? 0)} ثبت
      {' · '}{number.format(normalization.skipped ?? 0)} موجود
      {' · '}{number.format(normalization.failed ?? 0)} نامعتبر</p>}
    {training && <p className="notice" role="status">آموزش: {training.status}
      {training.phase && <> {' · '}{training.phase}</>}
      {training.sampled != null && <> {' · '}{number.format(training.sampled)} نمونه</>}
      {training.error && <> {' · '}{training.error}</>}</p>}
    {labels && <p className="notice">توزیع Labelها: {Object.entries(labels.counts).map(([label, count]) =>
      <span key={label}> <bdi className="mono">{label}: {number.format(count)}</bdi></span>)}</p>}
    {model && <div className="detail-grid">
      <div><strong>مدل فعال</strong><p className="notice"><bdi className="mono">{model.algorithm}</bdi></p></div>
      <div><strong>ارزیابی Ensemble</strong><p className="notice">
        Accuracy: {number.format((metrics?.accuracy ?? 0) * 100)}٪ · F1 Macro: {number.format((metrics?.f1_macro ?? 0) * 100)}٪
      </p></div>
      <div><strong>Labelها</strong><p className="notice"><bdi className="mono">{model.labels.join(' · ')}</bdi></p></div>
      <div><strong>ویژگی‌های مهم</strong><p className="notice"><bdi className="mono">
        {model.feature_weights.slice(0, 5).map(item => item.feature).join(' · ')}
      </bdi></p></div>
    </div>}
  </Card>;
}

export function Analytics({ showCurrentModel, canWrite }) {
  const folders = useResource('/datasets/folders');
  const normalized = useResource('/normalization/records', { limit: 1 });
  const standardized = useResource('/standardization/records', { limit: 1 });
  const status = useResource('/system/status');
  return <div className="stack">
    <SystemLogDatasetImport canWrite={canWrite} />
    <SystemLogModelPipeline canWrite={canWrite} />
    <div className="detail-grid">
    <Card title="دیتاست‌ها"><Resource result={folders}>{data => data.folders.length
      ? <ul className="detail-list">{data.folders.map(folder => <li key={folder}><bdi className="mono">{folder}</bdi></li>)}</ul>
      : <p className="notice">پوشه‌ای یافت نشد.</p>}</Resource></Card>
    <Card title="نرمال‌سازی"><Resource result={normalized}>{data => <p className="notice">{number.format(data.total)} رکورد نرمال‌شده</p>}</Resource></Card>
    <Card title="استانداردسازی"><Resource result={standardized}>{data => <p className="notice">{number.format(data.total)} رکورد استاندارد</p>}</Resource></Card>
    <Card title="یادگیری ماشین" detail="LightGBM · CatBoost"
      action={showCurrentModel && <a className="button" href="#current-model">مدل جاری</a>}><Resource result={status}>{data => <p className="notice">
      <Badge tone={data.machine_learning.available ? 'green' : 'amber'}>{data.machine_learning.available ? 'مدل آماده' : 'مدل هنوز آماده نیست'}</Badge>
    </p>}</Resource></Card>
    </div>
  </div>;
}

const settingsLabels = {
  mongodb_database: 'نام پایگاه داده', mongodb_server_selection_timeout_ms: 'مهلت انتخاب سرور (ms)',
  mongodb_connect_timeout_ms: 'مهلت اتصال (ms)', mongodb_socket_timeout_ms: 'مهلت سوکت (ms)',
  datasets_root: 'مسیر دیتاست‌ها', system_log_datasets_root: 'ریشهٔ دیتاست لاگ سیستم',
  ml_model_dir: 'مسیر مدل', ml_threads: 'رشته‌های پردازش مدل',
};
export function System() {
  const settings = useResource('/system/settings');
  const status = useResource('/system/status');
  const health = useResource('/health');
  return <div className="detail-grid">
    <Card title="سلامت مؤلفه‌ها">
      <Resource result={status}>{data => <ul className="detail-list">
        <li><span>MongoDB</span><Badge tone={data.mongodb.available ? 'green' : 'red'}>{data.mongodb.available ? 'در دسترس' : 'قطع'}</Badge></li>
        <li><span>مدل یادگیری ماشین</span><Badge tone={data.machine_learning.available ? 'green' : 'amber'}>
          {data.machine_learning.available ? 'آماده' : 'آماده نیست'}</Badge></li>
      </ul>}</Resource>
      <Resource result={health}>{data => <p className="notice"><bdi className="mono">GET /health · {data.status}</bdi></p>}</Resource>
    </Card>
    <Card title="تنظیمات سامانه" detail="تنظیمات غیرمحرمانهٔ سرویس">
      <Resource result={settings}>{data => <dl className="detail-list">{Object.entries(settingsLabels).map(([key, label]) => <div key={key}>
        <dt>{label}</dt><dd><bdi className="mono">{data[key]}</bdi></dd>
      </div>)}</dl>}</Resource>
    </Card>
  </div>;
}
