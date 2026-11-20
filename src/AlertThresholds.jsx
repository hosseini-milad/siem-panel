import { useState } from 'react';
import {
  Activity, Boxes, ChevronDown, CircleCheck, Clock3, Fingerprint, ListChecks, LockKeyhole, Monitor,
  Radio, RotateCcw, Save, ScanLine, Search, Shield, ShieldCheck, SlidersHorizontal, Timer, TriangleAlert, Workflow,
} from 'lucide-react';
import { liveApi } from './api.js';
import { Badge, displayValue, number, Resource, useResource } from './ui.jsx';

const webRules = [
  ['access_denied', 'A01', 'کنترل دسترسی', 'تکرار پاسخ 403 که به‌عنوان رد دسترسی ثبت شده است.', Shield, 'blue'],
  ['configuration', 'A02', 'پیکربندی', 'یافتهٔ بررسی سیاست پیکربندی.', SlidersHorizontal, 'purple'],
  ['supply_chain', 'A03', 'زنجیرهٔ تأمین', 'یافتهٔ CI/CD یا اسکن وابستگی.', Boxes, 'blue'],
  ['cryptography', 'A04', 'رمزنگاری', 'یافتهٔ پایش TLS یا سیاست رمزنگاری.', LockKeyhole, 'green'],
  ['injection', 'A05', 'تزریق', 'سیگنال مسدودسازی از WAF یا آشکارساز معتبر.', ScanLine, 'amber'],
  ['business_design', 'A06', 'منطق تجاری', 'نقض سیاست گردش‌کار که برنامه ثبت می‌کند.', Workflow, 'purple'],
  ['login_failure', 'A07', 'احراز هویت', 'شمار پاسخ 401 که به‌عنوان خطای ورود ثبت شده است.', Fingerprint, 'blue'],
  ['integrity', 'A08', 'یکپارچگی', 'شکست بررسی امضا یا یکپارچگی داده.', ShieldCheck, 'green'],
  ['logging_health', 'A09', 'سلامت ثبت رویداد', 'خطوط نامعتبر یا توقف دریافت heartbeat.', Radio, 'amber'],
  ['server_error', 'A10', 'شرایط استثنایی', 'شمار پاسخ‌های 5xx از شمارنده‌های هر سرویس.', TriangleAlert, 'red'],
];

const systemRules = [
  ['logon_failure', '4625', 'ورود ناموفق مکرر', 'شمار ورودهای ناموفق به‌ازای میزبان و مبدأ ورود یا حساب.', Fingerprint, 'blue'],
  ['account_lockout', '4740', 'قفل حساب کاربری', 'ثبت قفل حساب توسط Windows Security.', LockKeyhole, 'amber'],
  ['audit_log_cleared', '1102', 'پاک‌شدن لاگ امنیتی', 'Windows پاک‌شدن لاگ Security را گزارش کرده است.', Shield, 'red'],
  ['audit_policy_changed', '4719', 'تغییر سیاست ممیزی', 'ثبت تغییر سیاست Audit در Windows.', SlidersHorizontal, 'purple'],
  ['service_installed', '4697', 'نصب سرویس جدید', 'ثبت نصب سرویس در کانال Security.', Boxes, 'blue'],
];
const scopes = {
  web: {
    label: 'وب‌سرویس‌ها', Icon: ShieldCheck, rules: webRules,
    title: 'قواعد هشدار وب‌سرویس', description: 'مدیریت قواعد OWASP Top 10:2025 و ارزیابی تنظیمات ذخیره‌شده روی داده‌های جاری',
    evaluationPath: '/alerts/owasp/evaluate',
  },
  system: {
    label: 'سیستم‌عامل', Icon: Monitor, rules: systemRules,
    title: 'قواعد هشدار Windows Security', description: 'آستانه‌ها بر اساس رویدادهای کانال Security که Agent ارسال می‌کند ارزیابی می‌شوند.',
    evaluationPath: '/alerts/system/evaluate',
  },
};

const fields = [
  ['threshold', 'حد آستانه', 1, 500, ListChecks, 'رخداد'],
  ['window_minutes', 'پنجرهٔ شمارش', 1, 60, Clock3, 'دقیقه'],
  ['cooldown_minutes', 'وقفهٔ تکرار', 1, 1440, Timer, 'دقیقه'],
];
const statuses = [['all', 'همه'], ['enabled', 'فعال'], ['disabled', 'غیرفعال']];
const severities = ['low', 'medium', 'high', 'critical'];

