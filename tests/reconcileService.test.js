import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBdPhone, normalizeGateway } from '../server/services/reconcileService.js';

test('normalizes Bangladesh phones to last 11 digits', () => {
  assert.equal(normalizeBdPhone('+880 1712-345678'), '01712345678');
  assert.equal(normalizeBdPhone('8801712345678'), '01712345678');
  assert.equal(normalizeBdPhone('01712 345 678'), '01712345678');
  assert.equal(normalizeBdPhone('12345'), null);
});
test('normalizes MFS provider names', () => {
  assert.equal(normalizeGateway('bKash'), 'bKash');
  assert.equal(normalizeGateway('NAGAD'), 'Nagad');
  assert.equal(normalizeGateway('Rocket'), 'Rocket');
  assert.equal(normalizeGateway('Upay'), 'Upay');
  assert.equal(normalizeGateway('unknown'), null);
});
