import { deviceTypes } from './deviceHealth.js';

export const systemFields = [
  ['name', 'نام سیستم'], ['ip', 'نشانی IP'], ['mac', 'نشانی MAC'], ['os', 'سیستم‌عامل'],
  ['processor', 'مدل پردازنده'], ['memory', 'ظرفیت حافظه'], ['storage', 'ظرفیت دیسک'],
];

export function systemValues(values) {
  return {
    name: values['system-name'].trim(),
    type: values['system-type'], threshold: Number(values['system-threshold']),
  };
}

export default function SystemFields({ profile }) {
  return <fieldset className="account-permissions">
    <legend>مشخصات سیستم</legend>
    <label>نام سیستم<input name="system-name" dir="auto" maxLength={100} defaultValue={profile?.name ?? ''} /></label>
    <label>نوع سیستم<select aria-label="نوع سیستم" name="system-type" defaultValue={profile?.type ?? 'desktop'}>
      {Object.entries(deviceTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <label>آستانهٔ مصرف (درصد)<input name="system-threshold" type="number" min="1" max="100"
      defaultValue={profile?.threshold ?? 70} required /></label>
  </fieldset>;
}
