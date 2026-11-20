import assert from 'node:assert/strict';
import test from 'node:test';
import { createApi } from '../src/api.js';
import { createMockRequest } from '../src/mock.js';

const setup = () => createApi({ request: createMockRequest() });

test('navigation matches the id and tag order used by FastAPI', async () => {
  const navigation = await setup()('/system/navigation');
  assert.deepEqual(navigation.menus.map(({ id, tags }) => [id, tags]), [
    ['overview', ['Overview']],
    ['ingestion', ['Ingestion', 'Logs']],
    ['events', ['Search']],
    ['alerts', ['Alerts']],
    ['analytics', ['Datasets', 'Normalization', 'Standardization', 'Machine Learning', 'Sysmon Dataset & ML']],
    ['system', ['System', 'Health']],
  ]);
  assert.equal(navigation.authentication, false);
  assert.equal(navigation.agents_in_scope, false);
});

test('batch replay preserves counts and search and charts agree with each other', async () => {
  const api = setup();
  const body = {
    batch_id: crypto.randomUUID(),
    events: [{ timestamp: new Date().toISOString(), source: 'unit-source', message: 'Test [case]' }],
  };
  const submit = payload => api('/ingestion/batches', { method: 'POST', body: payload });
  assert.deepEqual(await submit(body), { batch_id: body.batch_id, status: 'stored', inserted: 1, deduplicated: 0 });
  assert.equal((await submit(body)).deduplicated, 1);
  assert.equal((await api('/ingestion/batches/' + body.batch_id)).stored, 1);
  await assert.rejects(submit({ ...body, events: [{ ...body.events[0], source: 'changed' }] }));
  const query = { q: '[CASE]', source: 'unit-source', level: 'INFO', limit: 1 };
  const result = await api('/search/events', { query });
  assert.equal(result.total, 1);
  assert.equal(result.engine, 'mongodb');
  assert.equal(result.items[0].message, 'Test [case]');
  assert.equal((await api('/search/events', { query: { ...query, offset: 1 } })).items.length, 0);
  const charts = await api('/dashboard/charts', { query: { ...query, interval: 'day' } });
  assert.equal(charts.event_count, result.total);
  assert.deepEqual(charts.top_sources, [{ source: 'unit-source', count: 1 }]);
});

test('mock status updates use the same PATCH payloads as FastAPI', async () => {
  const api = setup();
  const initial = await api('/overview');
  const { items: [rule] } = await api('/detections/rules');
  const { items: [alert] } = await api('/alerts');
  const { items: [incident] } = await api('/incidents');
  await api('/detections/rules/' + rule.id, { method: 'PATCH', body: { enabled: false } });
  await api('/alerts/' + alert.id, { method: 'PATCH', body: { status: 'resolved' } });
  await api('/incidents/' + incident.id, { method: 'PATCH', body: { status: 'closed' } });
  const updated = await api('/overview');
  assert.equal(updated.enabled_rules, initial.enabled_rules - 1);
  assert.equal(updated.open_alerts, initial.open_alerts - 1);
  assert.equal(updated.active_incidents, initial.active_incidents - 1);
  await assert.rejects(api('/alerts/' + alert.id, { method: 'PATCH', body: { status: 'invalid' } }));
});

test('the real request adapter receives an API URL and JSON payload', async () => {
  const api = createApi({ request: async (url, options) => {
    assert.equal(url, '/api/v1/alerts/example?status=open');
    assert.deepEqual(options, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"status":"resolved"}',
    });
    return Response.json({ status: 'resolved' });
  } });
  assert.equal((await api('/alerts/example', {
    method: 'PATCH', query: { status: 'open', empty: '', skip: undefined }, body: { status: 'resolved' },
  })).status, 'resolved');
});

test('explorer filters by date and exact network fields before pagination', async () => {
  const api = setup();
  const all = await api('/explorer/records', { query: { kind: 'data', limit: 480 } });
  const row = all.items.find(item => item.risk);
  const start = row.timestamp.slice(0, 10) + 'T00:00:00.000Z';
  const end = new Date(Date.parse(start) + 86_400_000).toISOString();
  const query = { kind: 'data', start, end, source_ip: row.source_ip,
    destination_port: row.destination_port, q: row.source_ip, limit: 1 };
  const first = await api('/explorer/records', { query });
  assert.ok(first.total >= 1);
  const match = first.items[0];
  assert.equal(match.source_ip, row.source_ip);
  assert.equal(match.destination_port, row.destination_port);
  assert.equal(match.id, match.normalized.original_id);
  assert.equal(match.risk.score, match.standardized.Label);
  assert.ok(match.timestamp >= start && match.timestamp < end);
  assert.equal((await api('/explorer/records', { query: { ...query, offset: first.total } })).items.length, 0);
  const logs = await api('/explorer/records', { query: { kind: 'logs', risk: 'unscored' } });
  assert.ok(logs.total > 0);
  assert.ok(logs.items.every(item => item.risk === null && item.normalized === null && item.raw.attributes));
});