function ThresholdRule({ definition, rule, expanded, onExpand, onChange, locked, invalidField }) {
  const [key, code, label, detail, Icon, tone] = definition;
  const id = `threshold-${key}`;
  return <article className="card threshold-rule" aria-labelledby={id} data-tone={tone}>
    <header className="threshold-rule-header">
      <span className="threshold-rule-icon"><Icon size={21} aria-hidden="true" /></span>
      <div className="threshold-rule-title">
        <bdi className="threshold-code">{code}</bdi>
        <h3 id={id}>{label}</h3>
      </div>
      <label className="threshold-switch" title={rule.enabled ? 'قاعده فعال است' : 'قاعده غیرفعال است'}>
        <input type="checkbox" role="switch" aria-label={`فعال بودن قاعدهٔ ${label}`} checked={rule.enabled}
          disabled={locked} onChange={event => onChange('enabled', event.target.checked)} />
        <span aria-hidden="true" />
      </label>
    </header>
    <p className="threshold-rule-detail">{detail}</p>
    <dl className="threshold-rule-values">
      {fields.map(([field, caption, , , Metric, unit]) => <div key={field}>
        <dt><Metric size={13} aria-hidden="true" />{caption}</dt>
        <dd>{rule[field] === '' ? '—' : number.format(rule[field])}<small>{unit}</small></dd>
      </div>)}
    </dl>
    <footer className="threshold-rule-footer">
      <Badge value={rule.severity} />
      <button type="button" className="button threshold-expand" aria-expanded={expanded}
        aria-controls={id + '-fields'} onClick={onExpand}>
        <SlidersHorizontal size={14} aria-hidden="true" /> تنظیمات
        <ChevronDown size={14} aria-hidden="true" />
      </button>
    </footer>
    <fieldset className="threshold-rule-fields" id={id + '-fields'} hidden={!expanded} disabled={locked}>
      <legend className="threshold-visually-hidden">تنظیمات {label}</legend>
      {fields.map(([field, caption, min, max, Metric, unit]) => <label key={field}>
        <span><Metric size={14} aria-hidden="true" />{caption} <small>({unit})</small></span>
        <input type="number" min={min} max={max} dir="ltr" value={rule[field]}
          aria-invalid={invalidField === field} onChange={event => onChange(field, event.target.value === '' ? '' : Number(event.target.value))} />
      </label>)}
      <label>
        <span><TriangleAlert size={14} aria-hidden="true" />شدت هشدار</span>
        <select value={rule.severity} onChange={event => onChange('severity', event.target.value)}>
          {severities.map(severity => <option key={severity} value={severity}>{displayValue(severity)}</option>)}
        </select>
      </label>
    </fieldset>
  </article>;
}

