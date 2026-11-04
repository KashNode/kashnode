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

function amountToMinor(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * Reconcile one persisted SMS atomically. Ambiguous candidates are never auto-paid.
 * The caller passes a pg Pool; this service owns and releases its transaction client.
 */
export async function reconcileSms({ pool, smsId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const smsResult = await client.query(
      `SELECT id, merchant_id, sender_number, provider, customer_phone, parsed_trxid,
              parsed_amount, is_reconciled
       FROM raw_sms_inbox WHERE id = $1 FOR UPDATE`, [smsId]);
    const sms = smsResult.rows[0];
    if (!sms) { await client.query('ROLLBACK'); return { outcome: 'not_found' }; }
    if (sms.is_reconciled) { await client.query('COMMIT'); return { outcome: 'already_reconciled' }; }

    const gateway = normalizeGateway(sms.provider);
    const amountMinor = amountToMinor(sms.parsed_amount);
    const phone = normalizeBdPhone(sms.customer_phone);
    if (!gateway || !sms.parsed_trxid || amountMinor === null) {
      await client.query('COMMIT');
      return { outcome: 'unmatched', reason: 'incomplete_sms' };
    }

    const duplicate = await client.query(
      'SELECT id FROM transactions WHERE merchant_id = $1 AND gateway = $2 AND trx_id = $3 LIMIT 1',
      [sms.merchant_id, gateway, sms.parsed_trxid]);
    if (duplicate.rowCount) {
      await client.query('COMMIT');
      return { outcome: 'duplicate_transaction' };
    }

    // COD orders are deliberately excluded. Customer-supplied TrxID is an
    // alternative identifier; otherwise use normalized phone + exact amount.
    const candidates = await client.query(
      `SELECT id, customer_phone, customer_trx_id
       FROM orders
       WHERE merchant_id = $1
         AND payment_status = 'unpaid'
         AND round(total_amount * 100) = $2
         AND lower(coalesce(payment_method, '')) NOT IN ('cod','cash_on_delivery','cash on delivery')
         AND lower(coalesce(payment_method, '')) NOT LIKE '%cash on delivery%'
         AND (
           ($3::text IS NOT NULL AND upper(customer_trx_id) = upper($4))
           OR ($3::text IS NULL AND regexp_replace(customer_phone, '\D', '', 'g') LIKE '%' || $5)
         )
       ORDER BY created_at ASC
       FOR UPDATE`,
      [sms.merchant_id, amountMinor, sms.parsed_trxid, phone]);
    const validCandidates = candidates.rows.filter(row => {
      if (row.customer_trx_id && row.customer_trx_id.toUpperCase() === sms.parsed_trxid.toUpperCase()) return true;
      return phone && normalizeBdPhone(row.customer_phone) === phone;
    });

    if (validCandidates.length === 0) {
      await client.query('COMMIT');
      return { outcome: 'unmatched' };
    }

    if (validCandidates.length > 1) {
      await client.query(
        `UPDATE orders SET payment_status = 'manual_review'
         WHERE id = ANY($1::uuid[])`, [validCandidates.map(row => row.id)]);
      await client.query('COMMIT');
      return { outcome: 'manual_review', orderIds: validCandidates.map(row => row.id) };
    }

    const order = validCandidates[0];
    await client.query(
      `INSERT INTO transactions (merchant_id, gateway, trx_id, sender_phone, amount, reference_user_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'matched')`,
      [sms.merchant_id, gateway, sms.parsed_trxid, sms.customer_phone, sms.parsed_amount, order.id]);
    await client.query(
      `UPDATE orders SET payment_status = 'paid'
       WHERE id = $1 AND payment_status = 'unpaid'`, [order.id]);
    await client.query('UPDATE raw_sms_inbox SET is_reconciled = TRUE WHERE id = $1', [sms.id]);
    await client.query('COMMIT');
    return { outcome: 'matched', orderId: order.id };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return { outcome: 'duplicate_transaction' };
    throw error;
  } finally {
    client.release();
  }
}
