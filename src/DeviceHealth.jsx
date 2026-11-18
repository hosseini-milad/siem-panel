import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronLeft, Cpu, HardDrive, Laptop, MemoryStick, Monitor, Plus, Search, Server, UserRound, X } from 'lucide-react';
import { Badge, number } from './ui.jsx';
import { deviceStorageKey, deviceTypes, normalizeDeviceIp, sampleDevices } from './deviceHealth.js';

const icons = { desktop: Monitor, laptop: Laptop, server: Server };
const metrics = [
  ['cpu', 'پردازنده', Cpu],
  ['ram', 'حافظه', MemoryStick],
  ['disk', 'فضای دیسک', HardDrive],
];
const specifications = [
  ['os', 'سیستم‌عامل'], ['processor', 'مدل پردازنده'], ['memory', 'ظرفیت حافظه'], ['storage', 'ظرفیت دیسک'],
];
const percent = new Intl.NumberFormat('fa-IR', { style: 'percent' });
const unset = 'ثبت نشده';
const fields = [
  ['name', 'نام سیستم'], ['ip', 'نشانی IP'], ['user', 'نام کاربر'], ['role', 'سمت'], ['access', 'دسترسی‌ها'],
  ...specifications,
];

function initialDevices() {
  try {
    const saved = JSON.parse(localStorage.getItem(deviceStorageKey));
    if (Array.isArray(saved)) return saved;
  } catch {
    // The mock still works in memory when storage is unavailable.
  }
  return sampleDevices;
}

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

function DeviceForm({ device, devices, onSave }) {
  const [online, setOnline] = useState(device?.online ?? true);
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, value.trim()]));
    const ip = normalizeDeviceIp(values.ip);
    if (!values.name) return setError('نام سیستم را وارد کنید.');
    if (!ip) return setError('یک نشانی معتبر IPv4 یا IPv6 وارد کنید.');
    if (devices.some(item => item.id !== device?.id && item.ip === ip)) return setError('این IP قبلاً به یک سیستم متصل شده است.');
    const readings = Object.fromEntries(metrics.map(([key]) => [key, online && values[key] ? Number(values[key]) : null]));
    onSave({ ...values, ...readings, online, ip, id: device?.id ?? crypto.getRandomValues(new Uint32Array(4)).join('-') });
  }

  return <form className="device-form" onSubmit={submit}>
    <fieldset><legend>هویت دستگاه</legend>
      {fields.slice(0, 2).map(([key, label]) => <label key={key}>{label}
        <input name={key} dir={key === 'ip' ? 'ltr' : undefined} defaultValue={device?.[key]} required maxLength={100} />
      </label>)}
      <label>نوع سیستم <select aria-label="نوع سیستم" name="type" defaultValue={device?.type ?? 'desktop'}>
        {Object.entries(deviceTypes).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
      </select></label>
      <label>وضعیت <select aria-label="وضعیت" value={online ? 'online' : 'offline'} onChange={event => setOnline(event.target.value === 'online')}>
        <option value="online">روشن</option><option value="offline">خاموش</option>
      </select></label>
    </fieldset>
    <fieldset><legend>کاربر جاری</legend>
      {fields.slice(2, 5).map(([key, label]) => <label key={key}>{label}
        <input name={key} defaultValue={device?.[key]} maxLength={key === 'access' ? 300 : 100} />
      </label>)}
    </fieldset>
    <fieldset><legend>مشخصات سیستم</legend>
      {specifications.map(([key, label]) => <label key={key}>{label}
        <input name={key} dir="auto" defaultValue={device?.[key]} maxLength={100} />
      </label>)}
    </fieldset>
    <fieldset disabled={!online}><legend>مصرف نمونهٔ منابع</legend>
      {metrics.map(([key, label]) => <label key={key}>{label} (درصد)
        <input name={key} type="number" min="0" max="100" step="1" defaultValue={device?.[key] ?? ''} />
      </label>)}
    </fieldset>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button primary" type="submit">ذخیرهٔ سیستم</button>
  </form>;
}

function DeviceCard({ device, onDetails, onUser }) {
  const Icon = icons[device.type];
  return <article className="card device-card">
    <div className="device-identity">
      <span className="device-icon"><Icon size={25} aria-hidden="true" /></span>
      <div><h2>{device.name}</h2><bdi dir="ltr" className="mono">{device.ip}</bdi><small>{deviceTypes[device.type]}</small></div>
      <Badge tone={device.online ? 'green' : 'muted'}>{device.online ? 'روشن' : 'خاموش'}</Badge>
    </div>
    <div className="device-metrics">
      {metrics.map(([key, label, Icon]) => {
        const value = device.online ? device[key] : null;
        return <div key={key}>
          <div className="device-metric-label"><span><Icon size={15} aria-hidden="true" />{label}</span>
            <strong>{value == null ? '—' : percent.format(value / 100)}</strong></div>
          <div className="device-meter">
            {value != null && <meter className={value >= 85 ? 'device-high' : undefined} aria-label={label} min={0} max={100} value={value} />}
          </div>
        </div>;
      })}
    </div>
    <div className="device-card-actions">
      <button className="button" onClick={onUser}><UserRound size={16} />{device.user || 'کاربر جاری'}</button>
      <button className="text-link device-details-link" onClick={onDetails}>جزئیات سیستم <ChevronLeft size={15} /></button>
    </div>
  </article>;
}

