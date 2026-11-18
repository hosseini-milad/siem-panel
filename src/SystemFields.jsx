import { deviceTypes } from './deviceHealth.js';

export const systemFields = [
  ['name', 'نام سیستم'], ['ip', 'نشانی IP'], ['mac', 'نشانی MAC'], ['os', 'سیستم‌عامل'],
  ['processor', 'مدل پردازنده'], ['memory', 'ظرفیت حافظه'], ['storage', 'ظرفیت دیسک'],
];

export function systemValues(values) {
  return {
    ...Object.fromEntries(systemFields.map(([key]) => [key, values['system-' + key].trim()])),
    type: values['system-type'], threshold: Number(values['system-threshold']),
  };
}

export default function SystemFields({ profile }) {
  return <fieldset className="account-permissions">
    <legend>مشخصات سیستم</legend>
    {systemFields.map(([key, label]) => <label key={key}>{label}
      <input name={'system-' + key} dir={['ip', 'mac'].includes(key) ? 'ltr' : 'auto'}
        maxLength={key === 'mac' ? 17 : key === 'ip' ? 45 : 100}
        placeholder={key === 'ip' ? '192.0.2.10' : key === 'mac' ? '02:00:00:00:00:10' : undefined}
        defaultValue={profile?.[key] ?? ''} />
    </label>)}
    <label>نوع سیستم<select aria-label="نوع سیستم" name="system-type" defaultValue={profile?.type ?? 'desktop'}>
      {Object.entries(deviceTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <label>آستانهٔ مصرف (درصد)<input name="system-threshold" type="number" min="1" max="100"
      defaultValue={profile?.threshold ?? 70} required /></label>
  </fieldset>;
}
