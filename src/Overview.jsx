import { Activity, ArrowUpLeft, BellRing, FolderOpen, ScanLine } from 'lucide-react';
import { Badge, Card, eventColumns, number, Resource, Table, time, tones, useResource } from './ui.jsx';

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
  if (!levels.length) return <p className="notice">داده‌ای برای این بازه وجود ندارد.</p>;
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

function OverviewTrend({ since, hours }) {
  const charts = useResource('/dashboard/charts', {
    start: since,
    end: new Date(Date.parse(since) + hours * 3_600_000).toISOString(),
    interval: hours === 24 ? 'hour' : 'day',
  });
  return <Resource result={charts}>{data => <Trend series={data.series} interval={data.interval} />}</Resource>;
}

export default function Overview({ hours }) {
  const overview = useResource('/overview', { hours });
  const events = useResource('/search/events', { limit: 5 });
  return <>
    <Resource result={overview}>{data => <div className="metrics">
      {metrics.map(([key, label, detail, Icon, tone]) => <section className="card metric" key={key}>
        <div className="metric-head"><span>{label}</span><i className={`metric-icon ${tone}`}><Icon size={19} /></i></div>
        <strong>{number.format(data[key])}</strong><small>{detail}</small>
      </section>)}
    </div>}</Resource>
    <div className="chart-grid">
      <Card title="روند رویدادها" detail={hours === 24 ? "حجم رویدادها به تفکیک ساعت" : "حجم رویدادها به تفکیک روز"} action={<span className="chart-key"><i /> تعداد رویداد</span>}>
        <Resource result={overview}>{data => <OverviewTrend since={data.since} hours={data.hours} />}</Resource>
      </Card>
      <Card title="توزیع سطح رویدادها" detail="تفکیک رویدادها بر اساس سطح">
        <Resource result={overview}>{data => <Levels levels={data.levels} total={data.event_count} />}</Resource>
      </Card>
    </div>
    <Card title="آخرین رویدادها" detail="تازه‌ترین رویدادهای ثبت‌شده"
      action={<a className="text-link" href="#events">همهٔ رویدادها <ArrowUpLeft size={15} /></a>}>
      <Resource result={events}>{data => <Table columns={eventColumns} rows={data.items} />}</Resource>
    </Card>
  </>;
}
