import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';

export function Avatar({ person }) {
  const [failed, setFailed] = useState('');
  const name = person.name || 'کاربر';
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('');
  return <span className="user-avatar" title={name} aria-label={name} role="img">
    {person.avatar_url && failed !== person.avatar_url
      ? <img src={person.avatar_url} alt="" draggable={false} onError={() => setFailed(person.avatar_url)} />
      : <span aria-hidden="true">{initials}</span>}
  </span>;
}

export default function AvatarUpload({ user, onSave }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(''), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  async function upload(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFeedback('حجم تصویر نباید بیشتر از ۲ مگابایت باشد.');
      return;
    }
    setFeedback('');
    setBusy(true);
    try {
      const response = await fetch('/api/v1/auth/avatar', { method: 'PUT', body: file });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? 'بارگذاری تصویر انجام نشد.');
      onSave(data);
      setFeedback('تصویر حساب ذخیره شد.');
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="avatar-upload">
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
    <button type="button" className="avatar-upload-button" title="بارگذاری تصویر حساب"
      aria-label="بارگذاری تصویر حساب" disabled={busy} onClick={() => input.current.click()}>
      <Avatar person={user} /><span className="avatar-camera"><Camera size={11} aria-hidden="true" /></span>
    </button>
    <span className="avatar-feedback" role="status">{busy ? 'در حال بارگذاری تصویر…' : feedback}</span>
  </div>;
}
