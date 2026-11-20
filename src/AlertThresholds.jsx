import { useState } from 'react';
import { liveApi } from './api.js';
import { Card, displayValue, Resource, useResource } from './ui.jsx';

const rules = [
  ['login_failure', 'خطاهای ورود', 'شمار پاسخ 401 دارای علامت خطای ورود، به‌ازای حساب مستعار یا IP مبدأ'],
  ['server_error', 'خطاهای وب‌سرویس', 'شمار درخواست‌های ثبت‌شده با پاسخ 5xx، به‌ازای هر سرویس'],
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
    const body = Object.fromEntries(rules.map(([key]) => [key, {
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
    {rules.map(([key, label, detail]) => <fieldset key={key} className="account-permissions" disabled={!canWrite || busy}>
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
  const result = useResource('/alerts/settings/web', {}, revision, liveApi);
  return <Card title="آستانه‌های هشدار وب‌سرویس"
    detail="این تنظیمات بر صدور هشدار اثر دارند. محدودیت تلاش ورود از تنظیمات احراز هویت پیروی می‌کند.">
    {revision > 0 && <p className="notice" role="status">آستانه‌ها ذخیره شدند.</p>}
    <Resource result={result}>{data => <ThresholdForm key={revision} data={data} canWrite={canWrite}
      onSaved={() => setRevision(value => value + 1)} />}</Resource>
  </Card>;
}
