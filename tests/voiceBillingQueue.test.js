import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceBillingQueue } from '../server/services/billingService.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const ledgerId = '44444444-4444-4444-8444-444444444444';

function createFakePool() {
  const state = { workers: new Map(), jobs: new Map() };
  const pool = {
    state,
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      const now = Date.now();

      if (text.startsWith('INSERT INTO public.voice_billing_worker_instances')) {
        const [workerId] = params;
        state.workers.set(workerId, { lastSeenAt: now, stoppedAt: null });
        return { rows: [{ worker_id: workerId }] };
      }
      if (text.startsWith('UPDATE public.voice_billing_worker_instances')) {
        const [workerId] = params;
        const worker = state.workers.get(workerId);
        if (worker) {
          if (text.includes('stopped_at = NOW()')) worker.stoppedAt = now;
          worker.lastSeenAt = now;
        }
        return { rows: [] };
      }
      if (text.startsWith('INSERT INTO public.voice_session_billing_jobs')) {
        const [sid, workerId, mid, oid, startedAt] = params;
        if (state.jobs.has(sid)) return { rows: [] };
        const started = new Date(startedAt).getTime();
        state.jobs.set(sid, {
          session_id: sid,
          worker_id: workerId,
          merchant_id: mid,
          order_id: oid,
          status: 'active',
          startedAt: started,
          lastHeartbeatAt: started,
          duration_seconds: null,
          attempts: 0,
          nextAttemptAt: now,
          lockedAt: null,
          ledger_id: null,
          last_error: null,
        });
        return { rows: [{ session_id: sid }] };
      }
      if (text.startsWith('UPDATE public.voice_session_billing_jobs SET last_heartbeat_at')) {
        const [sid] = params;
        const job = state.jobs.get(sid);
        if (job?.status === 'active') job.lastHeartbeatAt = now;
        return { rows: [] };
      }
      if (text.startsWith('UPDATE public.voice_session_billing_jobs AS job')) {
        const [staleAfterMs] = params;
        const recovered = [];
        for (const job of state.jobs.values()) {
          const worker = state.workers.get(job.worker_id);
          const sessionIsStale = job.lastHeartbeatAt < now - staleAfterMs;
          const workerStopped = Boolean(worker?.stoppedAt);
          const workerIsStale = !worker || worker.lastSeenAt < now - staleAfterMs;
          if (job.status === 'active' && sessionIsStale && (workerStopped || workerIsStale)) {
            job.duration_seconds = Math.max(0.001, (job.lastHeartbeatAt - job.startedAt) / 1000);
            job.status = 'pending';
            job.nextAttemptAt = now;
            job.last_error = 'RECOVERED_AFTER_PROCESS_RESTART';
            job.lockedAt = null;
            recovered.push({
              session_id: job.session_id,
              status: job.status,
              duration_seconds: job.duration_seconds,
            });
          }
        }
        return { rows: recovered };
      }
      if (text.startsWith('WITH candidate AS')) {
        const [force, processingLeaseMs] = params;
        const job = [...state.jobs.values()]
          .filter(item => (
            (item.status === 'pending' && (force || item.nextAttemptAt <= now))
            || (item.status === 'processing' && item.lockedAt < now - processingLeaseMs)
          ))
          .sort((left, right) => left.nextAttemptAt - right.nextAttemptAt)[0];
        if (!job) return { rows: [] };
        job.status = 'processing';
        job.attempts += 1;
        job.lockedAt = now;
        return { rows: [{
          session_id: job.session_id,
          merchant_id: job.merchant_id,
          order_id: job.order_id,
          duration_seconds: job.duration_seconds,
          attempts: job.attempts,
        }] };
      }
      if (text.startsWith('UPDATE public.voice_session_billing_jobs SET status = $2')) {
        const [sid, status, resultLedgerId] = params;
        const job = state.jobs.get(sid);
        if (job?.status === 'processing') {
          job.status = status;
          job.ledger_id = resultLedgerId;
          job.lockedAt = null;
          job.last_error = null;
        }
        return { rows: [] };
      }
      if (text.startsWith("UPDATE public.voice_session_billing_jobs SET status = 'pending'")) {
        const [sid, code] = params;
        const job = state.jobs.get(sid);
        if (job?.status === 'processing') {
          job.status = 'pending';
          job.lockedAt = null;
          job.nextAttemptAt = now + 15000;
          job.last_error = code;
        }
        return { rows: [] };
      }
      if (text.startsWith('UPDATE public.voice_session_billing_jobs SET status = $4')) {
        const [sid, mid, oid, status, seconds] = params;
        const job = state.jobs.get(sid);
        if (job && job.merchant_id === mid && job.order_id === oid
          && ['active', 'pending', 'processing'].includes(job.status)) {
          job.status = status;
          job.duration_seconds = seconds;
          job.nextAttemptAt = now;
          job.lockedAt = null;
          return { rows: [{ session_id: sid }] };
        }
        return { rows: [] };
      }
      if (text.startsWith('SELECT status, merchant_id, order_id')) {
        const [sid] = params;
        const job = state.jobs.get(sid);
        return { rows: job ? [{
          status: job.status,
          merchant_id: job.merchant_id,
          order_id: job.order_id,
        }] : [] };
      }

      throw new Error('Unhandled billing queue SQL: ' + text);
    },
  };
  return pool;
}

