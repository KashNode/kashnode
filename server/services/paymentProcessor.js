import { normalizeBdPhone } from '../utils/mfs.js';

export { normalizeBdPhone };

export class SmsMatchingPaymentProcessor {
  constructor({ pool, receiverNumbers = {}, legacyReceiverNumbers = {} }) { this.pool = pool; this.receiverNumbers = receiverNumbers; this.legacyReceiverNumbers = legacyReceiverNumbers; }

  async lockTransfer(client, gateway, trxId) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${gateway}:${trxId}`]);
  }

  async receiverIsConfigured(client, gateway, receiverPhone) {
    if (this.receiverNumbers[gateway]) return normalizeBdPhone(this.receiverNumbers[gateway]) === receiverPhone;
    const result = await client.query(
      'SELECT phone_number FROM public.mfs_payment_destinations WHERE provider=$1 AND is_active=TRUE',
      [gateway],
    );
    if (result.rows.length) return result.rows.some(row => normalizeBdPhone(row.phone_number) === receiverPhone);
    // Compatibility for deployments that still have receiver numbers only in env.
    return normalizeBdPhone(this.legacyReceiverNumbers[gateway]) === receiverPhone;
  }

  async creditWallet(client, merchantId, amount) {
    const result = await client.query(
      'UPDATE public.merchants SET wallet_balance=COALESCE(wallet_balance,0)+$2::numeric WHERE id=$1',
      [merchantId, amount],
    );
    if (result.rowCount !== 1) throw new Error('Wallet credit failed: merchant row was not updated.');
  }

  async applyMatch(client, event, eventId, merchantId = null) {
    const topups = await client.query(
      `SELECT id, merchant_id FROM public.merchant_topups
        WHERE gateway=$1 AND trx_id=$2 AND amount=$3::numeric
          AND sender_phone=$4 AND status='pending'
          AND ($5::uuid IS NULL OR merchant_id=$5)
        FOR UPDATE`,
      [event.gateway, event.trx_id, event.amount, event.sender_phone, merchantId],
    );
    const upgrades = await client.query(
      `SELECT id, merchant_id, requested_plan_slug, expected_amount
         FROM public.merchant_plan_upgrade_requests
        WHERE gateway=$1 AND trx_id=$2 AND expected_amount=$3::numeric
          AND sender_phone=$4 AND status='pending_review'
          AND payment_event_id IS NULL
          AND ($5::uuid IS NULL OR merchant_id=$5)
        FOR UPDATE`,
      [event.gateway, event.trx_id, event.amount, event.sender_phone, merchantId],
    );

    if (topups.rowCount + upgrades.rowCount !== 1) {
      return { outcome: topups.rowCount + upgrades.rowCount > 1 ? 'ambiguous' : 'unmatched', eventId };
    }

    if (topups.rowCount === 1) {
      const topup = topups.rows[0];
      const updated = await client.query(
        `UPDATE public.merchant_topups
            SET status='matched', matched_event_id=$2, credited_at=NOW()
          WHERE id=$1 AND status='pending'
          RETURNING id, merchant_id, amount`,
        [topup.id, eventId],
      );
      if (!updated.rowCount) return { outcome: 'already_processed', eventId };
      await this.creditWallet(client, updated.rows[0].merchant_id, updated.rows[0].amount);
      return { outcome: 'matched_and_credited', topupId: topup.id, eventId };
    }

    const upgrade = upgrades.rows[0];
    const updated = await client.query(
      `UPDATE public.merchant_plan_upgrade_requests
          SET status='approved', payment_event_id=$2, reviewed_at=NOW()
        WHERE id=$1 AND status='pending_review' AND payment_event_id IS NULL
        RETURNING merchant_id, requested_plan_slug`,
      [upgrade.id, eventId],
    );
    if (!updated.rowCount) return { outcome: 'already_processed', eventId };
    const activated = await client.query(
      'UPDATE public.merchants SET subscription_plan=$2 WHERE id=$1 RETURNING id',
      [updated.rows[0].merchant_id, updated.rows[0].requested_plan_slug],
    );
    if (activated.rowCount !== 1) throw new Error('Plan activation failed: merchant row was not updated.');
    return { outcome: 'upgrade_approved_and_activated', upgradeRequestId: upgrade.id, eventId };
  }

  async ingest(event) {
    if (this.receiverNumbers[event.gateway] && normalizeBdPhone(this.receiverNumbers[event.gateway]) !== event.receiverPhone) {
      return { outcome: 'ignored', reason: 'receiver_mismatch' };
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockTransfer(client, event.gateway, event.trxId);
      if (!await this.receiverIsConfigured(client, event.gateway, event.receiverPhone)) {
        await client.query('ROLLBACK');
        return { outcome: 'ignored', reason: 'receiver_mismatch' };
      }
      const inserted = await client.query(
        `INSERT INTO public.payment_sms_events
          (gateway,trx_id,amount,sender_phone,receiver_phone,received_at,device_id,raw_message)
         VALUES ($1,$2,$3::numeric,$4,$5,$6,$7,$8)
         ON CONFLICT (gateway,trx_id) DO NOTHING RETURNING id`,
        [event.gateway,event.trxId,event.amount,event.senderPhone,event.receiverPhone,event.receivedAt,event.deviceId,event.rawMessage],
      );
      const eventId = inserted.rows[0]?.id;
      if (!eventId) {
        await client.query('COMMIT');
        return { outcome: 'duplicate_event' };
      }
      const normalized = {
        gateway: event.gateway, trx_id: event.trxId, amount: event.amount,
        sender_phone: event.senderPhone,
      };
      const outcome = await this.applyMatch(client, normalized, eventId);
      await client.query('COMMIT');
      return outcome;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') return { outcome: 'duplicate_event' };
      throw error;
    } finally { client.release(); }
  }

  async matchExistingTopup({ merchantId, gateway, trxId }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockTransfer(client, gateway, trxId);
      const result = await client.query(
        `SELECT id, amount, sender_phone
           FROM public.payment_sms_events WHERE gateway=$1 AND trx_id=$2
          LIMIT 1 FOR UPDATE`,
        [gateway, trxId],
      );
      const event = result.rows[0];
      if (!event) { await client.query('COMMIT'); return { outcome: 'pending' }; }
      const outcome = await this.applyMatch(client, { ...event, gateway, trx_id: trxId }, event.id, merchantId);
      await client.query('COMMIT');
      return outcome;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }
}

export function createPaymentProcessor({ pool, env = process.env }) {
  return new SmsMatchingPaymentProcessor({
    pool,
    legacyReceiverNumbers: {
      bKash: env.KASHNODE_MFS_RECEIVER_BKASH || '',
      Nagad: env.KASHNODE_MFS_RECEIVER_NAGAD || '',
      Rocket: env.KASHNODE_MFS_RECEIVER_ROCKET || '',
      Upay: env.KASHNODE_MFS_RECEIVER_UPAY || '',
    },
  });
}
