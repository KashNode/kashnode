import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBdPhone } from '../server/utils/mfs.js';
import { createDeviceSignatureVerifier, signDevicePayload } from '../server/middleware/deviceSignature.js';

test('normalizeBdPhone canonicalizes local and international Bangladesh numbers', () => {
  assert.equal(normalizeBdPhone('01712345678'), '01712345678');
  assert.equal(normalizeBdPhone('+8801712345678'), '01712345678');
  assert.equal(normalizeBdPhone('008801712345678'), '01712345678');
  assert.equal(normalizeBdPhone('0171234567'), null);
  assert.equal(normalizeBdPhone('not-a-number'), null);
});

function responseRecorder() {
  return {
    statusCode: 200, payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('device signature verifier accepts a valid request once and rejects replay', async () => {
  const secret = 'a'.repeat(48);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = 'n'.repeat(24);
  const rawBody = Buffer.from(JSON.stringify({ device_id: 'mfs-01', gateway: 'bKash' }));
  const signature = signDevicePayload({ secret, timestamp, nonce, rawBody: rawBody.toString('utf8') });
  const used = new Set();
  const pool = { query: async (_sql, values) => {
    if (used.has(values[0])) return { rowCount: 0 };
    used.add(values[0]); return { rowCount: 1 };
  } };
  const middleware = createDeviceSignatureVerifier({ pool, secret });
  const req = {
    rawBody, body: { device_id: 'mfs-01' },
    get(name) {
      return {
        'x-kashnode-timestamp': timestamp,
        'x-kashnode-nonce': nonce,
        'x-kashnode-signature': signature,
      }[name.toLowerCase()];
    },
  };
  let nextCalls = 0;
  const res1 = responseRecorder();
  await middleware(req, res1, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);

  const res2 = responseRecorder();
  await middleware(req, res2, () => { nextCalls += 1; });
  assert.equal(res2.statusCode, 409);
  assert.equal(nextCalls, 1);
});

test('device signature verifier rejects body tampering and stale timestamps', async () => {
  const secret = 'b'.repeat(48);
  const timestamp = String(Math.floor(Date.now() / 1000) - 1000);
  const nonce = 'x'.repeat(24);
  const rawBody = Buffer.from('{"device_id":"mfs-01"}');
  const signature = signDevicePayload({ secret, timestamp, nonce, rawBody: rawBody.toString('utf8') });
  const middleware = createDeviceSignatureVerifier({ pool: { query: async () => ({ rowCount: 1 }) }, secret });
  const req = { rawBody, body: { device_id: 'mfs-01' }, get: name => ({
    'x-kashnode-timestamp': timestamp, 'x-kashnode-nonce': nonce, 'x-kashnode-signature': signature,
  }[name.toLowerCase()]) };
  const res = responseRecorder();
  let nextCalls = 0;
  await middleware(req, res, () => { nextCalls += 1; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalls, 0);
});
