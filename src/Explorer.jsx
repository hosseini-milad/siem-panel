import { useEffect, useRef, useState } from 'react';
import { CalendarDays, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { explorerApi } from './api.js';
import Correlation from './Correlation.jsx';
import { today } from './explorerMock.js';
import { Badge, Card, logLevels, number, Pagination, Resource, Table, useResource } from './ui.jsx';

const pageSize = 15;
const timestamp = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'medium' });
const percent = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 4 });
const dateRange = value => {
  if (!value) return {};
  const start = new Date(value + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
};

function Risk({ value }) {
  if (!value) return <span className="muted">نهایی نشده</span>;
  return <span className="risk"><Badge value={value.severity} tone={value.severity === 'attack' ? 'red' : value.severity === 'benign' ? 'green' : undefined}>
    {value.severity === 'attack' ? 'حمله' : value.severity === 'benign' ? 'بی‌خطر' : undefined}
  </Badge> {percent.format(value.score)}</span>;
}

const columns = [
  { key: 'timestamp', label: 'زمان', render: row => row.timestamp ? <time dateTime={row.timestamp}>{timestamp.format(new Date(row.timestamp))}</time> : 'نامشخص' },
  { key: 'source_ip', label: 'IP مبدأ', render: row => <bdi className="mono">{row.source_ip ?? '—'}</bdi> },
  { key: 'destination_ip', label: 'IP مقصد', render: row => <bdi className="mono">{row.destination_ip ?? '—'}</bdi> },
  { key: 'destination_port', label: 'پورت مقصد', render: row => row.destination_port ?? '—' },
  { key: 'protocol', label: 'پروتکل', render: row => row.protocol ?? '—' },
  { key: 'risk', label: 'مخاطره', render: row => <Risk value={row.risk} /> },
];

const systemColumns = [
  columns[0],
  { key: 'agent_id', label: 'شناسهٔ سیستم', render: row => <bdi>{row.agent_id}</bdi> },
  { key: 'event_id', label: 'شناسهٔ رخداد', render: row => row.event_id ?? '—' },
  { key: 'predicted_label', label: 'برچسب مدل', render: row => <Badge value={row.predicted_label} /> },
  { key: 'prediction_confidence', label: 'اطمینان مدل', render: row =>
    row.prediction_confidence == null ? '—' : percent.format(row.prediction_confidence) },
];

const webColumns = [
  columns[0],
  { key: 'service', label: 'وب‌سرویس' },
  { key: 'method', label: 'متد' },
  { key: 'route', label: 'مسیر URL', render: row => <bdi className="mono">{row.route}</bdi> },
  { key: 'status', label: 'کد HTTP', render: row =>
    <Badge tone={row.status >= 500 ? 'red' : row.status >= 400 ? 'amber' : 'green'}>{row.status}</Badge> },
  { key: 'duration_ms', label: 'زمان پاسخ (ms)', render: row => number.format(row.duration_ms) },
  { key: 'response_bytes', label: 'حجم پاسخ (بایت)', render: row => number.format(row.response_bytes) },
  columns[1],
];

function WebDetails({ row }) {
  const url = row.url_scheme && row.url_host && row.route?.startsWith('/')
    ? `${row.url_scheme}://${row.url_host}${row.route}` : row.route;
  return <>
    <dl className="detail-list">
      <div><dt>شناسهٔ درخواست</dt><dd><bdi className="mono">{row.request_id}</bdi></dd></div>
      <div><dt>آدرس و متد</dt><dd><bdi className="mono">{row.method} {url}</bdi></dd></div>
      <div><dt>حجم درخواست</dt><dd>{number.format(row.request_bytes)} بایت</dd></div>
      <div><dt>حجم پاسخ</dt><dd>{number.format(row.response_bytes)} بایت</dd></div>
      <div><dt>رویداد امنیتی</dt><dd><bdi>{row.security_event ?? '—'}</bdi></dd></div>
    </dl>
    {[
      ['درخواست', row.request_headers, row.request_body_fields],
      ['پاسخ', row.response_headers, row.response_body_fields],
    ].map(([title, headers, fields]) => <section key={title}>
      <h3>هدرهای مجاز و نام فیلدهای JSON {title}</h3>
      <pre dir="ltr">{JSON.stringify({ headers: headers ?? {}, body_fields: fields ?? [] }, null, 2)}</pre>
    </section>)}
  </>;
}

const webMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT', 'OTHER'];

function WebFilters() {
  return <fieldset className="advanced-filters">
    <label>وب‌سرویس<input name="service" maxLength={64} dir="ltr" /></label>
    <label>شناسهٔ درخواست<input name="request_id" maxLength={80} dir="ltr" /></label>
    <label>ابتدای مسیر URL<input name="route" maxLength={200} dir="ltr" placeholder="/api/v1/" /></label>
    <label>متد<select name="method"><option value="">همه</option>
      {webMethods.map(method => <option key={method}>{method}</option>)}
    </select></label>
    <label>کد پاسخ<input name="status" type="number" min="100" max="599" dir="ltr" /></label>
    <label>IP مبدأ<input name="source_ip" maxLength={45} dir="ltr" /></label>
    <label>حداقل زمان پاسخ (ms)<input name="min_duration_ms" type="number" min="0" step="any" dir="ltr" /></label>
    <label>حداقل حجم پاسخ (بایت)<input name="min_response_bytes" type="number" min="0" max="1000000000" dir="ltr" /></label>
  </fieldset>;
}

function RecordDetails({ row, system, web, onClose }) {
  const dialog = useRef();
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  return <dialog ref={dialog} className="record-dialog" onClose={onClose} aria-labelledby="record-title">
    <header className="card-header">
      <div><h2 id="record-title">جزئیات رکورد</h2><p>{(web ? row.service : system ? row.agent_id : row.message)} · <bdi>{row.id}</bdi></p></div>
      <button className="icon-button" type="button" onClick={() => dialog.current.close()} aria-label="بستن جزئیات"><X size={18} /></button>
    </header>
    {web ? <WebDetails row={row} /> : system ? <>
      <div className="record-risk"><span>برچسب مدل</span><Badge value={row.predicted_label} /></div>
      <section><h3>اطلاعات خام</h3><pre dir="ltr">{JSON.stringify(row.raw, null, 2)}</pre></section>
      <section><h3>ویژگی‌های استانداردشده</h3><pre dir="ltr">{JSON.stringify(row.features, null, 2)}</pre></section>
      <section><h3>نتیجهٔ پیش‌بینی</h3><pre dir="ltr">{JSON.stringify({
        model_id: row.model_id, normalization_version: row.normalization_version,
        prediction_confidence: row.prediction_confidence, label_probabilities: row.label_probabilities,
      }, null, 2)}</pre></section>
    </> : <>
    <div className="record-risk"><span>برچسب نهایی</span><Risk value={row.risk} />{row.level && <Badge value={row.level} />}</div>
    <section><h3>اطلاعات کامل خام</h3><pre dir="ltr">{JSON.stringify(row.raw, null, 2)}</pre></section>
    <section><h3>اطلاعات نرمال‌شده</h3>{row.normalized
      ? <pre dir="ltr">{JSON.stringify(row.normalized, null, 2)}</pre>
      : <p className="muted">برای این رکورد دادهٔ نرمال‌شده موجود نیست.</p>}</section>
    <section><h3>اطلاعات استانداردشده</h3>{row.standardized
      ? <pre dir="ltr">{JSON.stringify(row.standardized, null, 2)}</pre>
      : <p className="muted">رکورد استانداردشدهٔ متناظر موجود نیست.</p>}</section>
    </>}
  </dialog>;
}

export default function Explorer() {
  const [kind, setKind] = useState('data');
  const [date, setDate] = useState(today);
  const [advanced, setAdvanced] = useState(false);
  const [filters, setFilters] = useState({});
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  const system = kind === 'systems';
  const web = kind === 'web';
  const path = web ? '/explorer/web-records' : system ? '/explorer/system-records' : '/explorer/records';
  const result = useResource(path,
    { ...(system || web ? {} : { kind }), ...dateRange(date), ...filters, limit: pageSize, offset }, revision, explorerApi);

  function toggleAdvanced() {
    if (advanced) setFilters(({ q }) => ({ q }));
    setAdvanced(!advanced);
    setOffset(0);
  }

  function submit(event) {
    event.preventDefault();
    setFilters(Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, value.trim()])));
    setOffset(0);
  }

  const tableColumns = [
    ...(kind === 'logs' ? [
      { key: 'message', label: 'پیام لاگ', render: row => <bdi className="log-message">{row.message}</bdi> },
      { key: 'level', label: 'سطح', render: row => <Badge value={row.level} /> },
    ] : []),
    ...(web ? webColumns : system ? systemColumns : columns),
    { key: 'details', label: 'جزئیات', render: row =>
      <button type="button" className="button" onClick={() => setSelected(row)}>مشاهده</button> },
  ];

  return <div className="stack"><Card title="داده‌ها و لاگ‌ها" detail={web ? "درخواست‌های منتخب وب‌سرویس‌ها با نگهداری ۷ روزه" : system ? "لاگ‌های سیستم برچسب‌خورده در روز انتخابی" : "روز بر اساس منطقهٔ زمانی مرورگر است. فیلترها حداکثر روی ۱۰۰۰ رکورد از بازهٔ انتخابی اعمال می‌شوند."}>
    <div className="explorer-toolbar">
      <div className="explorer-tabs" aria-label="نوع رکورد">
        {[['data', 'داده‌های شبکه'], ['systems', 'داده‌های سیستم‌ها'], ['web', 'وب‌سرویس‌ها'], ['logs', 'لاگ‌ها']].map(([key, label]) =>
          <button key={key} type="button" className="button" aria-pressed={kind === key} onClick={() => {
            setKind(key);
            setFilters({});
            setSelected(null);
            setAdvanced(false);
            setOffset(0);
          }}>{label}</button>,
        )}
      </div>
      <label className="explorer-date"><CalendarDays size={17} /> روز
        <input type="date" aria-label="روز" dir="ltr" value={date} onChange={event => { setDate(event.target.value); setOffset(0); }} />
      </label>
      <button type="button" className="button" onClick={() => { setDate(''); setOffset(0); }}>همهٔ روزها</button>
      {kind !== 'data' && <button type="button" className="button" onClick={() => setRevision(value => value + 1)}>
        <RefreshCw size={16} /> به‌روزرسانی لاگ‌ها
      </button>}
    </div>
    <form key={kind} className="explorer-form" onSubmit={submit} onReset={() => { setFilters({}); setOffset(0); }}>
      {web && <WebFilters />}
      <div className="explorer-search">
        {!web && <label>جست‌وجوی ساده<input name="q" type="search" placeholder={system ? "شناسهٔ دقیق سیستم یا رکورد" : "IP، پورت، شناسه یا متن پیام"} maxLength={system ? 255 : 1024} /></label>}
        {!web && <button className="button" type="button" aria-expanded={advanced} onClick={toggleAdvanced}>
          <SlidersHorizontal size={16} /> فیلتر پیشرفته
        </button>}
        <button type="submit" className="primary"><Search size={16} /> جست‌وجو</button>
        <button type="reset" className="button">پاک کردن فیلترها</button>
      </div>
      {advanced && system && <fieldset className="advanced-filters">
        <label>برچسب مدل<input name="label" maxLength={64} dir="ltr" /></label>
      </fieldset>}
      {advanced && !system && <fieldset className="advanced-filters">
        <legend>همهٔ فیلدهای تکمیل‌شده باید با رکورد مطابقت داشته باشند</legend>
        <label>IP کاربر (مبدأ)<input name="source_ip" dir="ltr" maxLength={45} placeholder="192.0.2.10" /></label>
        <label>IP مقصد<input name="destination_ip" dir="ltr" maxLength={45} placeholder="198.51.100.20" /></label>
        <label>پورت مبدأ<input type="number" name="source_port" min="0" max="65535" dir="ltr" /></label>
        <label>پورت مقصد<input type="number" name="destination_port" min="0" max="65535" dir="ltr" /></label>
        <label>پروتکل<select name="protocol"><option value="">همه</option><option>TCP</option><option>UDP</option><option>ICMP</option></select></label>
        <label>مخاطره<select name="risk"><option value="">همه</option><option value="attack">حمله</option><option value="critical">بحرانی</option>
          <option value="high">زیاد</option><option value="medium">متوسط</option><option value="low">کم</option>
          <option value="benign">بی‌خطر</option><option value="unscored">نهایی نشده</option></select></label>
        {kind === 'logs' && <label>سطح لاگ<select name="level"><option value="">همه</option>
          {logLevels.map(level => <option key={level}>{level}</option>)}</select></label>}
      </fieldset>}
    </form>
    <Resource result={result}>{data => <>
      <Table columns={tableColumns} rows={data.items} empty="در این بازه رکوردی با فیلترهای انتخابی یافت نشد." />
      <Pagination page={data} onOffset={setOffset} />
    </>}</Resource>
    {selected && <RecordDetails key={selected.id} row={selected} system={system} web={web} onClose={() => setSelected(null)} />}
  </Card><Correlation /></div>;
}
