import { useState } from 'react';
import { liveApi } from './api.js';
import { Card, displayValue, number, Resource, useResource } from './ui.jsx';

const rules = [
  ['access_denied', 'A01 · کنترل دسترسی', 'تکرار 403 علامت‌خورده به‌عنوان رد دسترسی'],
  ['configuration', 'A02 · پیکربندی', 'نتیجهٔ بررسی سیاست پیکربندی'],
  ['supply_chain', 'A03 · زنجیرهٔ تأمین', 'یافتهٔ CI/CD یا اسکن وابستگی'],
  ['cryptography', 'A04 · رمزنگاری', 'یافتهٔ پایش TLS یا سیاست رمزنگاری'],
  ['injection', 'A05 · تزریق', 'سیگنال مسدودسازی از WAF یا آشکارساز معتبر'],
  ['business_design', 'A06 · منطق تجاری', 'نقض سیاست گردش‌کار که برنامه ثبت می‌کند'],
  ['login_failure', 'A07 · احراز هویت', 'شمار 401 علامت‌خورده به‌عنوان خطای ورود'],
  ['integrity', 'A08 · یکپارچگی', 'شکست بررسی امضا یا یکپارچگی داده'],
  ['logging_health', 'A09 · سلامت ثبت رویداد', 'آستانه برای خطوط نامعتبر و پنجره برای توقف دریافت heartbeat'],
  ['server_error', 'A10 · شرایط استثنایی', 'شمار پاسخ‌های 5xx از شمارنده‌های هر سرویس'],
];
const fields = [
  ['threshold', 'حد آستانه', 1, 500],
  ['window_minutes', 'پنجرهٔ شمارش (دقیقه)', 1, 60],
  ['cooldown_minutes', 'وقفهٔ هشدار تکراری (دقیقه)', 1, 1440],
];

function ThresholdForm({ data, canWrite, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(rules.filter(([key]) => data[key]).map(([key]) => [key, {
      enabled: form.has(key + '-enabled'),
      severity: form.get(key + '-severity'),
      ...Object.fromEntries(fields.map(([field]) => [field, Number(form.get(key + '-' + field))])),
    }]));
    setError('');
    setBusy(true);
    try {
      await liveApi('/alerts/settings/web', { method: 'PUT', body });
      onSaved();
    } catch (failure) {
      setError(failure.status === 422 ? 'مقادیر آستانه را بررسی کنید.' : failure.message);
    } finally {
      setBusy(false);
    }
  }
  return <form className="stack" onSubmit={save}>
    {rules.filter(([key]) => data[key]).map(([key, label, detail]) => <fieldset key={key} className="account-permissions" disabled={!canWrite || busy}>
      <legend>{label}</legend>
      <p>{detail}</p>
      <label className="toggle"><input name={key + '-enabled'} type="checkbox" defaultChecked={data[key].enabled} /> فعال</label>
      {fields.map(([field, caption, min, max]) => <label key={field}>{caption}
        <input name={key + '-' + field} type="number" min={min} max={max} defaultValue={data[key][field]} required />
      </label>)}
      <label>شدت<select name={key + '-severity'} defaultValue={data[key].severity}>
        {['low', 'medium', 'high', 'critical'].map(severity =>
          <option key={severity} value={severity}>{displayValue(severity)}</option>)}
      </select></label>
    </fieldset>)}
    {error && <p role="alert" className="notice error">{error}</p>}
    {canWrite && <button className="primary" disabled={busy}>ذخیرهٔ آستانه‌ها</button>}
  </form>;
}

export default function AlertThresholds({ canWrite }) {
  const [revision, setRevision] = useState(0);
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  async function evaluate() {
    setEvaluating(true);
    setEvaluation(null);
    try {
      setEvaluation(await liveApi('/alerts/owasp/evaluate', { method: 'POST' }));
    } catch (failure) {
      setEvaluation({ error: failure.message });
    } finally {
      setEvaluating(false);
    }
  }
  const result = useResource('/alerts/settings/web', {}, revision, liveApi);
  return <Card title="آستانه‌های هشدار وب‌سرویس"
    detail="قواعد OWASP Top 10:2025 فقط پس از دریافت سیگنال متناظر هشدار می‌دهند."
    action={canWrite && <button type="button" className="button" disabled={evaluating} onClick={evaluate}>
      {evaluating ? 'در حال ارزیابی…' : 'ارزیابی داده‌های جاری'}
    </button>}>
    {evaluation?.error && <p className="notice error" role="alert">{evaluation.error}</p>}
    {evaluation?.items && <p className="notice" role="status">
      {number.format(evaluation.items.length)} سرویس ارزیابی شد و {number.format(evaluation.alerts_created)} هشدار جدید ثبت شد.
      {evaluation.items.some(item => item.request_rules_skipped) && ' بعضی قواعد درخواست به دلیل حجم زیاد اجرا نشدند.'}
    </p>}
    {revision > 0 && <p className="notice" role="status">آستانه‌ها ذخیره شدند.</p>}
    <Resource result={result}>{data => <ThresholdForm key={revision} data={data} canWrite={canWrite}
      onSaved={() => setRevision(value => value + 1)} />}</Resource>
  </Card>;
}
