import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownToLine, BellRing, CalendarDays, ChevronLeft, CircleHelp, Database, FolderOpen,
  LayoutDashboard, Network, Menu, Monitor, Moon, ScanLine, Search, Settings, Shield, Sparkles, Sun, X,
} from 'lucide-react';
import '@fontsource-variable/vazirmatn';
import Overview from './Overview.jsx';
import DeviceHealth from './DeviceHealth.jsx';
import Explorer from './Explorer.jsx';
import CurrentModel from './CurrentModel.jsx';
import { Analytics, Events, Ingestion, System, Worklist } from './Pages.jsx';
import { Resource, useResource } from './ui.jsx';
import './style.css';

const icons = {
  overview: LayoutDashboard, ingestion: ArrowDownToLine, events: Search, explorer: Database, detections: ScanLine,
  alerts: BellRing, incidents: FolderOpen, analytics: Sparkles, 'current-model': Network, system: Settings, 'device-health': Monitor,
};
const descriptions = {
  overview: 'نمای متمرکز فعالیت‌ها و وضعیت امنیتی سامانه',
  ingestion: 'ثبت گروهی و بررسی آخرین لاگ‌های دریافتی',
  events: 'مرور و فیلتر رویدادهای عملیاتی',
  explorer: 'بررسی روزانهٔ داده‌های شبکه و لاگ‌ها',
  detections: 'مشاهده و فعال‌سازی قواعد تشخیص',
  alerts: 'پیگیری هشدارهای امنیتی و تغییر وضعیت آن‌ها',
  incidents: 'مدیریت وضعیت پرونده‌های بررسی',
  analytics: 'وضعیت آماده‌سازی داده و مدل‌های تشخیص',
  'current-model': 'ساختار، ویژگی‌ها و قرارداد ورودی مدل فعال',
  system: 'سلامت مؤلفه‌ها و تنظیمات سرویس',
  'device-health': 'وضعیت و مصرف منابع دستگاه‌ها · داده‌های ماک',
};
const readRoute = () => {
  const id = window.location.hash.slice(1);
  return Object.hasOwn(icons, id) ? id : 'overview';
};
function initialTheme() {
  const saved = localStorage.getItem('siem-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function App() {
  const [route, setRoute] = useState(readRoute);
  const [theme, setTheme] = useState(initialTheme);
  const [drawer, setDrawer] = useState(false);
  const [hours, setHours] = useState(24);
  const navigation = useResource('/system/navigation');
  const menus = (navigation.data?.menus ?? []).flatMap(menu => menu.id === 'events'
    ? [menu, { id: 'explorer', label: 'کاوش داده‌ها' }]
    : menu.id === 'analytics' ? [menu, { id: 'current-model', label: 'مدل جاری', parent: 'analytics' }]
    : menu.id === 'system' ? [menu, { id: 'device-health', label: 'سلامت سیستم‌ها', parent: 'system' }]
    : [menu]);
  const current = menus.find(menu => menu.id === route);
  const title = current?.label ?? ({ 'current-model': 'مدل جاری', 'device-health': 'سلامت سیستم‌ها' }[route] ?? 'نمای کلی');

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
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#11111a' : '#f7f7fc';
    localStorage.setItem('siem-theme', theme);
  }, [theme]);

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
          return <a key={id} className={parent ? 'nav-child' : undefined} href={'#' + id} aria-current={route === id ? 'page' : undefined}
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
          <span>مرکز عملیات امنیت</span><ChevronLeft size={15} />{route === 'current-model' && <><a href="#analytics">تحلیل هوشمند</a><ChevronLeft size={15} /></>}
          <strong>{title}</strong>
        </div>
        <div className="top-actions">
          <span className="mock-chip"><i /> {['explorer', 'current-model'].includes(route) ? 'API واقعی' : 'حالت ماک'}</span>
          <button className="icon-button" type="button" aria-label={theme === 'dark' ? 'تم روشن' : 'تم تیره'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>
      </header>
      <main id="main">
        <header className="page-heading">
          <div><h1>{title}</h1><p>{descriptions[route]}</p></div>
          {route === 'overview' && <label className="range"><CalendarDays size={17} />
            <select aria-label="بازهٔ زمانی" value={hours} onChange={event => setHours(Number(event.target.value))}>
              <option value="24">۲۴ ساعت اخیر</option><option value="168">۷ روز اخیر</option><option value="720">۳۰ روز اخیر</option>
            </select>
          </label>}
        </header>
        {route === 'overview' && <Overview hours={hours} />}
        {route === 'ingestion' && <Ingestion />}
        {route === 'events' && <Events />}
        {route === 'explorer' && <Explorer />}
        {['detections', 'alerts', 'incidents'].includes(route) && <Worklist key={route} mode={route} />}
        {route === 'analytics' && <Analytics />}
        {route === 'current-model' && <CurrentModel />}
        {route === 'system' && <System />}
        {route === 'device-health' && <DeviceHealth />}
      </main>
    </div>
  </div>;
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
