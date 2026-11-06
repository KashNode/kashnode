import test from 'node:test';
import assert from 'node:assert/strict';
import { createMerchantIntegrationHandlers } from '../server/routes/merchantIntegrations.js';

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

test('Free Trial merchant can list their self-service integrations', async () => {
  const calls = [];
  const handlers = createMerchantIntegrationHandlers({
    pool: { async query(sql, args) {
      calls.push({ sql, args });
      if (sql.includes('subscription_plan')) return { rows: [{ id: 'merchant-1', subscription_plan: 'free' }] };
      return { rows: [{ provider: 'steadfast', config: { autoBook: true }, is_active: true, configured: true }] };
    } },
  });
  const res = response();
  await handlers.list({ session: { user: { id: 'owner-1', merchantId: 'merchant-1', role: 'user' } } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.package, 'free');
  assert.equal(res.body.integrations[0].provider, 'steadfast');
  assert.equal(calls.length, 2);
});
