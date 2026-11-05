import crypto from 'node:crypto';

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
  maxRetries = 2,
  retryDelayMs = 100,
} = {}) {
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

  if (!pool || typeof pool.query !== 'function') {
    throw new VoiceBillingError('BILLING_DATABASE_UNAVAILABLE', 'Voice billing database is unavailable.');
  }

  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 5
    || !Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 5000) {
    throw new VoiceBillingError('BILLING_INVALID_RETRY_POLICY', 'Billing retry policy is invalid.');
  }

  const sql = `SELECT *
    FROM public.finalize_voice_call_billing($1::uuid, $2::uuid, $3::uuid, $4::numeric)`;
  const params = [merchantId, orderId, sessionId, billableSeconds];
  let result;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      result = await pool.query(sql, params);
      break;
    } catch (error) {
      const databaseCode = typeof error?.message === 'string'
        ? error.message.match(/(?:INSUFFICIENT_VOICE_CREDIT|BILLING_[A-Z_]+|INVALID_[A-Z_]+)/)?.[0]
        : null;
      const retryableCodes = new Set([
        'ECONNRESET', 'ETIMEDOUT', 'EPIPE',
        '08000', '08003', '08006', '57P01', '40001',
      ]);
      const retryable = retryableCodes.has(error?.code) && attempt < maxRetries;
      if (retryable) {
        const delayMs = Math.min(retryDelayMs * (2 ** attempt), 2000);
        if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      throw new VoiceBillingError(
        databaseCode || 'BILLING_FINALIZATION_FAILED',
        databaseCode || 'The voice session could not be billed.',
        error,
      );
    }
  }

  const ledger = result?.rows?.[0];
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


function logQueue(logger, level, event, details = {}) {
  try { logger?.[level]?.('[KashNode Billing Queue]', { event, ...details }); } catch { /* logging must not change billing state */ }
}

/**
 * Durable PostgreSQL outbox for live voice billing.
 *
 * A session row is inserted before session.ready is sent to the client. Normal
 * disconnect moves it to pending. If the process disappears while the row is
 * active, a later process converts it to pending using the last persisted
 * heartbeat as a conservative end-time estimate. Billing itself is idempotent
 * by session_id, so a crash after wallet debit but before queue acknowledgement
 * is safe to replay.
 */
