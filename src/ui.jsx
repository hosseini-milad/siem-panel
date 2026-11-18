import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from './api.js';

export const number = new Intl.NumberFormat('fa-IR');
const clock = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false });
export const time = stamp => clock.format(new Date(stamp));
export const statuses = {
  open: 'باز', acknowledged: 'تأیید شده', resolved: 'رفع شده',
  investigating: 'در حال بررسی', contained: 'مهار شده', closed: 'بسته',
};
const levels = { CRITICAL: 'بحرانی', ERROR: 'خطا', WARNING: 'هشدار', INFO: 'اطلاعات', DEBUG: 'اشکال‌زدایی' };
const severities = { critical: 'بحرانی', high: 'زیاد', medium: 'متوسط', low: 'کم' };
export const logLevels = Object.keys(levels);
export const tones = {
  CRITICAL: 'red', ERROR: 'orange', WARNING: 'amber', INFO: 'blue', DEBUG: 'muted',
  critical: 'red', high: 'orange', medium: 'amber', low: 'blue',
  open: 'orange', investigating: 'blue', acknowledged: 'blue', contained: 'green', closed: 'green', resolved: 'green',
};
export const displayValue = value => levels[value] ?? severities[value] ?? statuses[value] ?? value;

export function useResource(path, query = {}, revision = 0, request = api) {
  const key = JSON.stringify(query);
  const [state, setState] = useState({ data: null, error: '' });
  useEffect(() => {
    let active = true;
    setState({ data: null, error: '' });
    request(path, { query: JSON.parse(key) }).then(
      data => { if (active) setState({ data, error: '' }); },
      error => { if (active) setState({ data: null, error: error.message }); },
    );
    return () => { active = false; };
  }, [path, key, revision, request]);
  return state;
}

export function Resource({ result, children }) {
  if (result.error) return <p className="notice error" role="alert">{result.error}</p>;
  if (!result.data) return <p className="notice" role="status">در حال بارگذاری…</p>;
  return children(result.data);
}

export function Badge({ value, tone, children }) {
  return <span className={`badge ${tone ?? tones[value] ?? 'muted'}`}><i />{children ?? displayValue(value)}</span>;
}

export function Card({ title, detail, action, children, className = '' }) {
  return <section className={`card ${className}`}>
    <header className="card-header">
      <div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}
    </header>
    {children}
  </section>;
}

export function Table({ columns, rows, empty = 'رکوردی یافت نشد.' }) {
  if (!rows.length) return <p className="notice">{empty}</p>;
  return <div className="table-scroll"><table>
    <thead><tr>{columns.map(({ key, label }) => <th key={key} scope="col">{label}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.id}>{columns.map(({ key, render }) =>
      <td key={key}>{render ? render(row) : row[key]}</td>,
    )}</tr>)}</tbody>
  </table></div>;
}

export function Pagination({ page, onOffset }) {
  return <div className="pagination">
    <span>{number.format(page.total)} نتیجه</span>
    <div>
      <button className="icon-button" aria-label="صفحهٔ قبل" disabled={page.offset === 0}
        onClick={() => onOffset(Math.max(0, page.offset - page.limit))}><ChevronRight size={16} /></button>
      <button className="icon-button" aria-label="صفحهٔ بعد" disabled={page.offset + page.limit >= page.total}
        onClick={() => onOffset(page.offset + page.limit)}><ChevronLeft size={16} /></button>
    </div>
  </div>;
}

export const eventColumns = [
  { key: 'message', label: 'پیام رویداد' },
  { key: 'source', label: 'منبع', render: row => <bdi className="mono">{row.source}</bdi> },
  { key: 'level', label: 'سطح', render: row => <Badge value={row.level} /> },
  { key: 'timestamp', label: 'زمان', render: row => <time dateTime={row.timestamp}>{time(row.timestamp)}</time> },
];
