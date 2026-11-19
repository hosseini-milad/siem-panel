import assert from 'node:assert/strict';
import test from 'node:test';
import { liveDevice, resourceTone } from '../src/deviceHealth.js';

test('resource color changes only after the threshold and 120% of the threshold', () => {
  assert.equal(resourceTone(null, 70), '');
  assert.equal(resourceTone(70, 70), 'green');
  assert.equal(resourceTone(71, 70), 'amber');
  assert.equal(resourceTone(84, 70), 'amber');
  assert.equal(resourceTone(85, 70), 'red');
});

test('device health uses metrics returned by the backend', () => {
  const device = liveDevice({
    id: 'user-1', name: 'Analyst', username: 'analyst', active: true, branch: 'SOC',
    system: { id: '78:24:af:cb:1b:fd', name: 'DESKTOP-88EQ9K3', online: true,
      cpu: 7.71, ram: 64.8, disk: null, threshold: 70,
      disk_read_bytes_per_sec: 2048, net_recv_bytes_per_sec: 4096 },
  });
  assert.equal(device.name, 'DESKTOP-88EQ9K3');
  assert.equal(device.user, 'Analyst');
  assert.equal(device.online, true);
  assert.equal(device.cpu, 7.71);
  assert.equal(device.ram, 64.8);
  assert.equal(device.disk, null);
  assert.equal(device.disk_read_bytes_per_sec, 2048);
  assert.equal(device.net_recv_bytes_per_sec, 4096);
});
