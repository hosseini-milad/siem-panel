import { filterRecords, logForExplorer, seedArchivedLogs, seedFlows } from './explorerMock.js';

const menus = [
  ['overview', 'نمای کلی', ['Overview']],
  ['ingestion', 'ورود و پردازش', ['Ingestion', 'Logs']],
  ['events', 'جست‌وجوی رویدادها', ['Search']],
  ['detections', 'قواعد تشخیص', ['Detection Rules']],
  ['alerts', 'هشدارها', ['Alerts']],
  ['incidents', 'رخدادهای امنیتی', ['Incidents']],
  ['analytics', 'تحلیل هوشمند', ['Datasets', 'Normalization', 'Standardization', 'Machine Learning', 'Sysmon Dataset & ML']],
  ['system', 'سامانه', ['System', 'Health']],
].map(([id, label, tags]) => ({ id, label, tags }));

const sources = [
  ['firewall-01', 'WARNING', 'اتصال ورودی مسدود شد'],
  ['identity-gateway', 'ERROR', 'تلاش ناموفق برای ورود'],
  ['endpoint-07', 'CRITICAL', 'فعالیت مشکوک در ایستگاه کاری'],
  ['dns-resolver', 'INFO', 'درخواست دامنه ثبت شد'],
  ['web-proxy', 'INFO', 'درخواست HTTP تأیید شد'],
];
const hourlyCounts = [17, 22, 19, 28, 23, 36, 29, 41, 36, 54, 46, 38, 60, 52, 67, 47, 75, 62, 58, 81, 69, 88, 66, 77];
const iso = (time = Date.now()) => new Date(time).toISOString();
const minute = 60_000;
const hour = 60 * minute;
const fields = (minutesAgo) => ({
  id: crypto.randomUUID(), created_at: iso(Date.now() - minutesAgo * minute), updated_at: iso(),
});

function seed() {
  const now = Date.now();
  const events = hourlyCounts.flatMap((count, bucket) => Array.from({ length: count }, (_, index) => {
    const [source, level, message] = sources[(index * 7 + bucket) % sources.length];
    const timestamp = iso(now - ((hourlyCounts.length - 1 - bucket) * hour + index * 20_000));
    return { id: crypto.randomUUID(), source, level, message, timestamp, received_at: timestamp, attributes: { source_ip: `192.0.2.${10 + index % 16}`, destination_ip: `198.51.100.${20 + index % 8}`,
      source_port: 49152 + index, destination_port: [443, 53, 22, 8080][index % 4], protocol: index % 4 === 1 ? "UDP" : "TCP" } };
  })).reverse();
  const alerts = [
    ['فعالیت مشکوک در ایستگاه کاری', 'critical', 'open', 'endpoint-07'],
    ['تلاش ورود بیش از آستانه', 'high', 'open', 'identity-gateway'],
    ['رشد ترافیک مسدود شده', 'medium', 'acknowledged', 'firewall-01'],
    ['افزایش درخواست‌های DNS', 'low', 'resolved', 'dns-resolver'],
  ].map(([title, severity, status, source], i) => ({
    ...fields(12 + i * 31), title, severity, status, source, kind: 'threshold',
    description: 'این هشدار با دادهٔ آزمایشی ایجاد شده است.', event_ids: [],
  }));
  const incidents = [
    { ...fields(25), title: 'بررسی فعالیت ایستگاه کاری', description: 'بررسی رویدادهای مرتبط با endpoint-07.',
      severity: 'critical', status: 'investigating', alert_ids: [alerts[0].id], notes: [] },
    { ...fields(90), title: 'پیگیری تلاش‌های ورود', description: 'مرور رخدادهای درگاه هویت.',
      severity: 'high', status: 'open', alert_ids: [alerts[1].id], notes: [] },
  ];
  const rules = [
    ['تلاش مکرر برای ورود', 'identity-gateway', 'ERROR', 'high', 10, true],
    ['حجم اتصال مسدود شده', 'firewall-01', 'WARNING', 'medium', 25, true],
    ['رویداد بحرانی ایستگاه کاری', 'endpoint-07', 'CRITICAL', 'critical', 5, true],
    ['حجم درخواست DNS', 'dns-resolver', 'INFO', 'low', 60, false],
  ].map(([name, source, level, severity, threshold, enabled]) => ({
    ...fields(120), name, description: 'شمارش رویدادها به تفکیک منبع',
    source, level, severity, threshold, enabled, lookback_seconds: 300, cooldown_seconds: 300,
  }));
  return { events: [...events, ...seedArchivedLogs(events)], flows: seedFlows(), alerts, incidents, rules, batches: new Map() };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function page(items, params) {
  const limit = Number(params.get('limit') ?? 50);
  const offset = Number(params.get('offset') ?? 0);
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}

function selectEvents(events, params, bounded = true) {
  const end = params.get('end') ?? (bounded ? iso() : null);
  const start = params.get('start') ?? (bounded ? iso(Date.parse(end) - 24 * hour) : null);
  const source = params.get('source');
  const level = params.get('level');
  const query = params.get('q')?.trim().toLowerCase();
  return events.filter(event =>
    (!start || Date.parse(event.timestamp) >= Date.parse(start)) &&
    (!end || Date.parse(event.timestamp) <= Date.parse(end)) &&
    (!source || event.source === source) && (!level || event.level === level) &&
    (!query || [event.source, event.message].some(text => text.toLowerCase().includes(query))),
  ).sort((first, second) =>
    Date.parse(second.timestamp) - Date.parse(first.timestamp) || second.id.localeCompare(first.id),
  );
}

function group(items, key, label) {
  const counts = new Map();
  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ [label]: value, count }));
}

