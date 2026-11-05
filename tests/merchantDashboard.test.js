import test from 'node:test';
import assert from 'node:assert/strict';
import { createMerchantDashboardHandlers } from '../server/routes/merchantDashboard.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('merchant calls are queried by signed-in merchant and owner, and map only ledger-backed sessions', async () => {
  let captured;
  const handlers = createMerchantDashboardHandlers({
    pool: {
      async query(sql, params) {
        captured = { sql: String(sql), params };
        return { rows: [{
          id: 91,
          customer_phone: '+8801700000000',
          created_at: '2026-11-05T10:00:00.000Z',
          call_duration_seconds: '42.500',
          billed_amount: '4.96',
          currency: 'BDT',
          billing_source: 'wallet',
        }] };
      },
    },
  });
  const res = response();

  await handlers.getCalls({ session: { user: { id: userId, merchantId, role: 'user' } } }, res);

  assert.deepEqual(captured.params, [merchantId, userId]);
  assert.match(captured.sql, /ledger.merchant_id = \$1::uuid/);
  assert.match(captured.sql, /merchant.owner_user_id = \$2::uuid/);
  assert.equal(res.body.source, 'billing_ledger');
  assert.equal(res.body.calls.length, 1);
  assert.equal(res.body.calls[0].durationSeconds, 42.5);
  assert.equal(res.body.calls[0].billingSource, 'wallet');
  assert.equal(res.body.calls[0].recordingUrl, null);
});

test('merchant SIM status is restricted to the merchant device pairing and owner', async () => {
  let captured;
  const handlers = createMerchantDashboardHandlers({
    pool: {
      async query(sql, params) {
        captured = { sql: String(sql), params };
        return { rows: [{
          box_device_id: 'BOX-001',
          device_id: 'BOX-001',
          balance_bdt: '125.50',
          data_mb: '512',
          signal_strength: '4.5',
          raw_payload: { dataQuotaMb: 10240, networkType: '4G LTE', online: true },
          created_at: '2026-11-05T10:00:00.000Z',
          online: true,
        }] };
      },
    },
  });
  const res = response();

  await handlers.getSim({ session: { user: { id: userId, merchantId, role: 'user' } } }, res);

  assert.deepEqual(captured.params, [merchantId, userId]);
  assert.match(captured.sql, /logs.merchant_id = merchant.id/);
  assert.match(captured.sql, /logs.device_id = merchant.box_device_id/);
  assert.equal(res.body.sim.deviceId, 'BOX-001');
  assert.equal(res.body.sim.balance, 125.5);
  assert.equal(res.body.sim.online, true);
});

test('merchant SIM endpoint returns an empty live state when no device is paired yet', async () => {
  const handlers = createMerchantDashboardHandlers({
    pool: { query: async () => ({ rows: [{ box_device_id: null, device_id: null }] }) },
  });
  const res = response();

  await handlers.getSim({ session: { user: { id: userId, merchantId, role: 'user' } } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sim, null);
});

test('dashboard handlers reject missing sessions and admin sessions', async () => {
  let queryCalled = false;
  const handlers = createMerchantDashboardHandlers({
    pool: { query: async () => { queryCalled = true; return { rows: [] }; } },
  });

  const missing = response();
  await handlers.getCalls({ session: null }, missing);
  assert.equal(missing.statusCode, 401);

  const admin = response();
  await handlers.getSim({ session: { user: { id: userId, merchantId, role: 'admin' } } }, admin);
  assert.equal(admin.statusCode, 401);
  assert.equal(queryCalled, false);
});
