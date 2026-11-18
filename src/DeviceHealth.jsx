import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronLeft, Cpu, HardDrive, Laptop, MemoryStick, Monitor, Search, Server, TriangleAlert, UserRound, X } from 'lucide-react';
import { Badge, number, Pagination, Resource, useResource } from './ui.jsx';
import { liveApi } from './api.js';
import SystemFields, { systemFields, systemValues } from './SystemFields.jsx';
import { deviceTypes, forecastWarningThreshold, loadDevices, mockDevice, normalizeDeviceIp, resourceTone } from './deviceHealth.js';

const icons = { desktop: Monitor, laptop: Laptop, server: Server };
const metrics = [
  ['cpu', 'پردازنده', Cpu],
  ['ram', 'حافظه', MemoryStick],
  ['disk', 'فضای دیسک', HardDrive],
];
const percent = new Intl.NumberFormat('fa-IR', { style: 'percent' });
const unset = 'ثبت نشده';

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
        const forecast = device.online ? device.forecast?.[key] : null;
        const difference = value != null && forecast != null ? Math.abs(value - forecast) : null;
        const warning = difference != null && difference >= forecastWarningThreshold;
        const tone = resourceTone(value, device.threshold);
        return <div key={key}>
          <div className="device-metric-label"><span><Icon size={15} aria-hidden="true" />{label}</span>
            <strong className={tone}>{value == null ? '—' : percent.format(value / 100)}</strong></div>
          <div className="device-meter">
            {value != null && <div className={'device-meter-fill ' + tone} role="meter" aria-label={label}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} style={{ width: `${value}%` }}
              title={tone === 'red' ? 'بحرانی' : tone === 'amber' ? 'بالاتر از آستانه' : 'عادی'} />}
            {forecast != null && <span className="device-forecast-marker" aria-hidden="true"
              style={{ '--forecast-position': `${forecast}%` }} />}
          </div>
          {forecast != null && <div className="device-forecast-caption">
            <span>پیش‌بینی {percent.format(forecast / 100)}</span>
            {warning && <strong><TriangleAlert size={14} aria-hidden="true" />هشدار · اختلاف {number.format(difference)} واحد درصد</strong>}
          </div>}
        </div>;
      })}
    </div>
    <small>آستانهٔ مصرف {percent.format(device.threshold / 100)}</small>
    <div className="device-card-actions">
      <button className="button" onClick={onUser}><UserRound size={16} />{device.user || 'کاربر جاری'}</button>
      <button className="text-link device-details-link" onClick={onDetails}>جزئیات سیستم <ChevronLeft size={15} /></button>
    </div>
  </article>;
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
    <p className="device-forecast-legend">
      مصرف ماک · <b className="green">عادی</b> تا آستانه · <b className="amber">زرد</b> بالاتر از آستانه ·
      <b className="red"> قرمز</b> بیشتر از ۱۲۰٪ آستانه. نشانگر زرد باریک، پیش‌بینی مصرف است.
    </p>
    <Resource result={result}>{page => {
      const legacy = loadDevices();
      const devices = page.items.map(account => mockDevice(account, legacy));
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
        <div><dt>وضعیت ماک</dt><dd>{dialog.device.online ? 'روشن' : 'خاموش'}</dd></div>
        {systemFields.slice(1).map(([key, label]) => <div key={key}><dt>{label}</dt>
          <dd><bdi>{dialog.device[key] || unset}</bdi></dd></div>)}
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
