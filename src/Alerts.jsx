import { useState } from 'react';
import { liveApi } from './api.js';
import { Badge, Card, displayValue, number, Pagination, Resource, statuses, Table, useResource } from './ui.jsx';

const domains = [['network', 'هشدار شبکه'], ['system', 'هشدار سیستم‌ها'], ['web', 'هشدار وب‌سرویس‌ها']];
const states = ['open', 'acknowledged', 'resolved'];
const severities = ['critical', 'high', 'medium', 'low'];
const dateTime = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
const day = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const collections = {
  log_events: 'رویداد خام', dataset_records: 'رکورد خام شبکه', standard_records: 'رکورد استاندارد شبکه',
  'web-records': 'درخواست وب',
  ml_predictions: 'پیش‌بینی شبکه', agent_logs: 'لاگ خام سیستم', agent_logs_label: 'لاگ استاندارد و برچسب‌خورده',
};

function Summary({ domain, revision }) {
  const [days, setDays] = useState(7);
  const resource = useResource('/alerts/summary', { domain, days }, revision, liveApi);
  return <Card title="روند و شدت هشدارها" detail="تعداد هشدارهای ایجادشده بر اساس روز UTC"
    action={<select aria-label="بازهٔ نمودار" value={days} onChange={event => setDays(Number(event.target.value))}>
      <option value="7">۷ روز</option><option value="30">۳۰ روز</option>
    </select>}>
    <Resource result={resource}>{data => {
      const peak = Math.max(1, ...data.series.map(row => row.count));
      return <div className="chart-grid">
        <div className="alert-chart" dir="ltr" aria-label="نمودار تعداد هشدار روزانه">
          {data.series.map(({ day: date, count }) => {
            const caption = `${day.format(new Date(date))} · ${number.format(count)}`;
            return <div key={date} title={caption} aria-label={caption}>
              <span style={{ height: `${count ? Math.max(2, count / peak * 100) : 0}%` }} />
            </div>;
          })}
        </div>
        <ul className="detail-list">{severities.map(key => <li key={key}>
          <Badge value={key} /><strong>{number.format(data.severities[key])}</strong>
        </li>)}</ul>
      </div>;
    }}</Resource>
  </Card>;
}

function AlertDetails({ id, onClose, canWrite, onChange }) {
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const path = '/alerts/' + id;
  const alert = useResource(path, {}, revision, liveApi);
  const evidence = useResource(path + '/evidence', {}, 0, liveApi);

  async function change(status) {
    setBusy(true);
    setError('');
    try {
      await liveApi(path, { method: 'PATCH', body: { status } });
      setRevision(value => value + 1);
      onChange();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <Card title="جزئیات هشدار" action={<button type="button" className="button" onClick={onClose}>بستن</button>}>
    <Resource result={alert}>{data => <>
      <h3>{data.title}</h3>
      <p>{data.description}</p>
      <div className="actions">
        <Badge value={data.severity} /><Badge value={data.status} />
        <bdi>{data.source}</bdi><time>{dateTime.format(new Date(data.created_at))}</time>
        {canWrite && <select value={data.status} aria-label="تغییر وضعیت" disabled={busy}
          onChange={event => change(event.target.value)}>
          {states.map(state => <option key={state} value={state}>{statuses[state]}</option>)}
        </select>}
      </div>
      {error && <p className="notice error" role="alert">{error}</p>}
      <h3>زنجیرهٔ شواهد</h3>
      {data.evidence && <details><summary>فرادادهٔ تشخیص</summary>
        <pre dir="ltr">{JSON.stringify(data.evidence, null, 2)}</pre>
      </details>}
      <Resource result={evidence}>{result => result.items.length ? result.items.map(item =>
        <details key={item.collection + ':' + item.id} className="alert-evidence">
          <summary>{collections[item.collection]} · <bdi className="mono">{item.id}</bdi></summary>
          {item.record ? <pre dir="ltr" tabIndex={0}>{JSON.stringify(item.record, null, 2)}</pre>
            : <p className="notice">رکورد منبع دیگر در دسترس نیست.</p>}
        </details>) : <p className="notice">شواهد پیوندخورده‌ای برای این هشدار ثبت نشده است.</p>}</Resource>
    </>}</Resource>
  </Card>;
}

function CreateSystemAlert({ onCreated }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      const alert = await liveApi('/alerts/from-system-log', {
        method: 'POST', body: Object.fromEntries(new FormData(form)),
      });
      form.reset();
      onCreated(alert.id);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return <Card title="ثبت هشدار از لاگ سیستم" detail="شناسهٔ رکورد را از جزئیات تب داده‌های سیستم‌ها بردارید.">
    <form className="filters" onSubmit={submit}>
      <label>شناسهٔ لاگ<input name="log_id" dir="ltr" pattern="[a-f0-9]{64}" maxLength={64} required /></label>
      <label>عنوان<input name="title" maxLength={200} required /></label>
      <label>شرح<input name="description" maxLength={4000} required /></label>
      <label>شدت<select name="severity" defaultValue="medium">
        {severities.map(key => <option key={key} value={key}>{displayValue(key)}</option>)}
      </select></label>
      <button type="submit" className="primary" disabled={busy}>ثبت هشدار</button>
    </form>
    {error && <p className="notice error" role="alert">{error}</p>}
  </Card>;
}

function AlertDomain({ domain, canWrite }) {
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const result = useResource('/alerts', { domain, status, limit: 10, offset }, revision, liveApi);
  const refresh = () => setRevision(value => value + 1);
  const columns = [
    { key: 'title', label: 'عنوان', render: row => <strong>{row.title}</strong> },
    { key: 'source', label: 'منبع', render: row => <bdi>{row.source}</bdi> },
    { key: 'severity', label: 'شدت', render: row => <Badge value={row.severity} /> },
    { key: 'status', label: 'وضعیت', render: row => <Badge value={row.status} /> },
    { key: 'created_at', label: 'زمان ثبت', render: row => dateTime.format(new Date(row.created_at)) },
    { key: 'details', label: 'جزئیات', render: row =>
      <button type="button" className="button" onClick={() => setSelected(row.id)}>مشاهده</button> },
  ];
  return <>
    <Summary domain={domain} revision={revision} />
    <Card title="آخرین هشدارها" action={<select aria-label="فیلتر وضعیت هشدار" value={status}
      onChange={event => { setStatus(event.target.value); setOffset(0); }}>
      <option value="">همهٔ وضعیت‌ها</option>
      {states.map(state => <option key={state} value={state}>{statuses[state]}</option>)}
    </select>}>
      <Resource result={result}>{data => <>
        <Table columns={columns} rows={data.items} empty="هشداری با این فیلتر ثبت نشده است." />
        <Pagination page={data} onOffset={setOffset} />
      </>}</Resource>
    </Card>
    {selected && <AlertDetails key={selected} id={selected} canWrite={canWrite} onChange={refresh}
      onClose={() => setSelected(null)} />}
    {domain === 'system' && canWrite && <CreateSystemAlert onCreated={id => {
      setSelected(id);
      setOffset(0);
      setStatus('');
      refresh();
    }} />}
  </>;
}

export default function Alerts({ canWrite }) {
  const [domain, setDomain] = useState('network');
  return <div className="stack">
    <div className="explorer-tabs" aria-label="نوع هشدار">
      {domains.map(([key, label]) => <button key={key} className="button" type="button"
        aria-pressed={domain === key} onClick={() => setDomain(key)}>{label}</button>)}
    </div>
    <AlertDomain key={domain} domain={domain} canWrite={canWrite} />
  </div>;
}