export function createVoiceBillingQueue({
  pool,
  billingFinalizer = finalizeVoiceCallBilling,
  logger = console,
  intervalMs = 5000,
  staleAfterMs = 60000,
  processingLeaseMs = 120000,
} = {}) {
  const workerId = crypto.randomUUID();
  let timer = null;
  let running = null;
  let started = false;
  let stopping = false;

  function assertPool() {
    if (!pool || typeof pool.query !== 'function') {
      throw new VoiceBillingError('BILLING_DATABASE_UNAVAILABLE', 'Durable voice billing requires a PostgreSQL pool.');
    }
  }

  async function beginSession({ merchantId, orderId, sessionId, startedAt = new Date() }) {
    assertPool();
    if (!UUID_RE.test(String(merchantId || ''))
      || !UUID_RE.test(String(orderId || ''))
      || !UUID_RE.test(String(sessionId || ''))) {
      throw new VoiceBillingError('BILLING_INVALID_ARGUMENTS', 'Merchant, order, and session IDs must be valid UUIDs.');
    }

    const result = await pool.query(
      `INSERT INTO public.voice_session_billing_jobs
        (session_id, worker_id, merchant_id, order_id, status, started_at, last_heartbeat_at, next_attempt_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'active', $5::timestamptz, $5::timestamptz, NOW())
       ON CONFLICT (session_id) DO NOTHING
       RETURNING session_id`,
      [sessionId, workerId, merchantId, orderId, startedAt],
    );
    if (!result.rows?.[0]) {
      throw new VoiceBillingError('BILLING_SESSION_ALREADY_EXISTS', 'A durable billing record already exists for this voice session.');
    }
    return true;
  }

  async function recordHeartbeat(sessionId) {
    assertPool();
    await pool.query(
      `UPDATE public.voice_session_billing_jobs
          SET last_heartbeat_at = GREATEST(last_heartbeat_at, NOW()),
              updated_at = NOW()
        WHERE session_id = $1::uuid
          AND status = 'active'`,
      [sessionId],
    );
  }

  async function enqueueFinalization({ merchantId, orderId, sessionId, durationSeconds }) {
    assertPool();
    const seconds = Number(durationSeconds);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) {
      throw new VoiceBillingError('BILLING_INVALID_DURATION', 'Call duration must be between zero and 24 hours.');
    }
    const rounded = Number(seconds.toFixed(3));
    const status = rounded > 0 ? 'pending' : 'skipped';
    const result = await pool.query(
      `UPDATE public.voice_session_billing_jobs
          SET status = $4,
              duration_seconds = $5::numeric,
              ended_at = NOW(),
              last_heartbeat_at = NOW(),
              next_attempt_at = NOW(),
              locked_at = NULL,
              updated_at = NOW()
        WHERE session_id = $1::uuid
          AND merchant_id = $2::uuid
          AND order_id = $3::uuid
          AND status IN ('active', 'pending', 'processing')
        RETURNING session_id`,
      [sessionId, merchantId, orderId, status, rounded],
    );
    if (!result.rows?.length) {
      const existing = await pool.query(
        `SELECT status, merchant_id, order_id
           FROM public.voice_session_billing_jobs
          WHERE session_id = $1::uuid
          LIMIT 1`,
        [sessionId],
      );
      const row = existing.rows?.[0];
      if (row && row.merchant_id === merchantId && row.order_id === orderId
        && ['completed', 'skipped'].includes(row.status)) return false;
      throw new VoiceBillingError('BILLING_JOB_NOT_FOUND', 'The durable voice billing record could not be finalized.');
    }
    return true;
  }

  async function touchWorker() {
    assertPool();
    await pool.query(
      `INSERT INTO public.voice_billing_worker_instances (worker_id, last_seen_at, stopped_at)
       VALUES ($1::uuid, NOW(), NULL)
       ON CONFLICT (worker_id) DO UPDATE
         SET last_seen_at = NOW(), stopped_at = NULL`,
      [workerId],
    );
  }

  async function recoverAbandonedSessions() {
    assertPool();
    const result = await pool.query(
      `UPDATE public.voice_session_billing_jobs AS job
          SET duration_seconds = ROUND(GREATEST(
                0.001,
                EXTRACT(EPOCH FROM (job.last_heartbeat_at - job.started_at))
              )::numeric, 3),
              ended_at = job.last_heartbeat_at,
              status = 'pending',
              next_attempt_at = NOW(),
              last_error = 'RECOVERED_AFTER_PROCESS_RESTART',
              locked_at = NULL,
              updated_at = NOW()
        WHERE job.status = 'active'
          AND job.last_heartbeat_at < NOW() - ($1::double precision * INTERVAL '1 millisecond')
          AND (
            EXISTS (
              SELECT 1
                FROM public.voice_billing_worker_instances AS old_worker
               WHERE old_worker.worker_id = job.worker_id
                 AND old_worker.stopped_at IS NOT NULL
            )
            OR NOT EXISTS (
              SELECT 1
                FROM public.voice_billing_worker_instances AS live_worker
               WHERE live_worker.worker_id = job.worker_id
                 AND live_worker.stopped_at IS NULL
                 AND live_worker.last_seen_at >= NOW() - ($1::double precision * INTERVAL '1 millisecond')
            )
          )
        RETURNING job.session_id, job.status, job.duration_seconds`,
      [staleAfterMs],
    );
    if (result.rows?.length) {
      logQueue(logger, 'warn', 'abandoned_voice_sessions_recovered', { count: result.rows.length });
    }
    return result.rows || [];
  }

  async function claimNextJob(force = false) {
    assertPool();
    const result = await pool.query(
      `WITH candidate AS (
         SELECT session_id
           FROM public.voice_session_billing_jobs
          WHERE (status = 'pending' AND ($1::boolean OR next_attempt_at <= NOW()))
             OR (status = 'processing'
                 AND locked_at < NOW() - ($2::double precision * INTERVAL '1 millisecond'))
          ORDER BY next_attempt_at ASC, created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
       UPDATE public.voice_session_billing_jobs AS job
          SET status = 'processing',
              attempts = attempts + 1,
              locked_at = NOW(),
              updated_at = NOW()
         FROM candidate
        WHERE job.session_id = candidate.session_id
       RETURNING job.session_id, job.merchant_id, job.order_id, job.duration_seconds, job.attempts`,
      [force, processingLeaseMs],
    );
    return result.rows?.[0] || null;
  }

  async function processOne(force = false) {
    const job = await claimNextJob(force);
    if (!job) return false;

    try {
      const result = await billingFinalizer({
        pool,
        merchantId: job.merchant_id,
        orderId: job.order_id,
        sessionId: job.session_id,
        durationSeconds: Number(job.duration_seconds),
      });
      await pool.query(
        `UPDATE public.voice_session_billing_jobs
            SET status = $2,
                ledger_id = $3::uuid,
                locked_at = NULL,
                last_error = NULL,
                updated_at = NOW()
          WHERE session_id = $1::uuid
            AND status = 'processing'`,
        [job.session_id, result?.status === 'skipped' ? 'skipped' : 'completed', result?.ledgerId || null],
      );
      logQueue(logger, 'info', 'voice_billing_job_completed', {
        sessionId: job.session_id,
        attempts: Number(job.attempts),
        ledgerId: result?.ledgerId || null,
        status: result?.status || 'billed',
      });
    } catch (error) {
      const code = String(error?.code || 'BILLING_FINALIZATION_FAILED').slice(0, 100);
      try {
        await pool.query(
          `UPDATE public.voice_session_billing_jobs
              SET status = 'pending',
                  locked_at = NULL,
                  next_attempt_at = NOW() + LEAST(
                    3600::double precision,
                    (15 * POWER(2, LEAST(attempts - 1, 8)))::double precision
                  ) * INTERVAL '1 second',
                  last_error = $2,
                  updated_at = NOW()
            WHERE session_id = $1::uuid
              AND status = 'processing'`,
          [job.session_id, code],
        );
      } catch (persistError) {
        // If the DB is unreachable, leave the lease to expire. The next worker
        // claims it and replays the same idempotency key.
        logQueue(logger, 'error', 'voice_billing_retry_state_write_failed', {
          sessionId: job.session_id,
          code: String(persistError?.code || 'DATABASE_ERROR'),
        });
      }
      logQueue(logger, 'error', 'voice_billing_job_retry_scheduled', {
        sessionId: job.session_id,
        attempts: Number(job.attempts),
        code,
      });
    }
    return true;
  }

  async function drain({ force = false, maxJobs = 20 } = {}) {
    if (running) return running;
    running = (async () => {
      let processed = 0;
      while (processed < maxJobs) {
        const attempted = await processOne(force);
        if (!attempted) break;
        processed += 1;
      }
      return processed;
    })();
    try {
      return await running;
    } finally {
      running = null;
    }
  }

  async function tick() {
    if (stopping) return;
    try {
      await touchWorker();
      await recoverAbandonedSessions();
      await drain({ maxJobs: 20 });
    } catch (error) {
      logQueue(logger, 'error', 'voice_billing_worker_failed', {
        code: error?.code || 'BILLING_QUEUE_ERROR',
      });
    }
  }

  async function start() {
    assertPool();
    if (started) return;
    stopping = false;
    await touchWorker();
    await recoverAbandonedSessions();
    await drain({ maxJobs: 100 });
    timer = setInterval(() => { void tick(); }, intervalMs);
    timer.unref?.();
    started = true;
  }

  async function stop({ timeoutMs = 20000 } = {}) {
    stopping = true;
    if (timer) clearInterval(timer);
    timer = null;
    if (running) await running.catch(() => {});
    try {
      // Jobs enqueued by active-session cleanup are immediately due. Do not
      // ignore their backoff during shutdown: a failed attempt remains durable
      // and is retried by the next process instead of hot-looping here.
      await drain({ maxJobs: 100 });
    } catch (error) {
      logQueue(logger, 'error', 'voice_billing_shutdown_drain_failed', {
        code: error?.code || 'BILLING_QUEUE_ERROR',
      });
    }
    try {
      await pool?.query(
        `UPDATE public.voice_billing_worker_instances
            SET stopped_at = NOW(), last_seen_at = NOW()
          WHERE worker_id = $1::uuid`,
        [workerId],
      );
    } catch (error) {
      logQueue(logger, 'warn', 'billing_worker_stop_checkpoint_failed', {
        code: error?.code || 'DATABASE_ERROR',
      });
    }
    started = false;
  }

  return {
    beginSession,
    recordHeartbeat,
    enqueueFinalization,
    recoverAbandonedSessions,
    drain,
    start,
    stop,
  };
}
