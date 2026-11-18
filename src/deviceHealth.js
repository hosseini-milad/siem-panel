export const deviceStorageKey = 'siem-device-health-v1';
export const deviceTypes = { desktop: 'رایانهٔ رومیزی', laptop: 'لپ‌تاپ', server: 'سرور', other: 'سایر' };
export const forecastWarningThreshold = 20;

export function normalizeDeviceIp(input) {
  const value = input.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    const parts = value.split('.').map(Number);
    return parts.every(part => part <= 255) ? parts.join('.') : null;
  }
  if (!value.includes(':') || !/^[\da-f:.]+$/i.test(value)) return null;
  try {
    return new URL(`http://[${value}]/`).hostname.slice(1, -1);
  } catch {
    return null;
  }
}

export const sampleDevices = [
  { id: 'soc', name: 'ایستگاه عملیات امنیت', ip: '192.0.2.21', type: 'desktop', online: true,
    user: 'نگار رضایی', role: 'تحلیل‌گر امنیت', access: 'مشاهده رویدادها، رسیدگی به هشدارها',
    os: 'Windows 11 Pro', processor: 'Intel Core i7-13700', memory: '32 GB', storage: '1 TB SSD',
    cpu: 32, ram: 58, disk: 46, forecast: { cpu: 56, ram: 63, disk: 48 } },
  { id: 'logs', name: 'سرور تجمیع رویدادها', ip: '192.0.2.42', type: 'server', online: true,
    user: 'امیر صادقی', role: 'مدیر زیرساخت', access: 'مدیریت سرویس، خواندن لاگ‌ها',
    os: 'Ubuntu 24.04 LTS', processor: 'AMD EPYC 7313', memory: '64 GB', storage: '2 TB NVMe',
    cpu: 67, ram: 73, disk: 86, forecast: { cpu: 72, ram: 77, disk: 90 } },
  { id: 'audit', name: 'لپ‌تاپ تیم ممیزی', ip: '192.0.2.63', type: 'laptop', online: false,
    user: 'سارا محمدی', role: 'کارشناس ممیزی', access: 'مشاهده و دریافت گزارش‌ها',
    os: 'Windows 11 Pro', processor: 'Intel Core i5-1335U', memory: '16 GB', storage: '512 GB SSD',
    cpu: null, ram: null, disk: null },
];

export function loadDevices() {
  try {
    const saved = JSON.parse(localStorage.getItem(deviceStorageKey));
    if (Array.isArray(saved)) return saved;
  } catch {
    // The mock still works in memory when storage is unavailable.
  }
  return sampleDevices;
}


export function mockDevice(account, legacyDevices) {
  const legacy = legacyDevices.find(device => device.id === account.device_id);
  const seed = [...account.id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0);
  const sample = legacy ?? {
    online: seed % 5 !== 0, cpu: 35 + seed % 64, ram: 38 + (seed >>> 6) % 61, disk: 42 + (seed >>> 12) % 57,
  };
  const profile = account.system ?? legacy ?? {};
  return {
    ...profile, id: account.id, branch: account.branch, branchId: account.branch_id,
    username: account.username, user: account.name, name: profile.name || account.name,
    type: profile.type ?? 'desktop', threshold: profile.threshold ?? 70,
    online: account.active && sample.online, cpu: sample.cpu, ram: sample.ram, disk: sample.disk,
    forecast: sample.forecast ?? { cpu: Math.min(sample.cpu + 9, 100), ram: Math.min(sample.ram + 4, 100),
      disk: Math.min(sample.disk + 2, 100) },
  };
}

export function resourceTone(value, threshold) {
  if (value == null) return '';
  if (value * 5 > threshold * 6) return 'red';
  return value > threshold ? 'amber' : 'green';
}
