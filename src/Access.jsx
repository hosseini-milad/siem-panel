import { useState } from 'react';
import { KeyRound, LogIn, Shield, ShieldCheck, UserRound, UserRoundPlus, UserRoundX } from 'lucide-react';
import { liveApi } from './api.js';
import { loadDevices } from './deviceHealth.js';
import { Badge, Card, Pagination, Resource, Table, useResource } from './ui.jsx';

export const roleLabels = { client: 'کلاینت', admin: 'ادمین', manager: 'مدیریت کل' };
const sections = {
  overview: 'نمای کلی', ingestion: 'ورود و پردازش', events: 'جست‌وجوی رویدادها', explorer: 'کاوش داده‌ها',
  detections: 'قواعد تشخیص', alerts: 'هشدارها', incidents: 'رخدادهای امنیتی', analytics: 'تحلیل هوشمند',
  'current-model': 'مدل جاری', system: 'سامانه', 'device-health': 'سلامت سیستم‌ها', users: 'کاربران',
};
const writable = new Set(['ingestion', 'detections', 'alerts', 'incidents', 'analytics', 'current-model', 'device-health', 'users']);

export function canAccess(user, section, write = false) {
  const grant = user.permissions[section];
  return user.role === 'manager' || grant === 'write' || (!write && grant === 'read');
}

