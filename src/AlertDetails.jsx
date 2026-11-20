import { useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpLeft, BellRing, Clock3, Fingerprint, Globe2, Network, Server, ShieldCheck,
} from 'lucide-react';
import { liveApi } from './api.js';
import { Badge, Card, number, Resource, statuses, useResource } from './ui.jsx';

const states = ['open', 'acknowledged', 'resolved'];
const dateTime = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'medium' });
const collections = {
  log_events: ['رویداد خام', Network],
  dataset_records: ['رکورد خام شبکه', Network],
  standard_records: ['رکورد استاندارد شبکه', Network],
  'web-records': ['درخواست وب', Globe2],
  web_security_signals: ['سیگنال امنیتی', ShieldCheck],
  web_service_batches: ['دستهٔ جمع‌آوری', Server],
  ml_predictions: ['پیش‌بینی شبکه', Activity],
  agent_logs: ['لاگ خام سیستم', Server],
  agent_logs_label: ['لاگ برچسب‌خوردهٔ سیستم', Server],
};
const ruleTitles = {
  login_failure: 'خطای مکرر احراز هویت در وب‌سرویس',
  access_denied: 'رد مکرر دسترسی به وب‌سرویس',
  server_error: 'افزایش خطاهای وب‌سرویس',
  logon_failure: 'ورود ناموفق مکرر به ویندوز',
  account_lockout: 'قفل حساب ویندوز',
  audit_log_cleared: 'پاک‌شدن لاگ امنیتی ویندوز',
  audit_policy_changed: 'تغییر سیاست ممیزی ویندوز',
  service_installed: 'نصب سرویس در ویندوز',
};

export function alertLink(domain, alertId, item) {
  const query = new URLSearchParams({ domain });
  if (alertId) query.set('alert', alertId);
  if (item) {
    query.set('collection', item.collection);
    query.set('record', item.id);
  }
  return '#alerts?' + query;
}

const field = (...values) => values.find(value =>
  (typeof value === 'string' && value.trim() && value !== '-') ||
  (typeof value === 'number' && Number.isFinite(value)));

function formatTime(value) {
  const timestamp = new Date(value);
  return value && Number.isFinite(timestamp.valueOf()) ? dateTime.format(timestamp) : '—';
}

function metadata(item) {
  const { collection, record } = item;
  const [label, Icon] = collections[collection] ?? [collection, Activity];
  const timestamp = field(record?.timestamp, record?.predicted_at, record?.interval_end, record?.received_at);
  const isAgent = collection === 'agent_logs' || collection === 'agent_logs_label';
  const origin = isAgent
    ? field(record?.IpAddress, record?.ipAddress, record?.event_data?.IpAddress, record?.event_data_IpAddress)
    : field(record?.source_ip, record?.attributes?.source_ip, record?.['Src IP'], record?.['Source IP']);
  const endpoint = collection === 'web-records' ? [record?.method, record?.route].filter(Boolean).join(' ') : null;
  const source = field(record?.service, record?.computer, record?.agent_id, record?.source);
  const eventId = field(record?.event_id, record?.EventID);
  const summary = field(endpoint, record?.signal, record?.message, eventId == null ? null : `Event ${eventId}`, source);
  return { label, Icon, timestamp, origin, summary, source, status: field(record?.status, record?.level), eventId };
}

function BackLink({ href, children }) {
  return <a href={href} className="button alert-back"><ArrowRight size={16} aria-hidden="true" />{children}</a>;
}

function MetaItem({ icon: Icon, label, children }) {
  return <div className="alert-meta-item">
    <dt><Icon size={16} aria-hidden="true" />{label}</dt>
    <dd>{children}</dd>
  </div>;
}

function EvidenceList({ domain, alertId, items }) {
  if (!items.length) return <p className="notice">شواهد پیوندخورده‌ای برای این هشدار ثبت نشده است.</p>;
  return <ol className="alert-evidence-list">{items.map(item => {
    const { label, Icon, timestamp, origin, summary, status } = metadata(item);
    return <li key={item.collection + ':' + item.id}>
      <span className="alert-evidence-icon"><Icon size={20} aria-hidden="true" /></span>
      <div className="alert-evidence-main">
        <div><strong>{label}</strong>{status != null && <Badge value={status} />}</div>
        {summary && <p title={summary}><bdi>{summary}</bdi></p>}
      </div>
      <div className="alert-evidence-fact"><Clock3 size={14} aria-hidden="true" />
        <time dateTime={timestamp}>{formatTime(timestamp)}</time>
      </div>
      <div className="alert-evidence-fact" aria-label="IP مبدأ"><Network size={14} aria-hidden="true" />
        <bdi className="mono">{origin ?? '—'}</bdi>
      </div>
      {item.record
        ? <a className="button alert-record-link" href={alertLink(domain, alertId, item)}>
          <ArrowUpLeft size={15} aria-hidden="true" />مشاهدهٔ لاگ
        </a>
        : <span className="muted alert-record-link">رکورد در دسترس نیست</span>}
    </li>;
  })}</ol>;
}

