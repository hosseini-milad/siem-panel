import assert from 'node:assert/strict';
import test from 'node:test';
import { resourceTone } from '../src/deviceHealth.js';

test('resource color changes only after the threshold and 120% of the threshold', () => {
  assert.equal(resourceTone(null, 70), '');
  assert.equal(resourceTone(70, 70), 'green');
  assert.equal(resourceTone(71, 70), 'amber');
  assert.equal(resourceTone(84, 70), 'amber');
  assert.equal(resourceTone(85, 70), 'red');
});
