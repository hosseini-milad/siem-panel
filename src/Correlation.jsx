import { useState } from 'react';
import { liveApi } from './api.js';
import { Badge, Card, number, Table } from './ui.jsx';

const domainLabels = { network: 'شبکه', system: 'سیستم‌عامل', web: 'وب‌سرویس' };
const states = {
  anomalous: ['رفتار غیرعادی', 'amber'],
  within_baseline: ['در محدودهٔ خط پایه', 'green'],
  insufficient_baseline: ['سابقهٔ کافی وجود ندارد', 'muted'],
  ambiguous_identity: ['این IP با چند MAC مشاهده شده است', 'amber'],
  volume_limit: ['حجم داده از سقف تحلیل بیشتر است', 'amber'],
  no_activity: ['در این بازه فعالیتی برای این IP دیده نشد', 'muted'],
};
const featureLabels = {
  events: 'تعداد رویدادها', distinct_edges: 'تعداد ارتباط‌های متمایز', signals: 'تعداد سیگنال‌های خطا یا هشدار',
};
const decimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

function featureLabel(feature) {
  if (feature === 'active_domains') return 'تعداد منابع فعال';
  const separator = feature.indexOf('_');
  return `${featureLabels[feature.slice(separator + 1)]} · ${domainLabels[feature.slice(0, separator)]}`;
}

function EvidenceGraph({ graph }) {
  const [root, ...neighbors] = graph.nodes;
  if (!neighbors.length) return null;
  const coordinates = new Map([[root.id, [210, 130]]]);
  neighbors.forEach((node, index) => {
    const angle = 2 * Math.PI * index / neighbors.length - Math.PI / 2;
    coordinates.set(node.id, [210 + 170 * Math.cos(angle), 130 + 96 * Math.sin(angle)]);
  });
  const tones = { ip: 'blue', mac: 'green', agent: 'green', web_service: 'orange', network_source: 'blue' };
  return <>
    <svg className="correlation-graph" viewBox="0 0 420 260" role="img" aria-label="گراف ارتباط IP با شواهد">
      {graph.edges.map(({ source, target, relation, evidence }) => {
        const [x1, y1] = coordinates.get(source);
        const [x2, y2] = coordinates.get(target);
        return <line key={relation + target} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)">
          <title>{relation} · {number.format(evidence.length)} شاهد</title>
        </line>;
      })}
      {graph.nodes.map(node => <circle key={node.id} cx={coordinates.get(node.id)[0]} cy={coordinates.get(node.id)[1]}
        r={node.id === root.id ? 13 : 7} fill={`var(--${node.id === root.id ? 'purple' : tones[node.kind] ?? 'blue'})`}>
        <title>{node.label}</title>
      </circle>)}
    </svg>
    <details>
      <summary>گره‌ها و رابطه‌های نمودار</summary>
      <ul className="detail-list">{graph.edges.map(edge => <li key={edge.relation + edge.target}>
        <bdi>{edge.target}</bdi><span>{edge.relation} · {number.format(edge.evidence.length)} شاهد</span>
      </li>)}</ul>
    </details>
    <h3>خط زمانی شواهد · {number.format(graph.evidence_shown)} از {number.format(graph.evidence_total)}</h3>
    <Table rows={graph.evidence.map(row => ({ ...row, id: row.ref }))} columns={[
      { key: 'timestamp', label: 'زمان', render: row => new Date(row.timestamp).toLocaleString('fa-IR') },
      { key: 'domain', label: 'منبع', render: row => domainLabels[row.domain] },
      { key: 'summary', label: 'جزئیات', render: row => <bdi>{row.route ?? row.event_id ?? row.level ?? row.direction ?? '—'}</bdi> },
      { key: 'ref', label: 'مرجع رکورد', render: row => <bdi className="mono">{row.ref}</bdi> },
    ]} />
  </>;
}

export default function Correlation() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const query = Object.fromEntries(new FormData(event.currentTarget));
    query.ip = query.ip.trim();
    setResult(null);
    setError('');
    setBusy(true);
    try {
      setResult(await liveApi('/explorer/correlation', { query }));
    } catch (failure) {
      setError(failure.status === 422 ? 'نشانی IP یا بازهٔ تحلیل معتبر نیست.' : failure.message);
    } finally {
      setBusy(false);
    }
  }

  const state = result && states[result.state];
  return <Card title="همبستگی و گراف شواهد" detail="رفتار این IP در بازهٔ اخیر با سابقهٔ خودش مقایسه می‌شود.">
    <form className="filters" onSubmit={submit}>
      <label>نشانی IP<input name="ip" dir="ltr" maxLength={45} required /></label>
      <label>خط پایه (ساعت)<input name="baseline_hours" type="number" min="8" max="144" defaultValue="24" required /></label>
      <label>پنجرهٔ بررسی<select name="window_minutes" defaultValue="60">
        <option value="15">۱۵ دقیقه</option><option value="30">۳۰ دقیقه</option><option value="60">۶۰ دقیقه</option>
      </select></label>
      <button className="primary" disabled={busy}>{busy ? 'در حال تحلیل…' : 'تحلیل IP'}</button>
    </form>
    {error && <p className="notice error" role="alert">{error}</p>}
    {result && <>
      <div className="model-summary" role="status">
        <Badge tone={state[1]}>{state[0]}</Badge>
        <span>امتیاز ناهنجاری <strong>{result.score == null ? '—' : decimal.format(result.score)}</strong></span>
        <span>پنجره‌های فعال خط پایه <strong>{number.format(result.active_baseline_windows)}</strong></span>
      </div>
      {result.reasons.length > 0 && <Table rows={result.reasons.map(row => ({ ...row, id: row.feature }))} columns={[
        { key: 'feature', label: 'علت امتیاز', render: row => featureLabel(row.feature) },
        { key: 'observed', label: 'مقدار اخیر', render: row => number.format(row.observed) },
        { key: 'baseline_median', label: 'میانهٔ خط پایه', render: row => number.format(row.baseline_median) },
      ]} />}
      <EvidenceGraph graph={result.graph} />
    </>}
  </Card>;
}
