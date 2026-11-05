import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceStatusHandler } from '../server/routes/deviceStatus.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const merchantSecret = 'merchant-webhook-secret-0123456789abcdef';

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function request(headers = {}, body = {}) {
  return {
    headers,
    body,
    get(name) { return headers[name.toLowerCase()] || ''; },
  };
}

test('device sync requires a merchant-specific credential even with the global device middleware', async () => {
  let queryCalled = false;
  const handler = createDeviceStatusHandler({
    pool: { query: async () => { queryCalled = true; return { rows: [] }; } },
  });
  const res = response();

  await handler(request({}, {
    deviceId: 'BOX-001', balance: 10, internetDataMb: 20, signalStrength: 4,
  }), res);

  assert.equal(res.statusCode, 401);
  assert.equal(queryCalled, false);
});

test('first authenticated device heartbeat pairs and stores telemetry under its merchant', async () => {
  const statements = [];
  const handler = createDeviceStatusHandler({
    pool: {
      async query(sql, params) {
        const text = String(sql);
        statements.push({ text, params });
        if (text.includes('SELECT id') && text.includes('webhook_secret')) {
          return { rows: [{ id: merchantId }] };
        }
        if (text.includes('UPDATE public.merchants')) return { rows: [{ id: merchantId }] };
        if (text.includes('INSERT INTO public.device_logs')) {
          return { rows: [{ created_at: '2026-11-05T10:00:00.000Z' }] };
        }
        throw new Error('Unexpected query: ' + text);
      },
    },
    logger: { info() {} },
  });
  const res = response();

  await handler(request({ 'x-merchant-secret': merchantSecret }, {
    deviceId: 'BOX-001',
    balance: 125.5,
    internetDataMb: 512,
    signalStrength: 4.5,
    dataQuotaMb: 10240,
    networkType: '4G LTE',
    online: true,
  }), res);

  assert.equal(res.statusCode, 202);
  assert.deepEqual(statements[0].params, [merchantSecret]);
  assert.deepEqual(statements[1].params, [merchantId, 'BOX-001']);
  assert.equal(statements[2].params[0], merchantId);
  assert.equal(statements[2].params[1], 'BOX-001');
  assert.equal(res.body.status, 'success');
});

test('device cannot overwrite a different existing merchant pairing', async () => {
  const handler = createDeviceStatusHandler({
    pool: {
      async query(sql) {
        if (String(sql).includes('SELECT id')) return { rows: [{ id: merchantId }] };
        if (String(sql).includes('UPDATE public.merchants')) return { rows: [] };
        throw new Error('Device logs must not be inserted when pairing fails.');
      },
    },
    logger: { info() {} },
  });
  const res = response();

  await handler(request({ 'x-merchant-secret': merchantSecret }, {
    deviceId: 'BOX-OTHER',
    balance: 10,
    internetDataMb: 20,
    signalStrength: 4,
  }), res);

  assert.equal(res.statusCode, 409);
});
