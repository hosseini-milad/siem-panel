import { useEffect, useState } from 'react';
import { Search, Send } from 'lucide-react';
import { api, liveApi } from './api.js';
import { Badge, Card, eventColumns, logLevels, number, Pagination, Resource, Table, useResource } from './ui.jsx';

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
const pipelineFields = {
  network: [
    ['dataset_records', 'رکوردهای دیتاست شبکه'],
    ['standardized_records', 'رکوردهای استانداردشده'],
    ['predictions', 'پیش‌بینی‌های ذخیره‌شده'],
  ],
  system: [
    ['registered_systems', 'سیستم‌های شناسایی‌شده'],
    ['agent_logs', 'لاگ‌های خام Agent'],
    ['labeled_logs', 'لاگ‌های برچسب‌خورده'],
  ],
};

const previews = [
  ['سلامت اتصال‌دهنده‌ها', 'پایش تازگی دریافت و وضعیت کانال‌های ورودی', [
    ['Sysmon · ایستگاه‌ها', 'دریافت برقرار', '۲ دقیقه پیش'],
    ['Syslog · فایروال', 'تأخیر در دریافت', '۱۸ دقیقه پیش'],
  ]],
  ['پوشش تشخیص MITRE ATT&CK', 'نمایش نگاشت قواعد تشخیص به تکنیک‌ها', [
    ['T1059 · اجرای مفسر فرمان', 'دارای قاعده', '۲ قاعده'],
    ['T1547 · اجرای خودکار در شروع', 'نیازمند پوشش', '۰ قاعده'],
  ]],
  ['فهرست‌های پایش', 'غنی‌سازی رویدادها با زمینهٔ دارایی و حساب', [
    ['دارایی‌های حیاتی', 'فهرست IP و میزبان', '۱۲ مدخل'],
    ['حساب‌های سرویس', 'فهرست شناسه‌های حساب', '۳ مدخل'],
  ]],
  ['گردش‌کار پاسخ', 'نمونهٔ هماهنگی اقدامات تیم عملیات', [
    ['هشدار بحرانی', 'تخصیص به تحلیلگر و اطلاع‌رسانی', 'پیش‌نویس'],
    ['هشدار تکراری', 'افزودن یادداشت به پرونده', 'پیش‌نویس'],
  ]],
];

function SystemPreviews() {
  return <div className="detail-grid">{previews.map(([title, detail, rows]) =>
    <Card key={title} title={title} detail={detail} action={<Badge>نمونه</Badge>}>
      <Table columns={[
        { key: 'name', label: 'مورد' }, { key: 'state', label: 'وضعیت یا اقدام' }, { key: 'value', label: 'شاخص' },
      ]} rows={rows.map(([name, state, value]) => ({ id: name, name, state, value }))} />
    </Card>)}</div>;
}

export function System() {
  const [domain, setDomain] = useState('network');
  const settings = useResource('/system/settings', {}, 0, liveApi);
  const pipelines = useResource('/system/pipelines', {}, 0, liveApi);
  const tabs = [['network', 'سامانهٔ شبکه'], ['system', 'سامانهٔ سیستم‌ها'], ['preview', 'قابلیت‌های نمونهٔ SIEM']];
  return <div className="stack">
    <div className="explorer-tabs" aria-label="بخش سامانه">
      {tabs.map(([key, label]) => <button key={key} className="button" type="button"
        aria-pressed={domain === key} onClick={() => setDomain(key)}>{label}</button>)}
    </div>
    {domain === 'preview' ? <SystemPreviews /> : <div className="detail-grid">
      <Card title="سلامت و پردازش داده" detail="آمار فعلی ذخیره‌سازی براساس شمارش تقریبی MongoDB">
        <Resource result={pipelines}>{data => {
          const pipeline = data[domain];
          return <dl className="detail-list">
            <div><dt>MongoDB</dt><dd><Badge tone={data.database_available ? 'green' : 'red'}>
              {data.database_available ? 'در دسترس' : 'قطع'}
            </Badge></dd></div>
            <div><dt>مدل تشخیص</dt><dd><Badge tone={pipeline.model_ready ? 'green' : 'amber'}>
              {pipeline.model_ready ? 'آماده' : 'آماده نیست'}
            </Badge></dd></div>
            {pipelineFields[domain].map(([key, label]) => <div key={key}>
              <dt>{label}</dt><dd>{number.format(pipeline[key])}</dd>
            </div>)}
            <div><dt>{domain === 'network' ? 'آخرین دریافت در مخزن رویدادها' : 'آخرین دریافت از Agent'}</dt>
              <dd>{pipeline.last_received_at ? new Date(pipeline.last_received_at).toLocaleString('fa-IR') : 'هنوز داده‌ای دریافت نشده'}</dd></div>
            <div><dt>نگهداری لاگ عملیاتی</dt><dd>{number.format(data.retention_days)} روز</dd></div>
          </dl>;
        }}</Resource>
      </Card>
      <Card title="تنظیمات سامانه" detail="تنظیمات غیرمحرمانهٔ سرویس">
        <Resource result={settings}>{data => <dl className="detail-list">
          {Object.entries(settingsLabels).filter(([key]) => key !== (domain === 'network' ? 'system_log_datasets_root' : 'datasets_root'))
            .map(([key, label]) => <div key={key}>
              <dt>{label}</dt><dd><bdi className="mono">{data[key] ?? '—'}</bdi></dd>
            </div>)}
        </dl>}</Resource>
      </Card>
    </div>}
  </div>;
}