export default function DeviceHealth() {
  const [devices, setDevices] = useState(initialDevices);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [feedback, setFeedback] = useState('');
  const close = () => setDialog(null);
  const onlineCount = devices.filter(device => device.online).length;
  const search = query.trim().toLowerCase();
  const searchedIp = normalizeDeviceIp(search);
  const visible = devices.filter(device =>
    (status === 'all' || device.online === (status === 'online')) &&
    (device.ip === searchedIp || [device.name, device.ip, device.user]
      .some(value => (value ?? '').toLowerCase().includes(search))));

  function save(device) {
    const next = devices.some(item => item.id === device.id)
      ? devices.map(item => item.id === device.id ? device : item)
      : [...devices, device];
    setDevices(next);
    try {
      localStorage.setItem(deviceStorageKey, JSON.stringify(next));
      setFeedback('سیستم ذخیره شد.');
    } catch {
      setFeedback('سیستم برای این نشست ثبت شد. ذخیره‌سازی مرورگر در دسترس نیست.');
    }
    close();
  }

  return <div className="device-page">
    <div className="device-toolbar">
      <label className="device-search"><Search size={17} aria-hidden="true" />
        <input aria-label="جست‌وجوی سیستم" placeholder="جست‌وجو با نام، IP یا کاربر" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <select aria-label="فیلتر وضعیت" value={status} onChange={event => setStatus(event.target.value)}>
        <option value="all">همهٔ وضعیت‌ها</option><option value="online">روشن</option><option value="offline">خاموش</option>
      </select>
      <button className="button primary" onClick={() => setDialog({ mode: 'form' })}><Plus size={17} />ثبت سیستم</button>
    </div>
    <div className="device-summary">
      {[[Monitor, 'کل سیستم‌ها', devices.length], [Activity, 'روشن', onlineCount], [Monitor, 'خاموش', devices.length - onlineCount]]
        .map(([Icon, label, count]) => <div className="card" key={label}><Icon size={20} aria-hidden="true" />
          <span>{label}</span><strong>{number.format(count)}</strong></div>)}
    </div>
    {feedback && <p role="status" className="notice device-feedback">{feedback}</p>}
    <div className="device-grid">
      {visible.map(device => <DeviceCard key={device.id} device={device}
        onDetails={() => setDialog({ mode: 'details', device })}
        onUser={() => setDialog({ mode: 'user', device })} />)}
    </div>
    {visible.length === 0 && <p className="notice" role="status">سیستمی با این فیلترها پیدا نشد.</p>}
    {dialog?.mode === 'form' && <DeviceDialog title={dialog.device ? 'ویرایش سیستم' : 'ثبت سیستم جدید'} onClose={close}>
      <DeviceForm device={dialog.device} devices={devices} onSave={save} />
    </DeviceDialog>}
    {dialog?.mode === 'details' && <DeviceDialog title={dialog.device.name} onClose={close}>
      <dl className="device-detail-list">
        <div><dt>نشانی IP</dt><dd><bdi dir="ltr" className="mono">{dialog.device.ip}</bdi></dd></div>
        <div><dt>نوع سیستم</dt><dd>{deviceTypes[dialog.device.type]}</dd></div>
        <div><dt>وضعیت</dt><dd>{dialog.device.online ? 'روشن' : 'خاموش'}</dd></div>
        {specifications.map(([key, label]) => <div key={key}><dt>{label}</dt><dd><bdi>{dialog.device[key] || unset}</bdi></dd></div>)}
      </dl>
      <div className="device-dialog-actions">
        <button className="button" onClick={() => setDialog({ ...dialog, mode: 'user' })}>کاربر جاری</button>
        <button className="button primary" onClick={() => setDialog({ ...dialog, mode: 'form' })}>ویرایش سیستم</button>
      </div>
    </DeviceDialog>}
    {dialog?.mode === 'user' && <DeviceDialog title="کاربر جاری سیستم" onClose={close}>
      <dl className="device-detail-list">
        <div><dt>سیستم</dt><dd>{dialog.device.name}</dd></div>
        {fields.slice(2, 5).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{dialog.device[key] || unset}</dd></div>)}
      </dl>
    </DeviceDialog>}
  </div>;
}
