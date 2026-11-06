import test from 'node:test';
import assert from 'node:assert/strict';
import { SmsMatchingPaymentProcessor } from '../server/services/paymentProcessor.js';

function createClient({ duplicateEvent = false, walletRowCount = 1 } = {}) {
  const calls = [];
  const client = {
    async query(sql, args = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      calls.push({ sql: normalized, args });
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
        return { rows: [], rowCount: null };
      }
      if (normalized.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (normalized.startsWith('INSERT INTO public.payment_sms_events')) {
        return { rows: duplicateEvent ? [] : [{ id: 'event-1' }], rowCount: duplicateEvent ? 0 : 1 };
      }
      if (normalized.startsWith('SELECT id, merchant_id FROM public.merchant_topups')) {
        return { rows: [{ id: 'topup-1', merchant_id: 'merchant-1' }], rowCount: 1 };
      }
      if (normalized.startsWith('SELECT id, amount, sender_phone FROM public.payment_sms_events')) {
        return { rows: [{ id: 'event-1', amount: '500.00', sender_phone: '01800000000' }], rowCount: 1 };
      }
      if (normalized.startsWith('SELECT id, amount FROM public.merchant_topups')) {
        return { rows: [{ id: 'topup-1', amount: '500.00' }], rowCount: 1 };
      }
      if (normalized.startsWith('UPDATE public.merchant_topups')) {
        return { rows: [{ id: 'topup-1', merchant_id: 'merchant-1', amount: '500.00' }], rowCount: 1 };
      }
      if (normalized.startsWith('UPDATE public.merchants')) {
        return { rows: [], rowCount: walletRowCount };
      }
      throw new Error(`Unexpected SQL in test: ${normalized}`);
    },
    release() { calls.push({ sql: 'RELEASE', args: [] }); },
  };
  return { client, calls, pool: { connect: async () => client } };
}

const event = {
  gateway: 'bKash',
  trxId: 'ABC12345',
  amount: '500.00',
  senderPhone: '01800000000',
  receiverPhone: '01700000000',
  receivedAt: new Date('2026-11-06T12:00:00.000Z').toISOString(),
  deviceId: 'admin-device',
  rawMessage: 'Received Tk 500.00',
};

test('ignores notifications sent to a receiver that is not configured', async () => {
  let connected = false;
  const processor = new SmsMatchingPaymentProcessor({
    pool: { connect: async () => { connected = true; throw new Error('should not connect'); } },
    receiverNumbers: { bKash: '01900000000' },
  });
  const result = await processor.ingest(event);
  assert.deepEqual(result, { outcome: 'ignored', reason: 'receiver_mismatch' });
  assert.equal(connected, false);
});

test('serializes SMS-first matching and credits the wallet in the same transaction', async () => {
  const { pool, calls } = createClient();
  const processor = new SmsMatchingPaymentProcessor({
    pool, receiverNumbers: { bKash: event.receiverPhone },
  });
  const result = await processor.ingest(event);
  assert.equal(result.outcome, 'matched_and_credited');
  const sql = calls.map(call => call.sql);
  assert.ok(sql.indexOf('BEGIN') < sql.findIndex(value => value.includes('pg_advisory_xact_lock')));
  assert.ok(sql.findIndex(value => value.includes('pg_advisory_xact_lock')) < sql.findIndex(value => value.startsWith('INSERT INTO public.payment_sms_events')));
  assert.ok(sql.findIndex(value => value.startsWith('UPDATE public.merchant_topups')) < sql.findIndex(value => value.startsWith('UPDATE public.merchants')));
  assert.ok(sql.indexOf('COMMIT') > sql.findIndex(value => value.startsWith('UPDATE public.merchants')));
  assert.equal(sql.filter(value => value.startsWith('UPDATE public.merchants')).length, 1);
});

test('duplicate SMS event never credits the wallet again', async () => {
  const { pool, calls } = createClient({ duplicateEvent: true });
  const processor = new SmsMatchingPaymentProcessor({
    pool, receiverNumbers: { bKash: event.receiverPhone },
  });
  const result = await processor.ingest(event);
  assert.deepEqual(result, { outcome: 'duplicate_event' });
  assert.equal(calls.some(call => call.sql.startsWith('UPDATE public.merchants')), false);
  assert.ok(calls.some(call => call.sql === 'COMMIT'));
});

test('top-up-first reconciliation uses the same lock and atomically credits once', async () => {
  const { pool, calls } = createClient();
  const processor = new SmsMatchingPaymentProcessor({ pool });
  const result = await processor.matchExistingTopup({
    merchantId: 'merchant-1', gateway: 'bKash', trxId: event.trxId,
  });
  assert.equal(result.outcome, 'matched_and_credited');
  const sql = calls.map(call => call.sql);
  assert.ok(sql.indexOf('BEGIN') < sql.findIndex(value => value.includes('pg_advisory_xact_lock')));
  assert.ok(sql.findIndex(value => value.includes('pg_advisory_xact_lock')) < sql.findIndex(value => value.startsWith('SELECT id, amount, sender_phone FROM public.payment_sms_events')));
  assert.equal(sql.filter(value => value.startsWith('UPDATE public.merchants')).length, 1);
  assert.ok(sql.indexOf('COMMIT') > sql.findIndex(value => value.startsWith('UPDATE public.merchants')));
});

test('wallet update failure rolls back the matched top-up', async () => {
  const { pool, calls } = createClient({ walletRowCount: 0 });
  const processor = new SmsMatchingPaymentProcessor({
    pool, receiverNumbers: { bKash: event.receiverPhone },
  });
  await assert.rejects(processor.ingest(event), /Wallet credit failed/);
  assert.ok(calls.some(call => call.sql === 'ROLLBACK'));
  assert.equal(calls.some(call => call.sql === 'COMMIT'), false);
});
