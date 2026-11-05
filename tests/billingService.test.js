import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeVoiceCallBilling, VoiceBillingError } from '../server/services/billingService.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';

function ledgerRow(overrides = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    merchant_id: merchantId,
    order_id: orderId,
    session_id: sessionId,
    call_duration_seconds: '90.125',
    billed_amount: '10.51',
    currency: 'BDT',
    billing_source: 'wallet',
    voice_minutes_debited: 0,
    rate_per_minute: '7.00',
    created_at: '2026-11-05T05:00:00.000Z',
    idempotent_replay: false,
    ...overrides,
  };
}

test('skips zero-second sessions without contacting the database', async () => {
  let queryCalled = false;
  const result = await finalizeVoiceCallBilling({
    pool: { query: async () => { queryCalled = true; return { rows: [] }; } },
    merchantId,
    orderId,
    sessionId,
    durationSeconds: 0,
  });

  assert.equal(queryCalled, false);
  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'zero_duration');
  assert.equal(result.ledgerId, null);
});

test('rejects invalid identifiers and invalid duration before database access', async () => {
  let queryCalled = false;
  const pool = { query: async () => { queryCalled = true; return { rows: [] }; } };

  await assert.rejects(
    finalizeVoiceCallBilling({ pool, merchantId: 'bad-id', orderId, sessionId, durationSeconds: 1 }),
    error => error instanceof VoiceBillingError && error.code === 'BILLING_INVALID_ARGUMENTS',
  );
  await assert.rejects(
    finalizeVoiceCallBilling({ pool, merchantId, orderId, sessionId, durationSeconds: -1 }),
    error => error instanceof VoiceBillingError && error.code === 'BILLING_INVALID_DURATION',
  );
  assert.equal(queryCalled, false);
});

test('calls the atomic database finalizer with millisecond precision and returns wallet debit details', async () => {
  let query;
  const result = await finalizeVoiceCallBilling({
    pool: {
      async query(sql, params) {
        query = { sql, params };
        return { rows: [ledgerRow()] };
      },
    },
    merchantId,
    orderId,
    sessionId,
    durationSeconds: 90.12549,
  });

  assert.match(query.sql, /finalize_voice_call_billing/);
  assert.deepEqual(query.params, [merchantId, orderId, sessionId, 90.125]);
  assert.equal(result.status, 'billed');
  assert.equal(result.billedAmount, 10.51);
  assert.equal(result.currency, 'BDT');
  assert.equal(result.billingSource, 'wallet');
  assert.equal(result.walletDebited, true);
  assert.equal(result.voiceMinutesDebited, 0);
  assert.equal(result.idempotentReplay, false);
});

test('reports prepaid voice-minute coverage and idempotent replays', async () => {
  const result = await finalizeVoiceCallBilling({
    pool: {
      async query() {
        return {
          rows: [ledgerRow({
            billing_source: 'voice_minutes',
            voice_minutes_debited: 2,
            idempotent_replay: true,
          })],
        };
      },
    },
    merchantId,
    orderId,
    sessionId,
    durationSeconds: 90.125,
  });

  assert.equal(result.billingSource, 'voice_minutes');
  assert.equal(result.walletDebited, false);
  assert.equal(result.voiceMinutesDebited, 2);
  assert.equal(result.idempotentReplay, true);
});

test('surfaces insufficient-credit database failures as a stable billing error code', async () => {
  await assert.rejects(
    finalizeVoiceCallBilling({
      pool: { query: async () => { throw new Error('INSUFFICIENT_VOICE_CREDIT'); } },
      merchantId,
      orderId,
      sessionId,
      durationSeconds: 60,
    }),
    error => error instanceof VoiceBillingError && error.code === 'INSUFFICIENT_VOICE_CREDIT',
  );
});
