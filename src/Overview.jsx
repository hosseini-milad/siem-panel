import { ArrowUpLeft } from 'lucide-react';
import { liveApi } from './api.js';
import { Badge, Card, displayValue, eventColumns, number, Table, useResource } from './ui.jsx';

const domains = [
  { key: 'network', label: 'شبکه', tone: 'purple', dash: undefined, source: 'رویداد شبکه' },
  { key: 'system', label: 'سیستم‌عامل', tone: 'blue', dash: '8 4', source: 'لاگ Agent' },
  { key: 'web', label: 'وب‌سرویس‌ها', tone: 'orange', dash: '2 4', source: 'درخواست HTTP' },
];
const severities = ['critical', 'high', 'medium', 'low'];
const dateLabel = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const hourLabel = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const dateTime = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
const count = value => Number.isFinite(value) ? number.format(value) : '—';
const seriesLabel = (timestamp, interval) =>
  (interval === 'day' ? dateLabel : hourLabel).format(new Date(timestamp));

function Trend({ series = [], selected, interval, title }) {
  const maxCount = Math.max(1, ...series.flatMap(row => selected.map(({ key }) => row[key])));
  const width = 640;
  const baseline = 134;
  const x = index => 12 + index * (width - 24) / Math.max(1, series.length - 1);
  const y = value => baseline - value / maxCount * 116;
  const marks = series.length ? [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])] : [];
  return <div className="trend" dir="ltr">
    <div className="overview-plot">
      <div className="overview-scale" aria-hidden="true">
        <span>{series.length ? count(maxCount) : '—'}</span><span>{series.length ? count(0) : '—'}</span>
      </div>
      <svg viewBox={`0 0 ${width} 146`} preserveAspectRatio="none" role="img" aria-label={title}>
      {[18, 47, 76, 105, 134].map(position =>
        <line key={position} x1="0" x2={width} y1={position} y2={position} className="gridline" />)}
      {selected.map(({ key, label, tone, dash }) => <g key={key}>
        <polyline points={series.map((row, index) => `${x(index)},${y(row[key])}`).join(' ')}
          fill="none" stroke={`var(--${tone})`} strokeWidth="2.5" strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
        {series.map((row, index) => row[key] > 0 && <circle key={row.timestamp} cx={x(index)} cy={y(row[key])}
          r="3" fill={`var(--${tone})`}>
          <title>{label} · {seriesLabel(row.timestamp, interval)} · {count(row[key])}</title>
        </circle>)}
      </g>)}
      </svg>
    </div>
    <div className="axis overview-axis">{marks.map(index => <span key={index}>{seriesLabel(series[index].timestamp, interval)}</span>)}</div>
  </div>;
}

function RecentEvents() {
  const events = useResource('/search/events', { limit: 5 }, 0, liveApi);
  const sample = useResource('/search/events', { limit: 5 });
  const liveItems = events.data?.items;
  const sampleItems = sample.data?.items ?? [];
  return <Card title="آخرین رویدادها" detail="تازه‌ترین رویدادهای ثبت‌شده"
    action={<a className="text-link" href="#events">همهٔ رویدادها <ArrowUpLeft size={15} /></a>}>
    {!liveItems?.length && sampleItems.length > 0 && <Badge>دادهٔ نمونه</Badge>}
    <Table columns={eventColumns} rows={liveItems?.length ? liveItems : sampleItems} />
  </Card>;
}

function Operations({ live, showAlerts, showExplorer }) {
  const rows = domains.map(({ key, label }) => {
    const stamp = live?.sources?.[key]?.last_received_at;
    return {
      id: key, label,
      open: count(live?.alert_queue?.[key]?.open),
      acknowledged: count(live?.alert_queue?.[key]?.acknowledged),
      received: stamp ? dateTime.format(new Date(stamp)) : live ? 'دریافت ثبت نشده' : '—',
    };
  });
  return <div className="overview-source-grid">
    <Card title="صف رسیدگی به هشدارها" detail="هشدارهای رسیدگی‌نشده در همهٔ بازه‌ها"
      action={showAlerts && <a className="text-link" href="#alerts">هشدارها <ArrowUpLeft size={15} /></a>}>
      <Table rows={rows} columns={[
        { key: 'label', label: 'مسیر' }, { key: 'open', label: 'باز' },
        { key: 'acknowledged', label: 'تأیید شده' },
      ]} />
      <div className="model-summary">
        <span>رخدادهای فعال <strong>{count(live?.active_incidents)}</strong></span>
        <span>قواعد فعال <strong>{count(live?.enabled_rules)}</strong></span>
      </div>
    </Card>
    <Card title="شدت هشدارها" detail="شمار هشدارهای ثبت‌شده در بازهٔ انتخابی">
      <ul className="detail-list">{severities.map(key => <li key={key}>
        <Badge value={key}>{displayValue(key)}</Badge><strong>{count(live?.alert_severities?.[key])}</strong>
      </li>)}</ul>
    </Card>
    <Card title="آخرین دریافت داده" detail="زمان ثبت آخرین داده یا دستهٔ وب در SIEM"
      action={showExplorer && <a className="text-link" href="#explorer">کاوش داده‌ها <ArrowUpLeft size={15} /></a>}>
      <Table rows={rows} columns={[{ key: 'label', label: 'مسیر' }, { key: 'received', label: 'آخرین دریافت' }]} />
    </Card>
  </div>;
}

export default function Overview({ hours, showEvents, showAlerts, showExplorer }) {
  const overview = useResource('/overview/operations', { hours }, 0, liveApi);
  const live = overview.data;
  const interval = live?.interval ?? (hours <= 24 ? 'hour' : 'day');
  const intervalText = interval === 'hour' ? 'ساعتی' : 'روزانه';
  return <div className="stack">
    <Card title="روند هشدارها در سه مسیر" detail={`شمار هشدارهای ثبت‌شده · ${intervalText} بر اساس UTC`}>
      <div className="overview-legend">{domains.map(({ key, label, tone }) => <span key={key}>
        <i style={{ background: `var(--${tone})` }} />{label}<strong>{count(live?.alert_totals?.[key])}</strong>
      </span>)}</div>
      {overview.error && <p className="notice error" role="alert">{overview.error}</p>}
      {!live && !overview.error && <p className="notice" role="status">در حال دریافت داده…</p>}
      <Trend series={live?.alert_series} selected={domains} interval={interval} title="روند هم‌مقیاس هشدارهای شبکه، سیستم‌عامل و وب‌سرویس‌ها" />
    </Card>
    <div className="overview-source-grid">
      {domains.map(domain => <Card key={domain.key} title={`لاگ ${domain.label}`}
        detail={domain.key === 'web' ? 'شمار همهٔ درخواست‌ها از دسته‌های جمع‌کننده' : `روند ${intervalText} دادهٔ دریافتی`}
        action={<Badge tone={domain.tone}>{count(live?.sources?.[domain.key]?.count)} {domain.source}</Badge>}>
        <Trend series={live?.log_series} selected={[domain]} interval={interval} title={`روند حجم ${domain.source}`} />
      </Card>)}
    </div>
    <Operations live={live} showAlerts={showAlerts} showExplorer={showExplorer} />
    {showEvents && <RecentEvents />}
  </div>;
}
