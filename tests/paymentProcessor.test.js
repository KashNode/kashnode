import test from 'node:test';
import assert from 'node:assert/strict';
import { SmsMatchingPaymentProcessor } from '../server/services/paymentProcessor.js';

test('payment processor ignores notifications sent to an unconfigured receiver', async () => {
  let connected = false;
  const processor = new SmsMatchingPaymentProcessor({
    pool: { connect: async () => { connected = true; throw new Error('should not connect'); } },
    receiverNumbers: { bKash: '01700000000' },
  });
  const result = await processor.ingest({
    gateway: 'bKash', trxId: 'ABC12345', amount: '500.00',
    senderPhone: '01800000000', receiverPhone: '01900000000',
    receivedAt: new Date().toISOString(), deviceId: 'admin-device', rawMessage: 'test',
  });
  assert.deepEqual(result, { outcome: 'ignored', reason: 'receiver_mismatch' });
  assert.equal(connected, false);
});
