import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronLeft, Cpu, HardDrive, Laptop, MemoryStick, Monitor, Search, Server, UserRound, X } from 'lucide-react';
import { Badge, number, Pagination, Resource, useResource } from './ui.jsx';
import { liveApi } from './api.js';
import SystemFields, { systemFields, systemValues } from './SystemFields.jsx';
import { deviceTypes, liveDevice, normalizeDeviceIp, resourceTone } from './deviceHealth.js';

const icons = { desktop: Monitor, laptop: Laptop, server: Server };
const metrics = [
  ['cpu', 'پردازنده', Cpu],
  ['ram', 'حافظه', MemoryStick],
];
const activityMetrics = [
  ['disk', 'دیسک', HardDrive, 'disk_read_bytes_per_sec', 'disk_write_bytes_per_sec', 'خواندن', 'نوشتن'],
  ['network', 'شبکه', Activity, 'net_recv_bytes_per_sec', 'net_sent_bytes_per_sec', 'دریافت', 'ارسال'],
];
const percent = new Intl.NumberFormat('fa-IR', { style: 'percent' });
const unset = 'ثبت نشده';
const rate = value => value == null ? unset : `${number.format(value / 1024)} KB/s`;

function DeviceDialog({ title, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  return <dialog className="record-dialog device-dialog" ref={dialog} onClose={onClose} aria-labelledby="device-dialog-title">
    <header className="card-header">
      <h2 id="device-dialog-title">{title}</h2>
      <button type="button" className="icon-button" aria-label="بستن" onClick={() => dialog.current.close()}><X size={18} /></button>
    </header>
    {children}
  </dialog>;
}

function DeviceForm({ device, onSave }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await liveApi('/device-health/' + device.id, {
        method: 'PATCH', body: systemValues(Object.fromEntries(new FormData(event.currentTarget))),
      });
      onSave();
    } catch (failure) {
      setError(failure.status === 422 ? 'نشانی IP، نشانی MAC یا آستانه معتبر نیست.' : failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <form className="account-form user-editor" onSubmit={submit}>
    <SystemFields profile={device} />
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button primary" disabled={busy}>ذخیرهٔ سیستم</button>
  </form>;
}

function DeviceCard({ device, onDetails, onUser }) {
  const Icon = icons[device.type] ?? Monitor;
  return <article className="card device-card">
    <div className="device-identity">
      <span className="device-icon"><Icon size={25} aria-hidden="true" /></span>
      <div><h2>{device.name}</h2><bdi dir="ltr" className="mono">{device.ip || device.mac || '—'}</bdi><small>{deviceTypes[device.type]}</small></div>
      <Badge tone={device.online ? 'green' : 'muted'}>{device.online ? 'روشن' : 'خاموش'}</Badge>
    </div>
    <div className="device-metrics">
      {metrics.map(([key, label, Icon]) => {
        const value = device.online ? device[key] : null;
        const tone = resourceTone(value, device.threshold);
        return <div key={key}>
          <div className="device-metric-label"><span><Icon size={15} aria-hidden="true" />{label}</span>
            <strong className={tone}>{value == null ? '—' : percent.format(value / 100)}</strong></div>
          <div className="device-meter">
            {value != null && <div className={'device-meter-fill ' + tone} role="meter" aria-label={label}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} style={{ width: `${value}%` }}
              title={tone === 'red' ? 'بحرانی' : tone === 'amber' ? 'بالاتر از آستانه' : 'عادی'} />}
          </div>
        </div>;
      })}
      <div className="device-activity-grid">
        {activityMetrics.map(([key, label, Icon, first, second, firstLabel, secondLabel]) => <div key={key}>
          <div className="device-metric-label"><span><Icon size={15} aria-hidden="true" />{label}</span></div>
          <small>{firstLabel} <bdi>{device.online ? rate(device[first]) : unset}</bdi></small>
          <small>{secondLabel} <bdi>{device.online ? rate(device[second]) : unset}</bdi></small>
        </div>)}
      </div>
    </div>
    <small>آستانهٔ مصرف {percent.format(device.threshold / 100)}</small>
    <div className="device-card-actions">
      <button className="button" onClick={onUser}><UserRound size={16} />{device.user || 'کاربر جاری'}</button>
      <button className="text-link device-details-link" onClick={onDetails}>جزئیات سیستم <ChevronLeft size={15} /></button>
    </div>
  </article>;
}

export function Systems() {
  const [offset, setOffset] = useState(0);
  const result = useResource('/systems', { limit: 25, offset }, 0, liveApi);
  const columns = [
    { key: 'hostname', label: 'سیستم', render: row => <><strong>{row.hostname}</strong>
      <small className="row-detail"><bdi dir="ltr">{row.mac}</bdi></small></> },
    { key: 'os', label: 'سیستم‌عامل', render: row => <>{row.os || unset}
      <small className="row-detail"><bdi>{row.architecture || unset}</bdi></small></> },
    { key: 'resources', label: 'مصرف', render: row => <>
      <span>CPU {row.cpu_percent == null ? '—' : percent.format(row.cpu_percent / 100)}</span>
      <small className="row-detail">RAM {row.memory_percent == null ? '—' : percent.format(row.memory_percent / 100)}</small></> },
    { key: 'disk', label: 'دیسک', render: row => <>
      <span>خواندن <bdi>{rate(row.disk_read_bytes_per_sec)}</bdi></span>
      <small className="row-detail">نوشتن <bdi>{rate(row.disk_write_bytes_per_sec)}</bdi></small></> },
    { key: 'network', label: 'شبکه', render: row => <>
      <span>دریافت <bdi>{rate(row.net_recv_bytes_per_sec)}</bdi></span>
      <small className="row-detail">ارسال <bdi>{rate(row.net_sent_bytes_per_sec)}</bdi></small></> },
    { key: 'user', label: 'کاربر', render: row => row.assigned_user?.name || 'اختصاص نیافته' },
    { key: 'status', label: 'وضعیت', render: row => <><Badge tone={row.online ? 'green' : 'muted'}>
      {row.online ? 'روشن' : 'خاموش'}</Badge><small className="row-detail">
      {row.last_seen ? new Date(row.last_seen).toLocaleString('fa-IR') : unset}</small></> },
  ];
  return <div className="stack">
    <p className="notice">این فهرست از اطلاعات Agent ساخته می‌شود و فقط‌خواندنی است.</p>
    <Resource result={result}>{page => <>
      <Table columns={columns} rows={page.items} empty="هنوز سیستمی شناسایی نشده است." />
      <Pagination page={page} onOffset={setOffset} />
    </>}</Resource>
  </div>;
}

export default function DeviceHealth({ user, canWrite }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [feedback, setFeedback] = useState('');
  const result = useResource('/device-health', { offset }, revision, liveApi);
  const close = () => setDialog(null);
  const search = query.trim().toLowerCase();
  const searchedIp = normalizeDeviceIp(search);

  function saved() {
    close();
    setFeedback('مشخصات سیستم ذخیره شد.');
    setRevision(value => value + 1);
  }

  return <div className="device-page">
    <div className="device-toolbar">
      <label className="device-search"><Search size={17} aria-hidden="true" />
        <input aria-label="جست‌وجوی این صفحه" placeholder="جست‌وجوی این صفحه با نام، شاخه، IP یا MAC"
          value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <select aria-label="فیلتر وضعیت" value={status} onChange={event => setStatus(event.target.value)}>
        <option value="all">همهٔ وضعیت‌ها</option><option value="online">روشن</option><option value="offline">خاموش</option>
      </select>
    </div>
    {feedback && <p role="status" className="notice device-feedback">{feedback}</p>}
    <p className="device-forecast-legend">دادهٔ واقعی Agent · <b className="green">عادی</b> تا آستانه ·
      <b className="amber"> زرد</b> بالاتر از آستانه · <b className="red"> قرمز</b> بیشتر از ۱۲۰٪ آستانه</p>
    <Resource result={result}>{page => {
      const devices = page.items.map(liveDevice);
      const visible = devices.filter(device =>
        (status === 'all' || device.online === (status === 'online')) &&
        (device.ip === searchedIp || [device.name, device.ip, device.mac, device.user, device.branch]
          .some(value => (value ?? '').toLowerCase().includes(search))));
      const groups = new Map();
      for (const device of visible) {
        const branch = device.branchId ?? '';
        if (!groups.has(branch)) groups.set(branch, []);
        groups.get(branch).push(device);
      }
      const online = devices.filter(device => device.online).length;
      return <>
        <div className="device-summary">
          {[[Monitor, 'کل سیستم‌ها', page.total], [Activity, 'روشن در این صفحه', online],
            [Monitor, 'خاموش در این صفحه', devices.length - online]]
            .map(([Icon, label, count]) => <div className="card" key={label}><Icon size={20} aria-hidden="true" />
              <span>{label}</span><strong>{number.format(count)}</strong></div>)}
        </div>
        {visible.length === 0 && <p className="notice" role="status">سیستمی برای نمایش پیدا نشد.</p>}
        {[...groups].map(([id, rows]) => <section className="device-branch" key={id}>
          {(user.role !== 'client' || rows[0].branch) && <h2>{rows[0].branch || 'شاخهٔ بدون نام'}</h2>}
          <div className="device-grid">{rows.map(device => <DeviceCard key={device.id} device={device}
            onDetails={() => setDialog({ mode: 'details', device })}
            onUser={() => setDialog({ mode: 'user', device })} />)}</div>
        </section>)}
        <Pagination page={page} onOffset={setOffset} />
      </>;
    }}</Resource>
    {canWrite && dialog?.mode === 'form' && <DeviceDialog title="ویرایش سیستم" onClose={close}>
      <DeviceForm device={dialog.device} onSave={saved} />
    </DeviceDialog>}
    {dialog?.mode === 'details' && <DeviceDialog title={dialog.device.name} onClose={close}>
      <dl className="device-detail-list">
        <div><dt>نوع سیستم</dt><dd>{deviceTypes[dialog.device.type]}</dd></div>
        <div><dt>وضعیت</dt><dd>{dialog.device.online ? 'روشن' : 'خاموش'}</dd></div>
        <div><dt>آخرین دریافت</dt><dd><bdi>{dialog.device.last_seen ? new Date(dialog.device.last_seen).toLocaleString('fa-IR') : unset}</bdi></dd></div>
        {systemFields.slice(1).map(([key, label]) => <div key={key}><dt>{label}</dt>
          <dd><bdi>{dialog.device[key] || unset}</bdi></dd></div>)}
        <div><dt>معماری</dt><dd><bdi>{dialog.device.architecture || unset}</bdi></dd></div>
        <div><dt>هستهٔ فیزیکی / منطقی</dt><dd><bdi>{dialog.device.cpu_cores_physical ?? unset} / {dialog.device.cpu_cores_logical ?? unset}</bdi></dd></div>
        <div><dt>حافظهٔ مصرف‌شده</dt><dd><bdi>{dialog.device.memory_used_mb == null ? unset : `${number.format(dialog.device.memory_used_mb)} MB`}</bdi></dd></div>
        <div><dt>خواندن / نوشتن دیسک</dt><dd><bdi>{rate(dialog.device.disk_read_bytes_per_sec)} / {rate(dialog.device.disk_write_bytes_per_sec)}</bdi></dd></div>
        <div><dt>ارسال / دریافت شبکه</dt><dd><bdi>{rate(dialog.device.net_sent_bytes_per_sec)} / {rate(dialog.device.net_recv_bytes_per_sec)}</bdi></dd></div>
      </dl>
      <div className="device-dialog-actions">
        <button className="button" onClick={() => setDialog({ ...dialog, mode: 'user' })}>کاربر جاری</button>
        {canWrite && <button className="button primary" onClick={() => setDialog({ ...dialog, mode: 'form' })}>ویرایش سیستم</button>}
      </div>
    </DeviceDialog>}
    {dialog?.mode === 'user' && <DeviceDialog title="کاربر سیستم" onClose={close}>
      <dl className="device-detail-list">
        <div><dt>نام</dt><dd>{dialog.device.user}</dd></div>
        <div><dt>نام کاربری</dt><dd><bdi>{dialog.device.username}</bdi></dd></div>
        <div><dt>شاخه</dt><dd>{dialog.device.branch || unset}</dd></div>
      </dl>
    </DeviceDialog>}
  </div>;
}
