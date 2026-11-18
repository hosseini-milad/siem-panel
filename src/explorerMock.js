const day = 86_400_000;
const samplePorts = [443, 53, 22, 8080, 3389, 80];
const { year, month, day: date } = Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map(({ type, value }) => [type, value]),
);
export const today = [year, month, date].join('-');

function network(index) {
  return {
    source_ip: '192.0.2.' + (10 + index % 16),
    destination_ip: '198.51.100.' + (20 + index % 8),
    source_port: 49152 + index % 10000,
    destination_port: samplePorts[index % samplePorts.length],
    protocol: index % samplePorts.length === 1 ? 'UDP' : 'TCP',
  };
}

function risk(score) {
  if (score == null) return null;
  if (score === 0) return { score, severity: 'benign' };
  if (score === 1) return { score, severity: 'attack' };
  const severity = score >= .85 ? 'critical' : score >= .65 ? 'high' : score >= .35 ? 'medium' : 'low';
  return { score, severity };
}

export function seedFlows() {
  const now = Date.now();
  return Array.from({ length: 480 }, (_, index) => {
    const fields = network(index);
    const timestamp = new Date(now - Math.floor(index / 48) * day - (index % 48) * 900_000).toISOString();
    const original_id = 'flow-' + (index + 1);
    const duration = 1000 + index * 313;
    const packets = 2 + index % 64;
    const forwardBytes = packets * (64 + index % 512);
    const label = index % 10 === 0 ? null : index % 7 === 0 ? 1 : index % 5 === 0 ? 0 : ((index * 19 + 23) % 101) / 100;
    return {
      id: original_id, timestamp, source: 'network-flow', ...fields,
      level: null, message: 'جریان ترافیک شبکه',
      raw: { _id: original_id, Timestamp: timestamp, 'Src IP': fields.source_ip,
        'Dst IP': fields.destination_ip, 'Src Port': fields.source_port, 'Dst Port': fields.destination_port,
        Protocol: fields.protocol, 'Flow Duration': duration, 'Tot Fwd Pkts': packets,
        'TotLen Fwd Pkts': forwardBytes, Label: label === 0 ? 'Benign' : label == null ? null : 'DDoS' },
      normalized: { _id: original_id, original_id, 'Flow Duration': (duration - 1000) / (479 * 313),
        'Tot Fwd Pkts': (packets - 2) / 63, ['Protocol_' + fields.protocol]: 1, Label: label },
      standardized: label == null ? null : { _id: original_id, original_id, Label: label },
      risk: risk(label),
    };
  });
}

export function seedArchivedLogs(events) {
  return events.slice(0, 32).flatMap((event, index) => Array.from({ length: 9 }, (_, i) => {
    const timestamp = new Date(Date.parse(event.timestamp) - (i + 1) * day).toISOString();
    return { ...event, id: crypto.randomUUID(), timestamp, received_at: timestamp, attributes: network(index + i) };
  }));
}

export function logForExplorer(event) {
  const attributes = event.attributes ?? {};
  return {
    id: event.id, timestamp: event.timestamp, source: event.source, level: event.level, message: event.message,
    source_ip: attributes.source_ip ?? null, destination_ip: attributes.destination_ip ?? null,
    source_port: attributes.source_port ?? null, destination_port: attributes.destination_port ?? attributes.port ?? null,
    protocol: attributes.protocol ?? null, raw: event, normalized: null, standardized: null, risk: null,
  };
}

export function filterRecords(records, params) {
  const query = params.get('q')?.trim().toLowerCase();
  const start = params.has('start') ? Date.parse(params.get('start')) : -Infinity;
  const end = params.has('end') ? Date.parse(params.get('end')) : Infinity;
  const textFields = ['source_ip', 'destination_ip', 'protocol', 'level'];
  const portFields = ['source_port', 'destination_port'];
  return records.filter(record => {
    const stamp = Date.parse(record.timestamp);
    if (stamp < start || stamp >= end) return false;
    if (query && ![
      record.id, record.message, record.source, record.level, record.timestamp,
      record.source_ip, record.destination_ip, record.source_port, record.destination_port,
      record.protocol, record.raw.Label, record.risk?.severity,
    ].some(value => value != null && String(value).toLowerCase().includes(query))) return false;
    if (!textFields.every(key => !params.has(key) ||
      params.get(key).toLowerCase() === String(record[key]).toLowerCase())) return false;
    if (!portFields.every(key => !params.has(key) ||
      record[key] != null && record[key] === Number(params.get(key)))) return false;
    if (params.has('risk') && (record.risk?.severity ?? 'unscored') !== params.get('risk')) return false;
    return true;
  }).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || b.id.localeCompare(a.id));
}
