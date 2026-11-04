const PROVIDER_NAMES = { bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', upay: 'Upay' };

export function normalizeBdPhone(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const digits = String(value).replace(/\D/g, '');
  const last11 = digits.slice(-11);
  return /^01[3-9]\d{8}$/.test(last11) ? last11 : null;
}

export function normalizeGateway(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  return PROVIDER_NAMES[key] || null;
}

function normalizeMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount.toFixed(2);
}

const candidateSql = [
  'SELECT o.id, o.customer_phone, o.customer_trx_id',
  'FROM orders o',
  'WHERE o.merchant_id = $1',
  "  AND o.payment_status = 'unpaid'",
  '  AND o.total_amount = $2::numeric',
  "  AND regexp_replace(lower(coalesce(o.payment_method, '')), '[^a-z0-9]+', '_', 'g') NOT IN ('cod', 'cash_on_delivery')",
  "  AND lower(coalesce(o.payment_method, '')) NOT LIKE '%cash on delivery%'",
  '  AND (',
  "    ($4::text IS NOT NULL AND upper(trim(coalesce(o.customer_trx_id, ''))) = upper($4))",
  "    OR ($3::text IS NOT NULL AND right(regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g'), 11) = $3)",
  '  )',
  'ORDER BY o.created_at ASC, o.id ASC',
  'FOR UPDATE OF o',
].join('\n');

/**
 * Reconcile one persisted SMS atomically. The database transaction and unique
 * merchant/gateway/TrxID index are the final guards against concurrent replay.
 */
export async function reconcileSms({ pool, smsId }) {
  if (!pool || !smsId) throw new TypeError('pool and smsId are required.');

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const smsResult = await client.query(
      'SELECT id, merchant_id, customer_phone, provider, parsed_trxid, parsed_amount, is_reconciled FROM raw_sms_inbox WHERE id = $1 FOR UPDATE',
      [smsId],
    );
    const sms = smsResult.rows[0];
    if (!sms) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return { outcome: 'not_found' };
    }
    if (sms.is_reconciled) {
      await client.query('COMMIT');
      transactionOpen = false;
      return { outcome: 'already_reconciled' };
    }

    const gateway = normalizeGateway(sms.provider);
    const amount = normalizeMoney(sms.parsed_amount);
    const phone = normalizeBdPhone(sms.customer_phone);
    const trxId = typeof sms.parsed_trxid === 'string' ? sms.parsed_trxid.trim().toUpperCase() : '';

    if (!sms.merchant_id || !gateway || !trxId || !amount) {
      await client.query('COMMIT');
      transactionOpen = false;
      return { outcome: 'unmatched', reason: 'incomplete_sms' };
    }

    const candidates = await client.query(candidateSql, [
      sms.merchant_id,
      amount,
      phone,
      trxId,
    ]);

    if (candidates.rows.length === 0) {
      await client.query('COMMIT');
      transactionOpen = false;
      return { outcome: 'unmatched' };
    }

    if (candidates.rows.length > 1) {
      const orderIds = candidates.rows.map(row => row.id);
      await client.query(
        "UPDATE orders SET payment_status = 'manual_review' WHERE id = ANY($1::uuid[]) AND payment_status = 'unpaid'",
        [orderIds],
      );
      await client.query('COMMIT');
      transactionOpen = false;
      return { outcome: 'manual_review', orderIds };
    }

    const order = candidates.rows[0];
    const inserted = await client.query(
      "INSERT INTO transactions (merchant_id, gateway, trx_id, sender_phone, amount, reference_user_id, status) VALUES ($1, $2, $3, $4, $5::numeric, $6, 'matched') ON CONFLICT (merchant_id, gateway, trx_id) WHERE merchant_id IS NOT NULL DO NOTHING RETURNING id",
      [sms.merchant_id, gateway, trxId, sms.customer_phone, amount, String(order.id)],
    );

    if (!inserted.rowCount) {
      await client.query('UPDATE raw_sms_inbox SET is_reconciled = TRUE WHERE id = $1', [sms.id]);
      await client.query('COMMIT');
      transactionOpen = false;
      return { outcome: 'duplicate_transaction' };
    }

    const updated = await client.query(
      "UPDATE orders SET payment_status = 'paid' WHERE id = $1 AND payment_status = 'unpaid' RETURNING id",
      [order.id],
    );
    if (!updated.rowCount) {
      throw new Error('Order status changed before reconciliation completed.');
    }

    await client.query('UPDATE raw_sms_inbox SET is_reconciled = TRUE WHERE id = $1', [sms.id]);
    await client.query('COMMIT');
    transactionOpen = false;
    return { outcome: 'matched', orderId: order.id };
  } catch (error) {
    if (transactionOpen) {
      await client.query('ROLLBACK').catch(() => {});
      transactionOpen = false;
    }
    if (error.code === '23505') return { outcome: 'duplicate_transaction' };
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Re-run older unmatched SMS after WooCommerce delivers an order later than
 * the payment notification. This closes the webhook-ordering race.
 */
export async function reconcilePendingSmsForMerchant({ pool, merchantId, limit = 250 }) {
  if (!pool || !merchantId) throw new TypeError('pool and merchantId are required.');
  const result = await pool.query(
    'SELECT id FROM raw_sms_inbox WHERE merchant_id = $1 AND is_reconciled = FALSE AND parsed_trxid IS NOT NULL ORDER BY received_at ASC LIMIT $2',
    [merchantId, Math.max(1, Math.min(Number(limit) || 250, 1000))],
  );

  const outcomes = [];
  for (const row of result.rows) {
    outcomes.push({ smsId: row.id, ...(await reconcileSms({ pool, smsId: row.id })) });
  }
  return outcomes;
}
