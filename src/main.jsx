import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownToLine, BellRing, CalendarDays, ChevronLeft, CircleHelp, Database, FolderOpen, Kanban, Columns3,
  LayoutDashboard, LogOut, Network, Menu, Monitor, Moon, UsersRound, ScanLine, Search, Server, Settings, Shield, Sparkles, Sun, X,
} from 'lucide-react';
import '@fontsource-variable/vazirmatn';
import Overview from './Overview.jsx';
import Alerts from './Alerts.jsx';
import AvatarUpload from './Avatar.jsx';
import Tasks, { TaskColumns } from './Tasks.jsx';
import Users, { canAccess, Login, roleLabels } from './Access.jsx';
import { liveApi } from './api.js';
import DeviceHealth, { Systems } from './DeviceHealth.jsx';
import Explorer from './Explorer.jsx';
import CurrentModel from './CurrentModel.jsx';
import { Analytics, Events, Ingestion, System, Worklist } from './Pages.jsx';
import { Resource, useResource } from './ui.jsx';
import './style.css';

const icons = {
  overview: LayoutDashboard, ingestion: ArrowDownToLine, events: Search, explorer: Database, detections: ScanLine,
  alerts: BellRing, incidents: FolderOpen, analytics: Sparkles, 'current-model': Network, system: Settings,
  systems: Server, 'device-health': Monitor, users: UsersRound, tasks: Kanban, 'task-columns': Columns3,
};
const descriptions = {
  overview: 'نمای متمرکز فعالیت‌ها و وضعیت امنیتی سامانه',
  ingestion: 'ثبت گروهی و بررسی آخرین لاگ‌های دریافتی',
  events: 'مرور و فیلتر رویدادهای عملیاتی',
  explorer: 'بررسی روزانهٔ داده‌های شبکه، سیستم‌ها و لاگ‌ها',
  detections: 'مشاهده و فعال‌سازی قواعد تشخیص',
  alerts: 'پیگیری هشدارهای امنیتی و تغییر وضعیت آن‌ها',
  incidents: 'مدیریت وضعیت پرونده‌های بررسی',
  analytics: 'وضعیت آماده‌سازی داده و مدل‌های تشخیص',
  'current-model': 'ساختار، ویژگی‌ها و قرارداد ورودی مدل فعال',
  system: 'سلامت مؤلفه‌ها و تنظیمات سرویس',
  systems: 'فهرست فقط‌خواندنی سیستم‌های شناسایی‌شده توسط Agent',
  tasks: 'ثبت و پیگیری کارهای ارجاع‌شده در تابلوی کانبان',
  'task-columns': 'ترتیب ستون‌ها و مجوز مشاهدهٔ تسک‌های هر ستون',
  users: 'تعریف حساب‌ها، وضعیت کاربران و مجوزهای دسترسی',
  'device-health': 'وضعیت و مصرف واقعی منابع دستگاه‌های متصل',
};
const readRoute = () => {
  const id = window.location.hash.slice(1);
  return Object.hasOwn(icons, id) ? id : '';
};
function initialTheme() {
  const saved = localStorage.getItem('siem-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function App() {
  const [theme, setTheme] = useState(initialTheme);
  const [session, setSession] = useState({ loading: true });
  const [retry, setRetry] = useState(0);
  const setUser = useCallback(user => setSession({ user }), []);
  const endSession = useCallback(() => setSession({}), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#11111a' : '#f7f7fc';
    localStorage.setItem('siem-theme', theme);
  }, [theme]);

  useEffect(() => {
    let running = true;
    liveApi('/auth/me').then(user => {
      if (running) setSession({ user });
    }, error => {
      if (running) setSession(error.status === 401 ? {} : { error: error.message });
    });
    return () => { running = false; };
  }, [retry]);

  const themeControl = <button className="icon-button" type="button" aria-label={theme === 'dark' ? 'تم روشن' : 'تم تیره'}
    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
    {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
  </button>;
  if (session.loading) return <main><p className="notice" role="status">در حال بررسی نشست…</p></main>;
  if (session.error) return <main><p className="notice error" role="alert">{session.error}</p>
    <button className="button" onClick={() => { setSession({ loading: true }); setRetry(value => value + 1); }}>تلاش دوباره</button></main>;
  if (!session.user) return <Login onLogin={setUser} themeControl={themeControl} />;

  return <Workspace key={session.user.id} user={session.user} themeControl={themeControl}
    setUser={setUser} endSession={endSession} />;
}

function Workspace({ user, themeControl, setUser, endSession }) {
  const [requested, setRoute] = useState(readRoute);
  const [drawer, setDrawer] = useState(false);
  const [hours, setHours] = useState(24);
  const [logout, setLogout] = useState({ pending: false, error: '' });
  const navigation = useResource('/system/navigation', {}, JSON.stringify([user.permissions, user.task_access]), liveApi);
  const menus = (navigation.data?.menus ?? []).filter(menu => canAccess(user, menu.id) || (menu.id === 'tasks' && user.task_access));
  const current = menus.find(menu => menu.id === requested) ?? menus[0];
  const route = current?.id;
  const title = current?.label ?? 'فضای کاری';
  const permitted = section => menus.some(menu => menu.id === section);
  const write = route && canAccess(user, route, true);

  useEffect(() => {
    function navigate() {
      setRoute(readRoute());
      setDrawer(false);
      window.scrollTo(0, 0);
    }
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  useEffect(() => {
    let active = true;
    function refresh() {
      liveApi('/auth/me').then(currentUser => {
        if (active) setUser(currentUser);
      }, error => {
        if (active && error.status === 401) endSession();
      });
    }
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('siem-session-ended', endSession);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('siem-session-ended', endSession);
    };
  }, [setUser, endSession]);

  async function signOut() {
    setLogout({ pending: true, error: '' });
    try {
      await liveApi('/auth/logout', { method: 'POST' });
      endSession();
    } catch (error) {
      setLogout({ pending: false, error: error.message });
    }
  }

  useEffect(() => {
    if (!drawer) return;
    function close(event) { if (event.key === 'Escape') setDrawer(false); }
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [drawer]);

  return <div className="shell">
    {drawer && <button className="overlay" aria-label="بستن منو" onClick={() => setDrawer(false)} />}
    <aside id="sidebar" className={`sidebar ${drawer ? 'is-open' : ''}`}>
      <div className="brand"><span className="brand-icon"><Shield size={23} /></span>
        <div><strong dir="ltr">SIEM</strong><small>مرکز عملیات امنیت</small></div>
        <button className="icon-button drawer-close" aria-label="بستن نوار کناری" onClick={() => setDrawer(false)}><X size={18} /></button>
      </div>
      <nav aria-label="منوی اصلی">
        <p className="nav-label">فضای کاری</p>
        <Resource result={navigation}>{() => menus.map(({ id, label, parent }) => {
          const Icon = icons[id] ?? CircleHelp;
          return <a key={id} className={parent && permitted(parent) ? 'nav-child' : undefined} href={'#' + id} aria-current={route === id ? 'page' : undefined}
              onClick={() => setDrawer(false)}><Icon size={19} strokeWidth={1.8} />{label}</a>;
        })}</Resource>
      </nav>
      <div className="sidebar-foot"><span className="demo-icon"><Shield size={16} /></span><div><strong>محیط نمونه</strong><small>داده‌های آزمایشی</small></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="breadcrumbs">
          <button className="icon-button drawer-trigger" aria-controls="sidebar" aria-expanded={drawer}
            aria-label="باز کردن منو" onClick={() => setDrawer(true)}><Menu size={20} /></button>
          <span>مرکز عملیات امنیت</span><ChevronLeft size={15} />{route === 'current-model' && permitted('analytics') && <><a href="#analytics">تحلیل هوشمند</a><ChevronLeft size={15} /></>}
          <strong>{title}</strong>
        </div>
        <div className="top-actions">
          <AvatarUpload user={user} onSave={setUser} />
          <div className="session-label"><strong>{user.name}</strong><small>{roleLabels[user.role]}</small></div>
          {themeControl}
          <button className="icon-button" type="button" aria-label="خروج" title="خروج" disabled={logout.pending} onClick={signOut}><LogOut size={18} /></button>
        </div>
      </header>
      <main id="main">
        {logout.error && <p className="notice error" role="alert">{logout.error}</p>}
        {!route && <Resource result={navigation}>{() => <p className="notice">مدیریت کل هنوز دسترسی‌ای برای این حساب تعیین نکرده است.</p>}</Resource>}
        {route && <header className="page-heading">
          <div><h1>{title}</h1><p>{descriptions[route]}</p></div>
          {route === 'overview' && <label className="range"><CalendarDays size={17} />
            <select aria-label="بازهٔ زمانی" value={hours} onChange={event => setHours(Number(event.target.value))}>
              <option value="24">۲۴ ساعت اخیر</option><option value="168">۷ روز اخیر</option><option value="720">۳۰ روز اخیر</option>
            </select>
          </label>}
        </header>}
        {route === 'overview' && <Overview hours={hours} showEvents={permitted('events')} />}
        {route === 'ingestion' && <Ingestion canWrite={write} />}
        {route === 'events' && <Events />}
        {route === 'explorer' && <Explorer />}
        {route === 'alerts' && <Alerts canWrite={write} />}
        {['detections', 'incidents'].includes(route) && <Worklist key={route} mode={route} canWrite={write} />}
        {route === 'analytics' && <Analytics showCurrentModel={permitted('current-model')} canWrite={write} />}
        {route === 'current-model' && <CurrentModel canWrite={write} showAnalytics={permitted('analytics')} />}
        {route === 'system' && <System />}
        {route === 'systems' && <Systems />}
        {route === 'device-health' && <DeviceHealth user={user} canWrite={write && user.role !== 'client'} />}
        {route === 'users' && <Users user={user} />}
        {route === 'tasks' && <Tasks user={user} />}
        {route === 'task-columns' && <TaskColumns canWrite={write} />}
      </main>
    </div>
  </div>;
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
