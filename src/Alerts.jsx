import { useEffect, useState } from 'react';
import AlertDetails, { AlertRecord, alertLink } from './AlertDetails.jsx';
import { liveApi } from './api.js';
import { Badge, Card, displayValue, number, Pagination, Resource, statuses, Table, useResource } from './ui.jsx';

const domains = [['network', 'هشدار شبکه'], ['system', 'هشدار سیستم‌ها'], ['web', 'هشدار وب‌سرویس‌ها']];
const states = ['open', 'acknowledged', 'resolved'];
const severities = ['critical', 'high', 'medium', 'low'];
const dateTime = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
const day = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', timeZone: 'UTC' });
function Summary({ domain }) {
  const [days, setDays] = useState(7);
  const resource = useResource('/alerts/summary', { domain, days }, 0, liveApi);
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
  const [offset, setOffset] = useState(0);
  const result = useResource('/alerts', { domain, status, limit: 10, offset }, 0, liveApi);
  const columns = [
    { key: 'title', label: 'عنوان', render: row => <><strong>{row.title}</strong>
      {row.owasp_category && <small className="row-detail" dir="ltr">OWASP {row.owasp_category}</small>}</> },
    { key: 'source', label: 'منبع', render: row => <bdi>{row.source}</bdi> },
    { key: 'severity', label: 'شدت', render: row => <Badge value={row.severity} /> },
    { key: 'status', label: 'وضعیت', render: row => <Badge value={row.status} /> },
    { key: 'created_at', label: 'زمان ثبت', render: row => dateTime.format(new Date(row.created_at)) },
    { key: 'details', label: 'جزئیات', render: row =>
      <a href={alertLink(domain, row.id)} className="button">مشاهده</a> },
  ];
  return <>
    <Summary domain={domain} />
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
    {domain === 'system' && canWrite && <CreateSystemAlert onCreated={id => {
      window.location.hash = alertLink(domain, id);
    }} />}
  </>;
}

function readAlertLocation() {
  const query = new URLSearchParams(window.location.hash.split('?')[1]);
  const selected = query.get('domain');
  return {
    domain: domains.some(([key]) => key === selected) ? selected : 'network',
    alertId: query.get('alert'), collection: query.get('collection'), recordId: query.get('record'),
  };
}

export default function Alerts({ canWrite }) {
  const [{ domain, alertId, collection, recordId }, setLocation] = useState(readAlertLocation);
  useEffect(() => {
    const update = () => setLocation(readAlertLocation());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  if (alertId && collection && recordId) {
    return <AlertRecord key={alertId + collection + recordId} domain={domain} alertId={alertId}
      collection={collection} recordId={recordId} />;
  }
  if (alertId) return <AlertDetails key={alertId} domain={domain} id={alertId} canWrite={canWrite} />;
  return <div className="stack">
    <div className="explorer-tabs" aria-label="نوع هشدار">
      {domains.map(([key, label]) => <a key={key} className="button" href={alertLink(key)}
        aria-current={domain === key ? 'page' : undefined}>{label}</a>)}
    </div>
    <AlertDomain key={domain} domain={domain} canWrite={canWrite} />
  </div>;
}