function statistics(events, interval) {
  const dateLength = interval === 'day' ? 10 : 13;
  const suffix = interval === 'day' ? 'T00:00:00Z' : ':00:00Z';
  return {
    event_count: events.length,
    levels: group(events, event => event.level, 'level').sort((a, b) => a.level.localeCompare(b.level)),
    top_sources: group(events, event => event.source, 'source')
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)).slice(0, 10),
    series: group(events, event => new Date(event.timestamp).toISOString().slice(0, dateLength) + suffix, 'timestamp')
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  };
}

export function createMockRequest() {
  const data = seed();

  return async function request(url, { method = 'GET', body } = {}) {
    const { pathname, searchParams: params } = new URL(url, 'http://mock.local');
    const path = pathname.slice('/api/v1'.length);
    const payload = body ? JSON.parse(body) : {};
    if (method === 'GET') {
      switch (path) {
        case '/system/navigation': return json({ authentication: false, agents_in_scope: false, dashboard_path: '/dashboard', menus });
        case '/system/settings': return json({
          mongodb_database: 'siem', mongodb_server_selection_timeout_ms: 3000,
          mongodb_connect_timeout_ms: 3000, mongodb_socket_timeout_ms: 60000,
          datasets_root: 'ds/Datasets', ml_model_dir: 'data/ml', ml_threads: 2,
        });
        case '/system/status': return json({ mongodb: { available: true }, machine_learning: { available: false } });
        case '/health': return json({ status: 'ok', database: 'mongodb' });
        case '/overview': {
          const hours = Number(params.get('hours') ?? 24);
          const since = iso(Date.now() - hours * hour);
          const { series, ...stats } = statistics(selectEvents(data.events, new URLSearchParams({ start: since })), 'hour');
          return json({ since, hours, ...stats, hourly_events: series,
            open_alerts: data.alerts.filter(item => item.status !== 'resolved').length,
            active_incidents: data.incidents.filter(item => item.status !== 'closed').length,
            enabled_rules: data.rules.filter(item => item.enabled).length,
          });
        }
        case '/dashboard/charts': {
          const interval = params.get('interval') ?? 'hour';
          return json({ interval, ...statistics(selectEvents(data.events, params), interval) });
        }
        case '/explorer/records': {
          const records = params.get('kind') === 'logs' ? data.events.map(logForExplorer) : data.flows;
          return json(page(filterRecords(records, params), params));
        }
        case '/logs': return json(page(selectEvents(data.events, params, false), params));
        case '/search/events': return json({ ...page(selectEvents(data.events, params), params), engine: 'mongodb' });
        case '/detections/rules': return json(page(data.rules, params));
        case '/alerts':
        case '/incidents': return json(page(data[path.slice(1)].filter(item =>
          ['status', 'severity'].every(key => !params.has(key) || params.get(key) === item[key])), params));
        case '/datasets/folders': return json({ folders: ['Attack', 'Benign'] });
        case '/normalization/records':
        case '/standardization/records': return json(page([], params));
        case '/ml/model': return json({ detail: 'مدلی در محیط نمونه آموزش داده نشده است.' }, 404);
      }
    }
    if (method === 'POST' && path === '/ingestion/batches') {
      const { batch_id = crypto.randomUUID(), events } = payload;
      if (!Array.isArray(events) || events.length < 1 || events.length > 500 || events.some(event =>
        !event || typeof event.source !== 'string' || !event.source.trim() || typeof event.message !== 'string' ||
        !event.message.trim() || !Number.isFinite(Date.parse(event.timestamp)) ||
        !/(Z|[+-]\d{2}:\d{2})$/i.test(event.timestamp) ||
        !['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'].includes(event.level ?? 'INFO'))) {
        return json({ detail: 'گروه باید شامل ۱ تا ۵۰۰ رویداد با منبع، پیام، سطح و زمان معتبر باشد.' }, 422);
      }
      const existing = data.batches.get(batch_id);
      const records = events.map(event => ({
        timestamp: iso(Date.parse(event.timestamp)), source: event.source.trim(), message: event.message.trim(),
        level: event.level ?? 'INFO', attributes: event.attributes ?? {},
      }));
      const fingerprint = JSON.stringify(records);
      if (existing && existing.fingerprint !== fingerprint) {
        return json({ detail: 'این شناسه برای محتوای دیگری استفاده شده است.' }, 409);
      }
      if (!existing) {
        data.events.unshift(...records.map(event => ({
          ...event, id: crypto.randomUUID(), received_at: iso(),
        })));
        data.batches.set(batch_id, {
          fingerprint, record: { id: batch_id, status: 'stored', stored: events.length,
            events: events.length, created_at: iso(), updated_at: iso() },
        });
      }
      return json({ batch_id, status: 'stored', inserted: existing ? 0 : events.length,
        deduplicated: existing ? events.length : 0 });
    }
    const batch = path.match(/^\/ingestion\/batches\/([^/]+)$/);
    if (method === 'GET' && batch && data.batches.has(batch[1])) return json(data.batches.get(batch[1]).record);
    const entry = path.match(/^\/(detections\/rules|alerts|incidents)\/([^/]+)$/);
    if (entry) {
      const [, category, id] = entry;
      const list = data[category === 'detections/rules' ? 'rules' : category];
      const item = list.find(row => row.id === id);
      if (item && method === 'GET') return json(item);
      if (item && method === 'PATCH') {
        const rule = category === 'detections/rules';
        const states = category === 'alerts' ? ['open', 'acknowledged', 'resolved'] : ['open', 'investigating', 'contained', 'closed'];
        if (rule ? typeof payload.enabled !== 'boolean' : !states.includes(payload.status)) {
          return json({ detail: 'وضعیت معتبر نیست.' }, 422);
        }
        if (rule) item.enabled = payload.enabled;
        else item.status = payload.status;
        item.updated_at = iso();
        return json(item);
      }
    }
    return json({ detail: 'مسیر یا رکورد پیدا نشد.' }, 404);
  };
}

export const mockRequest = createMockRequest();
