import { useState } from 'react';
import { Building2, LogIn, Pencil, Shield, ShieldCheck, UserRound, UserRoundPlus, UserRoundX } from 'lucide-react';
import { liveApi } from './api.js';
import SystemFields, { systemValues } from './SystemFields.jsx';
import { Badge, Card, Pagination, Resource, Table, useResource } from './ui.jsx';

export const roleLabels = { client: 'کلاینت', admin: 'ادمین', manager: 'مدیریت کل' };
const sections = {
  overview: 'نمای کلی', ingestion: 'ورود و پردازش', events: 'جست‌وجوی رویدادها', explorer: 'کاوش داده‌ها',
  detections: 'قواعد تشخیص', alerts: 'هشدارها', incidents: 'رخدادهای امنیتی', analytics: 'تحلیل هوشمند',
  'current-model': 'مدل جاری', system: 'سامانه', 'device-health': 'سلامت سیستم‌ها', users: 'کاربران', tasks: 'تسک‌ها', 'task-columns': 'مدیریت ستون تسک‌ها',
};
const writable = new Set(['ingestion', 'detections', 'alerts', 'incidents', 'analytics', 'current-model', 'device-health', 'users', 'tasks', 'task-columns']);

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
    {Object.entries(sections).filter(([id]) => role !== 'client' || !['users', 'task-columns'].includes(id)).map(([id, label]) =>
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

function BranchForm({ user, onSave }) {
  const [branch, setBranch] = useState(user.branch ?? '');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({});
  async function save(event) {
    event.preventDefault();
    setFeedback({});
    setBusy(true);
    try {
      const updated = await liveApi('/auth/branch', { method: 'PATCH', body: { branch: branch.trim() } });
      setBranch(updated.branch);
      onSave();
      setFeedback({ message: 'نام شاخه ذخیره شد.' });
    } catch (error) {
      setFeedback({ error: error.message });
    } finally {
      setBusy(false);
    }
  }
  return <Card title="شاخهٔ شما">
    <form className="account-form user-editor" onSubmit={save}>
      <label>نام شاخه<input value={branch} onChange={event => setBranch(event.target.value)} required maxLength={100} /></label>
      {feedback.error && <p className="notice error" role="alert">{feedback.error}</p>}
      {feedback.message && <p className="notice" role="status">{feedback.message}</p>}
      <div><button className="button" disabled={busy}><Building2 size={16} />ذخیرهٔ شاخه</button></div>
    </form>
  </Card>;
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
    const { username, name, password, branch } = values;
    const role = editor === 'new' ? newRole : editor.role;
    const body = {
      username: username.trim(), name: name.trim(),
      ...(role === 'client' ? { system: systemValues(values) } : {}),
      ...(manager ? { permissions: getPermissions(values) } : {}),
      ...(role === 'admin' && branch.trim() ? { branch: branch.trim() } : {}),
    };
    if (editor === 'new') update('/users', 'POST', { ...body, password });
    else update('/users/' + editor.id, 'PATCH', body);
  }

  const columns = [
    { key: 'name', label: 'کاربر', render: row => <div className="account-identity"><UserRound size={17} />
      <div><strong>{row.name}</strong><small className="row-detail"><bdi dir="ltr">{row.username}</bdi></small></div></div> },
    { key: 'role', label: 'نقش', render: row => roleLabels[row.role] },
    { key: 'branch', label: 'شاخه', render: row => row.branch || '—' },
    { key: 'device', label: 'سیستم', render: row => row.role === 'client' ? <div>
      <span>{row.system?.name || row.name}</span>
      {(row.system?.ip || row.system?.mac) && <small className="row-detail"><bdi dir="ltr">{row.system.ip || row.system.mac}</bdi></small>}
    </div> : '—' },
    { key: 'active', label: 'وضعیت', render: row => <Badge tone={row.active ? 'green' : 'muted'}>{row.active ? 'فعال' : 'غیرفعال'}</Badge> },
    ...(write ? [{ key: 'actions', label: 'عملیات', render: row => <div className="account-actions">
      <button className="button" disabled={busy} onClick={() => {
        setFeedback({});
        setEditor(row);
      }}><Pencil size={15} />ویرایش کاربر</button>
      <button className={`button ${row.active ? 'account-disable' : ''}`} disabled={busy} onClick={() => {
        if (row.active && !window.confirm(`حساب «${row.name}» غیرفعال شود؟`)) return;
        update('/users/' + row.id, 'PATCH', { active: !row.active });
      }}>{row.active ? <UserRoundX size={15} /> : <ShieldCheck size={15} />}{row.active ? 'غیرفعال‌کردن' : 'فعال‌کردن'}</button>
    </div> }] : []),
  ];

  const editorRole = editor === 'new' ? newRole : editor?.role;
  return <div className="stack">
    {!manager && <BranchForm user={user} onSave={() => setRevision(value => value + 1)} />}
    <Card title="حساب‌های کاربری" action={write && <button className="button primary" disabled={busy}
      onClick={() => { setFeedback({}); setEditor('new'); }}><UserRoundPlus size={17} />تعریف {roleLabels[newRole]}</button>}>
      {feedback.error && !editor && <p className="notice error" role="alert">{feedback.error}</p>}
      {feedback.message && <p className="notice" role="status">{feedback.message}</p>}
      <Resource result={list}>{data => <><Table columns={columns} rows={data.items} empty="حسابی ثبت نشده است." />
        <Pagination page={data} onOffset={setOffset} /></>}</Resource>
    </Card>
    {editor && <Card title={editor === 'new' ? 'تعریف ' + roleLabels[newRole] : 'ویرایش ' + editor.name}>
      <form key={editor.id ?? 'new'} className="account-form user-editor" onSubmit={save}>
        <div className="account-fields">
          <label>نام نمایشی<input name="name" required maxLength={100} defaultValue={editor.name ?? ''} /></label>
          <label>نام کاربری<input name="username" dir="ltr" autoComplete="off" required minLength={3} maxLength={64}
            pattern="[A-Za-z0-9_.\-]+" defaultValue={editor.username ?? ''} /></label>
          {editor === 'new' && <label>رمز عبور<input name="password" dir="ltr" type="password" autoComplete="new-password"
            required minLength={12} maxLength={128} /><small>حداقل ۱۲ نویسه</small></label>}
          {editorRole === 'admin' && <label>نام شاخه<input name="branch" defaultValue={editor.branch ?? ''} maxLength={100} /></label>}
        </div>
        {editorRole === 'client' && <SystemFields profile={editor.system} />}
        {manager && <Permissions role={editorRole} selected={editor.permissions} />}
        {feedback.error && <p className="notice error" role="alert">{feedback.error}</p>}
        <div className="account-actions"><button className="button primary" disabled={busy}>ذخیره</button>
          <button type="button" className="button" disabled={busy} onClick={() => { setEditor(null); setFeedback({}); }}>انصراف</button></div>
      </form>
    </Card>}
  </div>;
}