test('persists a billing intent before a voice session can become ready', async () => {
  const pool = createFakePool();
  const queue = createVoiceBillingQueue({ pool, intervalMs: 60000 });
  await queue.start();
  await queue.beginSession({ merchantId, orderId, sessionId, startedAt: new Date() });

  const job = pool.state.jobs.get(sessionId);
  assert.ok(job);
  assert.equal(job.status, 'active');
  assert.equal(job.merchant_id, merchantId);
  assert.equal(job.order_id, orderId);
  assert.ok(job.worker_id);
  await queue.stop({ timeoutMs: 0 });
});

test('recovers a session after its owning worker heartbeat becomes stale', async () => {
  const pool = createFakePool();
  const queue = createVoiceBillingQueue({ pool, staleAfterMs: 1000, intervalMs: 60000 });
  await queue.start();
  await queue.beginSession({ merchantId, orderId, sessionId, startedAt: new Date(Date.now() - 60000) });

  const job = pool.state.jobs.get(sessionId);
  const worker = pool.state.workers.get(job.worker_id);
  job.startedAt = Date.now() - 60000;
  job.lastHeartbeatAt = Date.now() - 30000;
  worker.lastSeenAt = Date.now() - 30000;

  const recovered = await queue.recoverAbandonedSessions();
  assert.equal(recovered.length, 1);
  assert.equal(job.status, 'pending');
  assert.ok(job.duration_seconds > 0);
  assert.equal(job.last_error, 'RECOVERED_AFTER_PROCESS_RESTART');
  await queue.stop({ timeoutMs: 0 });
});

test('does not recover a fresh session owned by another live worker', async () => {
  const pool = createFakePool();
  const first = createVoiceBillingQueue({ pool, staleAfterMs: 1000, intervalMs: 60000 });
  await first.start();
  await first.beginSession({ merchantId, orderId, sessionId, startedAt: new Date(Date.now() - 60000) });

  const second = createVoiceBillingQueue({ pool, staleAfterMs: 1000, intervalMs: 60000 });
  await second.start();
  const recovered = await second.recoverAbandonedSessions();

  assert.equal(recovered.length, 0);
  assert.equal(pool.state.jobs.get(sessionId).status, 'active');
  await second.stop({ timeoutMs: 0 });
  await first.stop({ timeoutMs: 0 });
});

test('finalizes a pending job and acknowledges its ledger id', async () => {
  const pool = createFakePool();
  let finalizerCalls = 0;
  const queue = createVoiceBillingQueue({
    pool,
    billingFinalizer: async input => {
      finalizerCalls += 1;
      assert.equal(input.sessionId, sessionId);
      assert.equal(input.merchantId, merchantId);
      assert.equal(input.orderId, orderId);
      return { status: 'billed', ledgerId, billedAmount: 1, currency: 'BDT' };
    },
    intervalMs: 60000,
  });
  await queue.start();
  await queue.beginSession({ merchantId, orderId, sessionId, startedAt: new Date(Date.now() - 5000) });
  await queue.enqueueFinalization({ merchantId, orderId, sessionId, durationSeconds: 5 });
  await queue.drain({ force: true, maxJobs: 1 });

  assert.equal(finalizerCalls, 1);
  assert.equal(pool.state.jobs.get(sessionId).status, 'completed');
  assert.equal(pool.state.jobs.get(sessionId).ledger_id, ledgerId);
  await queue.stop({ timeoutMs: 0 });
});

test('failed billing remains pending with a retry time instead of being discarded', async () => {
  const pool = createFakePool();
  const queue = createVoiceBillingQueue({
    pool,
    billingFinalizer: async () => {
      const error = new Error('INSUFFICIENT_VOICE_CREDIT');
      error.code = 'INSUFFICIENT_VOICE_CREDIT';
      throw error;
    },
    intervalMs: 60000,
  });
  await queue.start();
  await queue.beginSession({ merchantId, orderId, sessionId, startedAt: new Date(Date.now() - 5000) });
  await queue.enqueueFinalization({ merchantId, orderId, sessionId, durationSeconds: 5 });
  await queue.drain({ force: true, maxJobs: 1 });

  const job = pool.state.jobs.get(sessionId);
  assert.equal(job.status, 'pending');
  assert.equal(job.attempts, 1);
  assert.equal(job.last_error, 'INSUFFICIENT_VOICE_CREDIT');
  assert.ok(job.nextAttemptAt > Date.now());
  await queue.stop({ timeoutMs: 0 });
});

test('shutdown forces a final retry of due billing jobs before marking the worker stopped', async () => {
  const pool = createFakePool();
  let calls = 0;
  const queue = createVoiceBillingQueue({
    pool,
    billingFinalizer: async () => {
      calls += 1;
      return { status: 'billed', ledgerId };
    },
    intervalMs: 60000,
  });
  await queue.start();
  await queue.beginSession({ merchantId, orderId, sessionId, startedAt: new Date(Date.now() - 5000) });
  await queue.enqueueFinalization({ merchantId, orderId, sessionId, durationSeconds: 5 });
  await queue.stop({ timeoutMs: 1000 });

  assert.equal(calls, 1);
  assert.equal(pool.state.jobs.get(sessionId).status, 'completed');
  const worker = [...pool.state.workers.values()][0];
  assert.ok(worker.stoppedAt);
});