function ThresholdWorkspace({ data, canWrite, scope, settingsPath }) {
  const { Icon, rules, title, description, evaluationPath } = scopes[scope];
  const [saved, setSaved] = useState(data);
  const [draft, setDraft] = useState(data);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [invalid, setInvalid] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(false);

  const available = rules.filter(([key]) => draft[key]);
  const active = available.filter(([key]) => draft[key].enabled).length;
  const totals = { all: available.length, enabled: active, disabled: available.length - active };
  const changed = available.filter(([key]) => JSON.stringify(draft[key]) !== JSON.stringify(saved[key])).length;
  const query = search.trim().toLowerCase();
  const visible = available.filter(([key, code, label]) =>
    (filter === 'all' || draft[key].enabled === (filter === 'enabled')) &&
    [key, code, label].some(value => value.toLowerCase().includes(query)),
  );

  function change(key, field, value) {
    setDraft(current => ({ ...current, [key]: { ...current[key], [field]: value } }));
    setNotice(null);
    if (invalid?.key === key && invalid.field === field) setInvalid(null);
  }

  async function save(event) {
    event.preventDefault();
    setNotice(null);
    for (const [key, , label] of available) {
      const invalidInput = fields.find(([field, , min, max]) =>
        !Number.isInteger(draft[key][field]) || draft[key][field] < min || draft[key][field] > max);
      if (invalidInput) {
        const [field, caption, min, max] = invalidInput;
        setFilter('all');
        setSearch('');
        setExpanded(key);
        setInvalid({ key, field });
        setNotice({ error: `«${caption}» در قاعدهٔ ${label} باید عددی صحیح بین ${number.format(min)} و ${number.format(max)} باشد.` });
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await liveApi(settingsPath, { method: 'PUT', body: draft });
      setSaved(updated);
      setDraft(updated);
      setNotice({ message: 'آستانه‌ها ذخیره شدند.' });
    } catch (failure) {
      setNotice({ error: failure.status === 422 ? 'مقادیر آستانه را بررسی کنید.' : failure.message });
    } finally {
      setSaving(false);
    }
  }

  async function evaluate() {
    setEvaluating(true);
    setEvaluation(null);
    try {
      setEvaluation(await liveApi(evaluationPath, { method: 'POST' }));
    } catch (failure) {
      setEvaluation({ error: failure.message });
    } finally {
      setEvaluating(false);
    }
  }

  function reset() {
    setDraft(saved);
    setInvalid(null);
    setNotice(null);
  }

  return <form className="threshold-workspace" onSubmit={save} noValidate>
    <section className="card threshold-overview" aria-labelledby={`threshold-overview-${scope}`}>
      <div className="threshold-overview-heading">
        <span className="threshold-overview-icon"><Icon size={27} aria-hidden="true" /></span>
        <div>
          <h2 id={`threshold-overview-${scope}`}>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {canWrite && <button type="button" className="button threshold-evaluate" disabled={evaluating || saving} onClick={evaluate}>
        <Activity size={17} aria-hidden="true" />{evaluating ? 'در حال ارزیابی…' : 'ارزیابی داده‌های جاری'}
      </button>}
    </section>
    {evaluation?.error && <p className="notice error threshold-feedback" role="alert"><TriangleAlert size={17} />{evaluation.error}</p>}
    {evaluation && !evaluation.error && <p className="notice threshold-feedback" role="status"><CircleCheck size={17} aria-hidden="true" />
      {evaluation.items
        ? `${number.format(evaluation.items.length)} سرویس ارزیابی شد و ${number.format(evaluation.alerts_created)} هشدار جدید ثبت شد.`
        : `${number.format(evaluation.matched_events)} رویداد منطبق و ${number.format(evaluation.alerts_created)} هشدار جدید.`}
      {(evaluation.request_rules_skipped || evaluation.items?.some(item => item.request_rules_skipped)) && ' بعضی قواعد درخواست به دلیل حجم زیاد اجرا نشدند.'}
    </p>}
    <div className="threshold-toolbar">
      <div className="threshold-filters explorer-tabs" aria-label="فیلتر وضعیت قواعد">
        {statuses.map(([status, label]) => <button key={status} type="button" className="button"
          aria-pressed={filter === status} onClick={() => setFilter(status)}>{label}
          <span className="threshold-filter-count">{number.format(totals[status])}</span>
        </button>)}
      </div>
      <label className="threshold-search"><Search size={17} aria-hidden="true" />
        <input type="search" aria-label="جست‌وجوی قاعده" placeholder="نام یا کد قاعده" value={search}
          onChange={event => setSearch(event.target.value)} />
      </label>
    </div>
    <div className="threshold-grid">
      {visible.map(definition => {
        const [key] = definition;
        return <ThresholdRule key={key} definition={definition} rule={draft[key]} expanded={expanded === key}
          locked={!canWrite || saving} invalidField={invalid?.key === key ? invalid.field : undefined}
          onExpand={() => setExpanded(current => current === key ? null : key)}
          onChange={(field, value) => change(key, field, value)} />;
      })}
    </div>
    {!visible.length && <p className="card notice" role="status">قاعده‌ای با این فیلتر پیدا نشد.</p>}
    {notice && <p className={`notice threshold-feedback${notice.error ? ' error' : ''}`} role={notice.error ? 'alert' : 'status'}>
      {notice.error ? <TriangleAlert size={17} aria-hidden="true" /> : <CircleCheck size={17} aria-hidden="true" />}
      {notice.error ?? notice.message}
    </p>}
    {canWrite && <footer className="card threshold-savebar" data-dirty={changed > 0}>
      <span><ListChecks size={17} aria-hidden="true" />
        {changed ? `${number.format(changed)} قاعده با تغییر ذخیره‌نشده` : 'همهٔ تغییرات ذخیره شده‌اند'}
      </span>
      <div>
        <button type="button" className="button" disabled={!changed || saving} onClick={reset}>
          <RotateCcw size={15} aria-hidden="true" /> بازگردانی
        </button>
        <button type="submit" className="primary" disabled={!changed || saving}>
          <Save size={15} aria-hidden="true" /> {saving ? 'در حال ذخیره…' : 'ذخیرهٔ آستانه‌ها'}
        </button>
      </div>
    </footer>}
  </form>;
}

function ThresholdScope({ scope, canWrite }) {
  const settingsPath = '/alerts/settings/' + scope;
  const result = useResource(settingsPath, {}, 0, liveApi);
  return <Resource result={result}>{data =>
    <ThresholdWorkspace data={data} canWrite={canWrite} scope={scope} settingsPath={settingsPath} />
  }</Resource>;
}

export default function AlertThresholds({ canWrite }) {
  const [scope, setScope] = useState('web');
  const [visited, setVisited] = useState(['web']);
  return <div className="stack">
    <div className="explorer-tabs" aria-label="منبع قواعد هشدار">
      {Object.entries(scopes).map(([key, { label, Icon }]) =>
        <button key={key} type="button" className="button" aria-pressed={scope === key} onClick={() => {
          setScope(key);
          setVisited(current => current.includes(key) ? current : [...current, key]);
        }}>
          <Icon size={16} aria-hidden="true" /> {label}
        </button>)}
    </div>
    {visited.map(key => <div key={key} hidden={scope !== key}><ThresholdScope scope={key} canWrite={canWrite} /></div>)}
  </div>;
}
