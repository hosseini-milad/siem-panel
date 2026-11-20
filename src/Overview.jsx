import { Activity, ArrowUpLeft, BellRing, FolderOpen, ScanLine } from 'lucide-react';
import { liveApi } from './api.js';
import { Badge, Card, eventColumns, number, Table, time, tones, useResource } from './ui.jsx';

const metrics = [
  ['event_count', 'رویدادهای ثبت‌شده', 'در بازهٔ انتخابی', Activity, 'purple'],
  ['open_alerts', 'هشدارهای فعال', 'باز یا تأیید شده', BellRing, 'orange'],
  ['active_incidents', 'رخدادهای فعال', 'پرونده‌های بسته‌نشده', FolderOpen, 'blue'],
  ['enabled_rules', 'قواعد فعال', 'قواعد آمادهٔ ارزیابی', ScanLine, 'green'],
];

const date = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' });

function Trend({ series, interval }) {
  const label = stamp => interval === 'day' ? date.format(new Date(stamp)) : time(stamp);
  if (!series.length) return <p className="notice">در این بازه رویدادی ثبت نشده است.</p>;
  const peak = Math.max(1, ...series.map(row => row.count));
  const points = series.map((row, i) => [8 + i * 584 / Math.max(1, series.length - 1), 145 - row.count / peak * 128]);
  const line = points.map((point, i) => `${i ? 'L' : 'M'} ${point.join(' ')}`).join(' ');
  const area = `${line} L ${points.at(-1)[0]} 145 L 8 145 Z`;
  const markers = [...new Set([0, Math.floor((series.length - 1) / 3), Math.floor((series.length - 1) * 2 / 3), series.length - 1])];
  return <div className="trend" dir="ltr">
    <svg viewBox="0 0 600 152" preserveAspectRatio="none" role="img" aria-label="نمودار روند تعداد رویدادها">
      <defs><linearGradient id="volume" x1="0" x2="0" y1="0" y2="1" gradientUnits="objectBoundingBox">
        <stop stopColor="var(--chart)" stopOpacity=".35" /><stop offset="1" stopColor="var(--chart)" stopOpacity=".02" />
      </linearGradient></defs>
      {[17, 49, 81, 113, 145].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} className="gridline" />)}
      <path d={area} fill="url(#volume)" />
      <path d={line} fill="none" stroke="var(--chart)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      {points.map(([x, y], i) => <circle key={series[i].timestamp} cx={x} cy={y} r="3" fill="var(--chart)">
        <title>{label(series[i].timestamp)} · {number.format(series[i].count)}</title>
      </circle>)}
    </svg>
    <div className="axis">{markers.map(i => <span key={i}>{label(series[i].timestamp)}</span>)}</div>
  </div>;
}

function Levels({ levels, total }) {
  if (!levels.length || !total) return <p className="notice">داده‌ای برای این بازه وجود ندارد.</p>;
  let position = 0;
  const segments = levels.map(({ level, count }) => {
    const start = position;
    position += count / total * 100;
    return `var(--${tones[level] ?? 'muted'}) ${start}% ${position}%`;
  });
  return <div className="levels">
    <div className="donut" style={{ background: `conic-gradient(${segments.join(',')})` }}>
      <div><strong>{number.format(total)}</strong><small>کل رویدادها</small></div>
    </div>
    <div className="legend">{levels.map(({ level, count }) =>
      <div key={level}><Badge value={level} /><span>{number.format(count)}</span></div>,
    )}</div>
  </div>;
}

function dailySeries(series) {
  const days = new Map();
  for (const { timestamp, count } of series) {
    const day = new Date(timestamp).toISOString().slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + count);
  }
  return [...days].map(([day, count]) => ({ timestamp: day + 'T00:00:00Z', count }));
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

export default function Overview({ hours, showEvents }) {
  const overview = useResource('/overview', { hours }, 0, liveApi);
  const sample = useResource('/overview', { hours });
  const live = overview.data;
  const fallback = sample.data;
  const interval = hours === 24 ? 'hour' : 'day';
  const hourly = live?.hourly_events?.length ? live.hourly_events : fallback?.hourly_events ?? [];
  const levels = live?.levels?.length ? live.levels : fallback?.levels ?? [];
  const sampleMetrics = metrics.some(([key]) => !Number.isFinite(live?.[key]) && Number.isFinite(fallback?.[key]));
  return <>
    <div className="metrics">
      {metrics.map(([key, label, detail, Icon, tone]) => <section className="card metric" key={key}>
        <div className="metric-head"><span>{label}</span><i className={`metric-icon ${tone}`}><Icon size={19} /></i></div>
        <strong>{number.format(Number.isFinite(live?.[key]) ? live[key] : fallback?.[key] ?? 0)}</strong>
        <small>{detail}{sampleMetrics && !Number.isFinite(live?.[key]) && ' · نمونه'}</small>
      </section>)}
    </div>
    <div className="chart-grid">
      <Card title="روند رویدادها" detail={hours === 24 ? "حجم رویدادها به تفکیک ساعت" : "حجم رویدادها به تفکیک روز"} action={<span className="chart-key"><i /> تعداد رویداد</span>}>
        {!live?.hourly_events?.length && hourly.length > 0 && <Badge>دادهٔ نمونه</Badge>}
        <Trend series={interval === 'day' ? dailySeries(hourly) : hourly} interval={interval} />
      </Card>
      <Card title="توزیع سطح رویدادها" detail="تفکیک رویدادها بر اساس سطح">
        {!live?.levels?.length && levels.length > 0 && <Badge>دادهٔ نمونه</Badge>}
        <Levels levels={levels} total={levels.reduce((total, row) => total + row.count, 0)} />
      </Card>
    </div>
    {showEvents && <RecentEvents />}
  </>;
}