export function Login({ onLogin, themeControl }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    setPending(true);
    try {
      onLogin(await liveApi('/auth/login', { method: 'POST', body }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }
  return <main className="login-screen">
    <div className="login-theme">{themeControl}</div>
    <section className="card login-card" aria-labelledby="login-title">
      <div className="login-brand"><span className="brand-icon"><Shield size={24} /></span><div><strong dir="ltr">SIEM</strong><small>مرکز عملیات امنیت</small></div></div>
      <h1 id="login-title">ورود به پنل</h1>
      <form className="account-form" onSubmit={submit}>
        <label>نام کاربری <input name="username" dir="ltr" autoComplete="username" required minLength={3} maxLength={64} /></label>
        <label>رمز عبور <input name="password" dir="ltr" type="password" autoComplete="current-password" required maxLength={128} /></label>
        {error && <p className="notice error" role="alert">{error}</p>}
        <button className="button primary" disabled={pending}><LogIn size={17} />{pending ? 'در حال ورود…' : 'ورود'}</button>
      </form>
    </section>
  </main>;
}

function Permissions({ role, selected = {} }) {
  return <fieldset className="account-permissions">
    <legend>دسترسی به بخش‌ها</legend>
    {Object.entries(sections).filter(([id]) => role !== 'client' || id !== 'users').map(([id, label]) =>
      <label key={id}>{label}
        <select aria-label={label} name={'grant-' + id} defaultValue={selected[id] ?? ''}>
          <option value="">بدون دسترسی</option>
          <option value="read">مشاهده</option>
          {writable.has(id) && !(role === 'client' && id === 'device-health') && <option value="write">مشاهده و انجام عملیات</option>}
        </select>
      </label>)}
  </fieldset>;
}

function getPermissions(values) {
  return Object.fromEntries(Object.entries(values)
    .filter(([key, value]) => key.startsWith('grant-') && value)
    .map(([key, value]) => [key.slice(6), value]));
}

export default function Users({ user }) {
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [busy, setBusy] = useState(false);
  const manager = user.role === 'manager';
  const write = canAccess(user, 'users', true);
  const newRole = manager ? 'admin' : 'client';
  const devices = loadDevices();
  const list = useResource('/users', { offset }, revision, liveApi);

  async function update(path, method, body) {
    setFeedback({});
    setBusy(true);
    try {
      await liveApi(path, { method, body });
      if (method === 'POST') setOffset(0);
      setRevision(value => value + 1);
      setEditor(null);
      setFeedback({ message: 'تغییرات ذخیره شد.' });
    } catch (error) {
      setFeedback({ error: error.message });
    } finally {
      setBusy(false);
    }
  }

  function save(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (editor !== 'new') {
      update('/users/' + editor.id, 'PATCH', { permissions: getPermissions(values) });
      return;
    }
    const { username, name, password, device_id } = values;
    update('/users', 'POST', { username, name, password,
      ...(manager ? { permissions: getPermissions(values) } : { device_id }) });
  }

  const columns = [
    { key: 'name', label: 'کاربر', render: row => <div className="account-identity"><UserRound size={17} />
      <div><strong>{row.name}</strong><small className="row-detail"><bdi dir="ltr">{row.username}</bdi></small></div></div> },
    { key: 'role', label: 'نقش', render: row => roleLabels[row.role] },
    { key: 'device', label: 'سیستم', render: row => row.device_id
      ? devices.find(device => device.id === row.device_id)?.name ?? <bdi>{row.device_id}</bdi> : '—' },
    { key: 'active', label: 'وضعیت', render: row => <Badge tone={row.active ? 'green' : 'muted'}>{row.active ? 'فعال' : 'غیرفعال'}</Badge> },
    ...(write ? [{ key: 'actions', label: 'عملیات', render: row => <div className="account-actions">
      {manager && <button className="button" disabled={busy} onClick={() => {
        setFeedback({});
        setEditor(row);
      }}><KeyRound size={15} />دسترسی‌ها</button>}
      <button className={`button ${row.active ? 'account-disable' : ''}`} disabled={busy} onClick={() => {
        if (row.active && !window.confirm(`حساب «${row.name}» غیرفعال شود؟`)) return;
        update('/users/' + row.id, 'PATCH', { active: !row.active });
      }}>{row.active ? <UserRoundX size={15} /> : <ShieldCheck size={15} />}{row.active ? 'غیرفعال‌کردن' : 'فعال‌کردن'}</button>
    </div> }] : []),
  ];

  return <div className="stack">
    <Card title="حساب‌های کاربری" action={write && <button className="button primary" disabled={busy}
      onClick={() => { setFeedback({}); setEditor('new'); }}><UserRoundPlus size={17} />تعریف {roleLabels[newRole]}</button>}>
      {feedback.error && !editor && <p className="notice error" role="alert">{feedback.error}</p>}
      {feedback.message && <p className="notice" role="status">{feedback.message}</p>}
      <Resource result={list}>{data => <><Table columns={columns} rows={data.items} empty="حسابی ثبت نشده است." />
        <Pagination page={data} onOffset={setOffset} /></>}</Resource>
    </Card>
    {editor && <Card title={editor === 'new' ? 'تعریف ' + roleLabels[newRole] : 'دسترسی‌های ' + editor.name}>
      <form key={editor.id ?? 'new'} className="account-form user-editor" onSubmit={save}>
        {editor === 'new' && <div className="account-fields">
          <label>نام نمایشی<input name="name" required maxLength={100} /></label>
          <label>نام کاربری<input name="username" dir="ltr" autoComplete="off" required minLength={3} maxLength={64} pattern="[A-Za-z0-9_.\\-]+" /></label>
          <label>رمز عبور<input name="password" dir="ltr" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
            <small>حداقل ۱۲ نویسه</small></label>
          {!manager && <label>سیستم سلامت<select aria-label="سیستم سلامت" name="device_id" required defaultValue="">
            <option value="" disabled>انتخاب سیستم</option>
            {devices.map(device => <option key={device.id} value={device.id}>{device.name} · {device.ip}</option>)}
          </select></label>}
        </div>}
        {manager && <Permissions role={editor === 'new' ? newRole : editor.role} selected={editor.permissions} />}
        {feedback.error && <p className="notice error" role="alert">{feedback.error}</p>}
        <div className="account-actions"><button className="button primary" disabled={busy}>ذخیره</button>
          <button type="button" className="button" disabled={busy} onClick={() => { setEditor(null); setFeedback({}); }}>انصراف</button></div>
      </form>
    </Card>}
  </div>;
}
