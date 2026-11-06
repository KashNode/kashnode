/**
 * Payment processor boundary. The initial implementation verifies a merchant
 * Send Money transfer from a trusted admin-device SMS event. A provider API
 * adapter can implement the same interface without changing top-up routes.
 */
export class SmsMatchingPaymentProcessor {
  constructor({ pool, receiverNumbers = {} }) {
    this.pool = pool;
    this.receiverNumbers = receiverNumbers;
  }

  async ingest(event) {
    const expectedReceiver = this.receiverNumbers[event.gateway];
    if (!expectedReceiver || expectedReceiver !== event.receiverPhone) {
      return { outcome: 'ignored', reason: 'receiver_mismatch' };
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO public.payment_sms_events
          (gateway, trx_id, amount, sender_phone, receiver_phone, received_at, device_id, raw_message)
         VALUES ($1,$2,$3::numeric,$4,$5,$6,$7,$8)
         ON CONFLICT (gateway, trx_id) DO NOTHING
         RETURNING id`,
        [event.gateway, event.trxId, event.amount, event.senderPhone,
          event.receiverPhone, event.receivedAt, event.deviceId, event.rawMessage],
      );
      const eventId = inserted.rows[0]?.id;
      if (!eventId) {
        await client.query('COMMIT');
        return { outcome: 'duplicate_event' };
      }

      const candidate = await client.query(
        `SELECT id, merchant_id FROM public.merchant_topups
          WHERE gateway=$1 AND trx_id=$2 AND amount=$3::numeric
            AND sender_phone=$4 AND status='pending'
          FOR UPDATE`,
        [event.gateway, event.trxId, event.amount, event.senderPhone],
      );
      if (candidate.rowCount !== 1) {
        await client.query('COMMIT');
        return { outcome: candidate.rowCount > 1 ? 'ambiguous' : 'unmatched', eventId };
      }

      const topup = candidate.rows[0];
      const locked = await client.query(
        `UPDATE public.merchant_topups SET status='matched', matched_event_id=$2, credited_at=NOW()
          WHERE id=$1 AND status='pending' RETURNING id, merchant_id, amount`,
        [topup.id, eventId],
      );
      if (!locked.rowCount) {
        await client.query('COMMIT');
        return { outcome: 'already_processed' };
      }

      // Wallet credit and matched status commit atomically; retries cannot credit twice.
      await client.query(
        'UPDATE public.merchants SET wallet_balance=COALESCE(wallet_balance,0)+$2::numeric WHERE id=$1',
        [topup.merchant_id, locked.rows[0].amount],
      );
      await client.query('COMMIT');
      return { outcome: 'matched_and_credited', topupId: topup.id };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') return { outcome: 'duplicate_event' };
      throw error;
    } finally {
      client.release();
    }
  }

  // Also reconcile the opposite arrival order: payment notification first,
  // merchant enters TrxID later. This closes the SMS/top-up race.
  async matchExistingTopup({ merchantId, gateway, trxId }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const eventResult = await client.query(
        `SELECT id, amount, sender_phone FROM public.payment_sms_events
          WHERE gateway=$1 AND trx_id=$2 LIMIT 1 FOR UPDATE`,
        [gateway, trxId],
      );
      const event = eventResult.rows[0];
      if (!event) {
        await client.query('COMMIT');
        return { outcome: 'pending' };
      }
      const topupResult = await client.query(
        `SELECT id, amount FROM public.merchant_topups
          WHERE merchant_id=$1 AND gateway=$2 AND trx_id=$3
            AND amount=$4::numeric AND sender_phone=$5 AND status='pending'
          FOR UPDATE`,
        [merchantId, gateway, trxId, event.amount, event.sender_phone],
      );
      if (topupResult.rowCount !== 1) {
        await client.query('COMMIT');
        return { outcome: 'pending' };
      }
      const topup = topupResult.rows[0];
      const updated = await client.query(
        `UPDATE public.merchant_topups SET status='matched', matched_event_id=$2, credited_at=NOW()
          WHERE id=$1 AND status='pending' RETURNING amount`,
        [topup.id, event.id],
      );
      if (!updated.rowCount) {
        await client.query('COMMIT');
        return { outcome: 'already_processed' };
      }
      await client.query(
        'UPDATE public.merchants SET wallet_balance=COALESCE(wallet_balance,0)+$2::numeric WHERE id=$1',
        [merchantId, updated.rows[0].amount],
      );
      await client.query('COMMIT');
      return { outcome: 'matched_and_credited', topupId: topup.id };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

/** Future API processors (bKash Merchant API, SSLCommerz, etc.) implement
 * createPayment/verifyWebhook and return a normalized verified transfer. */
export function createPaymentProcessor({ pool, env = process.env }) {
  return new SmsMatchingPaymentProcessor({
    pool,
    receiverNumbers: {
      bKash: env.KASHNODE_MFS_RECEIVER_BKASH || '',
      Nagad: env.KASHNODE_MFS_RECEIVER_NAGAD || '',
      Rocket: env.KASHNODE_MFS_RECEIVER_ROCKET || '',
      Upay: env.KASHNODE_MFS_RECEIVER_UPAY || '',
    },
  });
}
