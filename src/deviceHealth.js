export const deviceTypes = { desktop: 'رایانهٔ رومیزی', laptop: 'لپ‌تاپ', server: 'سرور', other: 'سایر' };

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

export function liveDevice(account) {
  const profile = account.system ?? {};
  return {
    ...profile, id: account.id, branch: account.branch, branchId: account.branch_id,
    username: account.username, user: account.name, name: profile.name || account.name,
    type: profile.type ?? 'desktop', threshold: profile.threshold ?? 70,
    online: account.active && Boolean(profile.online), cpu: profile.cpu, ram: profile.ram, disk: profile.disk,
  };
}

export function resourceTone(value, threshold) {
  if (value == null) return '';
  if (value * 5 > threshold * 6) return 'red';
  return value > threshold ? 'amber' : 'green';
}
