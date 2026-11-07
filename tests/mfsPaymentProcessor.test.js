import test from 'node:test';
import assert from 'node:assert/strict';
import { SmsMatchingPaymentProcessor } from '../server/services/paymentProcessor.js';

test('incoming MFS event approves a matching plan upgrade and activates the plan atomically', async () => {
  const statements = [];
  const client = {
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes('SELECT phone_number FROM public.mfs_payment_destinations')) {
        return { rowCount: 1, rows: [{ phone_number: '+8801912345678' }] };
      }
      if (sql.includes('INSERT INTO public.payment_sms_events')) return { rowCount: 1, rows: [{ id: 'event-1' }] };
      if (sql.includes('FROM public.merchant_topups')) return { rowCount: 0, rows: [] };
      if (sql.includes('FROM public.merchant_plan_upgrade_requests')) {
        return { rowCount: 1, rows: [{ id: 'upgrade-1', merchant_id: 'merchant-1', requested_plan_slug: 'premium', expected_amount: '1200.00' }] };
      }
      if (sql.includes('UPDATE public.merchant_plan_upgrade_requests')) {
        return { rowCount: 1, rows: [{ merchant_id: 'merchant-1', requested_plan_slug: 'premium' }] };
      }
      if (sql.includes('UPDATE public.merchants SET subscription_plan')) return { rowCount: 1, rows: [{ id: 'merchant-1' }] };
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };
  const pool = { connect: async () => client };
  const processor = new SmsMatchingPaymentProcessor({ pool });
  const result = await processor.ingest({
    gateway: 'bKash', trxId: 'ABC123XYZ', amount: '1200.00',
    senderPhone: '01712345678', receiverPhone: '01912345678',
    receivedAt: '2026-11-07T10:30:00.000Z', deviceId: 'mfs-01', rawMessage: 'Payment received',
  });
  assert.equal(result.outcome, 'upgrade_approved_and_activated');
  assert.equal(result.upgradeRequestId, 'upgrade-1');
  assert.ok(statements.some(x => x.sql.includes("SET status='approved', payment_event_id=$2")));
  assert.ok(statements.some(x => x.sql.includes('UPDATE public.merchants SET subscription_plan=$2')));
  assert.equal(statements.at(-1).sql, 'COMMIT');
});

test('database receiver numbers are normalized before comparison', async () => {
  const client = {
    async query(sql) {
      if (sql.includes('SELECT phone_number')) return { rows: [{ phone_number: '008801912345678' }] };
      throw new Error('unexpected query');
    },
    release() {},
  };
  const processor = new SmsMatchingPaymentProcessor({ pool: { connect: async () => client } });
  assert.equal(await processor.receiverIsConfigured(client, 'Rocket', '01912345678'), true);
});
