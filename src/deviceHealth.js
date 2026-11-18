export const deviceStorageKey = 'siem-device-health-v1';
export const deviceTypes = { desktop: 'رایانهٔ رومیزی', laptop: 'لپ‌تاپ', server: 'سرور' };

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
    cpu: 32, ram: 58, disk: 46 },
  { id: 'logs', name: 'سرور تجمیع رویدادها', ip: '192.0.2.42', type: 'server', online: true,
    user: 'امیر صادقی', role: 'مدیر زیرساخت', access: 'مدیریت سرویس، خواندن لاگ‌ها',
    os: 'Ubuntu 24.04 LTS', processor: 'AMD EPYC 7313', memory: '64 GB', storage: '2 TB NVMe',
    cpu: 67, ram: 73, disk: 86 },
  { id: 'audit', name: 'لپ‌تاپ تیم ممیزی', ip: '192.0.2.63', type: 'laptop', online: false,
    user: 'سارا محمدی', role: 'کارشناس ممیزی', access: 'مشاهده و دریافت گزارش‌ها',
    os: 'Windows 11 Pro', processor: 'Intel Core i5-1335U', memory: '16 GB', storage: '512 GB SSD',
    cpu: null, ram: null, disk: null },
];
