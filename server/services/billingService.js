const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class VoiceBillingError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'VoiceBillingError';
    this.code = code;
  }
}

/**
 * Finalize the charge for one live WebSocket session.
 *
 * The database function performs the merchant-row lock, credit deduction,
 * ledger insert, and idempotency check in one PostgreSQL transaction.
 * The merchant's overage_rate_per_min is authoritative (currently default
 * ৳7/min); durations are billed pro-rata to the second and currency is BDT.
 *
 * Calls under one second are retained to millisecond precision. A zero-second
 * session is deliberately skipped and never makes a database request.
 */
export async function finalizeVoiceCallBilling({
  pool,
  merchantId,
  orderId,
  sessionId,
  durationSeconds,
} = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new VoiceBillingError('BILLING_DATABASE_UNAVAILABLE', 'Voice billing database is unavailable.');
  }

  if (!UUID_RE.test(String(merchantId || ''))
    || !UUID_RE.test(String(orderId || ''))
    || !UUID_RE.test(String(sessionId || ''))) {
    throw new VoiceBillingError('BILLING_INVALID_ARGUMENTS', 'Merchant, order, and session IDs must be valid UUIDs.');
  }

  const seconds = Number(durationSeconds);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) {
    throw new VoiceBillingError('BILLING_INVALID_DURATION', 'Call duration must be between zero and 24 hours.');
  }

  const billableSeconds = Number(seconds.toFixed(3));
  if (billableSeconds === 0) {
    return {
      status: 'skipped',
      reason: 'zero_duration',
      durationSeconds: 0,
      walletDebited: false,
      ledgerId: null,
    };
  }

  let result;
  try {
    result = await pool.query(
      `SELECT *
         FROM public.finalize_voice_call_billing($1::uuid, $2::uuid, $3::uuid, $4::numeric)`,
      [merchantId, orderId, sessionId, billableSeconds],
    );
  } catch (error) {
    const databaseCode = typeof error?.message === 'string'
      ? error.message.match(/(?:INSUFFICIENT_VOICE_CREDIT|BILLING_[A-Z_]+|INVALID_[A-Z_]+)/)?.[0]
      : null;
    throw new VoiceBillingError(
      databaseCode || 'BILLING_FINALIZATION_FAILED',
      databaseCode || 'The voice session could not be billed.',
      error,
    );
  }

  const ledger = result.rows?.[0];
  if (!ledger?.id) {
    throw new VoiceBillingError('BILLING_LEDGER_NOT_WRITTEN', 'The billing finalizer returned no ledger record.');
  }

  const billingSource = ledger.billing_source;
  return {
    status: 'billed',
    ledgerId: ledger.id,
    merchantId: ledger.merchant_id,
    orderId: ledger.order_id,
    sessionId: ledger.session_id,
    durationSeconds: Number(ledger.call_duration_seconds),
    billedAmount: Number(ledger.billed_amount),
    currency: ledger.currency,
    ratePerMinute: Number(ledger.rate_per_minute),
    billingSource,
    walletDebited: billingSource === 'wallet',
    voiceMinutesDebited: Number(ledger.voice_minutes_debited || 0),
    idempotentReplay: Boolean(ledger.idempotent_replay),
    createdAt: ledger.created_at,
  };
}