export function AlertRecord({ domain, alertId, collection, recordId }) {
  const evidence = useResource('/alerts/' + encodeURIComponent(alertId) + '/evidence', {}, 0, liveApi);
  const back = alertLink(domain, alertId);
  return <div className="stack alert-detail-page">
    <div><BackLink href={back}>بازگشت به جزئیات هشدار</BackLink></div>
    <Resource result={evidence}>{data => {
      const item = data.items.find(row => row.collection === collection && String(row.id) === recordId);
      if (!item?.record) return <Card title="لاگ مرتبط">
        <p className="notice">این رکورد برای هشدار در دسترس نیست.</p>
      </Card>;
      const { label, Icon, origin, source, timestamp, eventId, status, summary } = metadata(item);
      return <>
        <section className="card alert-detail-hero">
          <div className="alert-detail-heading">
            <span className="alert-hero-icon"><Icon size={23} aria-hidden="true" /></span>
            <div><h2>{label}</h2>{summary && <p><bdi>{summary}</bdi></p>}</div>
          </div>
          <dl className="alert-meta-grid">
            <MetaItem icon={Clock3} label="زمان رخداد"><time dateTime={timestamp}>{formatTime(timestamp)}</time></MetaItem>
            <MetaItem icon={Network} label="IP مبدأ"><bdi className="mono">{origin ?? '—'}</bdi></MetaItem>
            <MetaItem icon={Server} label="منبع"><bdi>{source ?? '—'}</bdi></MetaItem>
            {(status != null || eventId != null) && <MetaItem icon={Activity} label={eventId != null ? 'شناسهٔ رخداد' : 'کد یا سطح'}>
              <bdi>{eventId ?? status}</bdi>
            </MetaItem>}
          </dl>
        </section>
        <Card title="رکورد کامل" detail={<bdi className="mono">{item.id}</bdi>} className="alert-raw-card">
          <pre dir="ltr" tabIndex={0}>{JSON.stringify(item.record, null, 2)}</pre>
        </Card>
      </>;
    }}</Resource>
  </div>;
}

export default function AlertDetails({ domain, id, canWrite, canList }) {
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const path = '/alerts/' + encodeURIComponent(id);
  const alert = useResource(path, {}, revision, liveApi);
  const evidence = useResource(path + '/evidence', {}, 0, liveApi);

  async function change(status) {
    setBusy(true);
    setError('');
    try {
      await liveApi(path, { method: 'PATCH', body: { status } });
      setRevision(value => value + 1);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="stack alert-detail-page">
    <div><BackLink href={canList ? alertLink(domain) : '#tasks'}>
      {canList ? 'بازگشت به فهرست هشدارها' : 'بازگشت به تسک‌ها'}
    </BackLink></div>
    <Resource result={alert}>{data => {
      const items = evidence.data?.items ?? [];
      const origins = [...new Set(items.map(item => metadata(item).origin).filter(Boolean))];
      const eventItems = items.filter(item => !['web_service_batches', 'ml_predictions'].includes(item.collection));
      const latest = eventItems.map(item => metadata(item).timestamp).filter(value => value && Number.isFinite(Date.parse(value)))
        .reduce((last, value) => !last || Date.parse(value) > Date.parse(last) ? value : last, null);
      const origin = field(data.evidence?.source_ip) ?? (origins.length === 1 ? origins[0] : null);
      const count = data.evidence?.observed_count;
      const threshold = data.evidence?.threshold;
      return <>
        <section className="card alert-detail-hero">
          <div className="alert-detail-header">
            <div className="alert-detail-heading">
              <span className="alert-hero-icon"><BellRing size={23} aria-hidden="true" /></span>
              <div>
                <div className="alert-detail-badges">
                  <Badge value={data.severity} /><Badge value={data.status} />
                  {data.owasp_category && <Badge>{data.owasp_category} · OWASP 2025</Badge>}
                  {data.evidence?.windows_event_id && <Badge tone="blue">Windows Event {data.evidence.windows_event_id}</Badge>}
                </div>
                <h2 dir="auto">{ruleTitles[data.evidence?.rule] ?? data.title}</h2>
              </div>
            </div>
            {canWrite && <label className="alert-status-control"><span>وضعیت رسیدگی</span>
              <select value={data.status} aria-label="تغییر وضعیت" disabled={busy} onChange={event => change(event.target.value)}>
                {states.map(state => <option key={state} value={state}>{statuses[state]}</option>)}
              </select>
            </label>}
          </div>
          {data.description && <p className="alert-description" dir="auto">{data.description}</p>}
          <dl className="alert-meta-grid">
            <MetaItem icon={Network} label="IP مبدأ">
              <bdi className="mono">{origin ?? (origins.length > 1 ? `${number.format(origins.length)} مبدأ` : '—')}</bdi>
            </MetaItem>
            <MetaItem icon={Clock3} label="آخرین رخداد"><time dateTime={latest ?? undefined}>{formatTime(latest)}</time></MetaItem>
            <MetaItem icon={Server} label="منبع هشدار"><bdi>{data.source ?? '—'}</bdi></MetaItem>
            <MetaItem icon={BellRing} label="زمان صدور"><time dateTime={data.created_at}>{formatTime(data.created_at)}</time></MetaItem>
          </dl>
          {count != null && <div className="alert-match">
            <Activity size={16} aria-hidden="true" /><strong>{number.format(count)} رخداد</strong>
            {threshold != null && <span>آستانهٔ {number.format(threshold)}</span>}
            {data.evidence?.window_minutes != null && <span>پنجرهٔ {number.format(data.evidence.window_minutes)} دقیقه</span>}
          </div>}
        </section>
        {error && <p className="notice error" role="alert">{error}</p>}
        <Card title="شواهد مرتبط" action={evidence.data && <Badge tone="blue">{number.format(items.length)} رکورد</Badge>}>
          <Resource result={evidence}>{result => <EvidenceList domain={domain} alertId={id} items={result.items} />}</Resource>
        </Card>
        {data.evidence && <details className="card alert-diagnostics"><summary><Fingerprint size={16} aria-hidden="true" /> فرادادهٔ تشخیص</summary>
          <pre dir="ltr" tabIndex={0}>{JSON.stringify(data.evidence, null, 2)}</pre>
        </details>}
      </>;
    }}</Resource>
  </div>;
}
