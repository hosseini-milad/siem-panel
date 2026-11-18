import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Search, SlidersHorizontal, X } from 'lucide-react';
import { explorerApi } from './api.js';
import { today } from './explorerMock.js';
import { Badge, Card, logLevels, number, Pagination, Resource, Table, useResource } from './ui.jsx';

const pageSize = 15;
const timestamp = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'medium' });
const percent = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 1 });
const dateRange = value => {
  if (!value) return {};
  const start = new Date(value + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
};

function Risk({ value }) {
  if (!value) return <span className="muted">ارزیابی نشده</span>;
  return <span className="risk"><Badge value={value.severity} /> {percent.format(value.attack_probability)}</span>;
}

const columns = [
  { key: 'timestamp', label: 'زمان', render: row => row.timestamp ? <time dateTime={row.timestamp}>{timestamp.format(new Date(row.timestamp))}</time> : 'نامشخص' },
  { key: 'source_ip', label: 'IP مبدأ', render: row => <bdi className="mono">{row.source_ip ?? '—'}</bdi> },
  { key: 'destination_ip', label: 'IP مقصد', render: row => <bdi className="mono">{row.destination_ip ?? '—'}</bdi> },
  { key: 'destination_port', label: 'پورت مقصد', render: row => row.destination_port ?? '—' },
  { key: 'protocol', label: 'پروتکل', render: row => row.protocol ?? '—' },
  { key: 'risk', label: 'مخاطره', render: row => <Risk value={row.risk} /> },
];

function RecordDetails({ row, onClose }) {
  const dialog = useRef();
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  return <dialog ref={dialog} className="record-dialog" onClose={onClose} aria-labelledby="record-title">
    <header className="card-header">
      <div><h2 id="record-title">جزئیات رکورد</h2><p>{row.message} · <bdi>{row.id}</bdi></p></div>
      <button className="icon-button" type="button" onClick={() => dialog.current.close()} aria-label="بستن جزئیات"><X size={18} /></button>
    </header>
    <div className="record-risk"><span>مخاطره</span><Risk value={row.risk} />{row.level && <Badge value={row.level} />}</div>
    <section><h3>اطلاعات کامل خام</h3><pre dir="ltr">{JSON.stringify(row.raw, null, 2)}</pre></section>
    <section><h3>اطلاعات نرمال‌شده</h3>{row.normalized
      ? <pre dir="ltr">{JSON.stringify(row.normalized, null, 2)}</pre>
      : <p className="muted">برای این رکورد دادهٔ نرمال‌شده موجود نیست.</p>}</section>
  </dialog>;
}

export default function Explorer() {
  const [kind, setKind] = useState('data');
  const [date, setDate] = useState(today);
  const [advanced, setAdvanced] = useState(false);
  const [filters, setFilters] = useState({});
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const result = useResource('/explorer/records', { kind, ...dateRange(date), ...filters, limit: pageSize, offset }, 0, explorerApi);

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
      { key: 'message', label: 'پیام لاگ' },
      { key: 'level', label: 'سطح', render: row => <Badge value={row.level} /> },
    ] : []),
    ...columns,
    { key: 'details', label: 'جزئیات', render: row =>
      <button type="button" className="button" onClick={() => setSelected(row)}>مشاهده</button> },
  ];

  return <Card title="داده‌ها و لاگ‌ها" detail="روز بر اساس منطقهٔ زمانی مرورگر است. برای مشاهدهٔ همهٔ روزها تاریخ را پاک کنید.">
    <div className="explorer-toolbar">
      <div className="explorer-tabs" aria-label="نوع رکورد">
        {[['data', 'داده‌های شبکه'], ['logs', 'لاگ‌ها']].map(([key, label]) =>
          <button key={key} type="button" className="button" aria-pressed={kind === key} onClick={() => {
            setKind(key);
            setFilters(previous => ({ ...previous, level: '' }));
            setOffset(0);
          }}>{label}</button>,
        )}
      </div>
      <label className="explorer-date"><CalendarDays size={17} /> روز
        <input type="date" aria-label="روز" dir="ltr" value={date} onChange={event => { setDate(event.target.value); setOffset(0); }} />
      </label>
      <button type="button" className="button" onClick={() => { setDate(''); setOffset(0); }}>همهٔ روزها</button>
    </div>
    <form className="explorer-form" onSubmit={submit} onReset={() => { setFilters({}); setOffset(0); }}>
      <div className="explorer-search">
        <label>جست‌وجوی ساده<input name="q" type="search" placeholder="IP، پورت، شناسه یا متن پیام" maxLength={1024} /></label>
        <button className="button" type="button" aria-expanded={advanced} onClick={toggleAdvanced}>
          <SlidersHorizontal size={16} /> فیلتر پیشرفته
        </button>
        <button type="submit" className="primary"><Search size={16} /> جست‌وجو</button>
        <button type="reset" className="button">پاک کردن فیلترها</button>
      </div>
      {advanced && <fieldset className="advanced-filters">
        <legend>همهٔ فیلدهای تکمیل‌شده باید با رکورد مطابقت داشته باشند</legend>
        <label>IP کاربر (مبدأ)<input name="source_ip" dir="ltr" maxLength={45} placeholder="192.0.2.10" /></label>
        <label>IP مقصد<input name="destination_ip" dir="ltr" maxLength={45} placeholder="198.51.100.20" /></label>
        <label>پورت مبدأ<input type="number" name="source_port" min="0" max="65535" dir="ltr" /></label>
        <label>پورت مقصد<input type="number" name="destination_port" min="0" max="65535" dir="ltr" /></label>
        <label>پروتکل<select name="protocol"><option value="">همه</option><option>TCP</option><option>UDP</option><option>ICMP</option></select></label>
        <label>مخاطره<select name="risk"><option value="">همه</option><option value="critical">بحرانی</option>
          <option value="high">زیاد</option><option value="medium">متوسط</option><option value="low">کم</option>
          <option value="unscored">ارزیابی نشده</option></select></label>
        {kind === 'logs' && <label>سطح لاگ<select name="level"><option value="">همه</option>
          {logLevels.map(level => <option key={level}>{level}</option>)}</select></label>}
      </fieldset>}
    </form>
    <Resource result={result}>{data => <>
      <Table columns={tableColumns} rows={data.items} empty="در این بازه رکوردی با فیلترهای انتخابی یافت نشد." />
      <Pagination page={data} onOffset={setOffset} />
    </>}</Resource>
    {selected && <RecordDetails key={selected.id} row={selected} onClose={() => setSelected(null)} />}
  </Card>;
}
