BEGIN;

-- Durable outbox for voice-session billing. A row is written before the
-- server emits session.ready, so a process crash cannot erase the obligation
-- to finalize a call. The worker leases rows and uses the existing
-- session_id-idempotent database finalizer.
CREATE TABLE IF NOT EXISTS public.voice_session_billing_jobs (
  session_id UUID PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'processing', 'completed', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds NUMERIC(12,3)
    CHECK (duration_seconds IS NULL OR (duration_seconds >= 0 AND duration_seconds <= 86400)),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  ledger_id UUID REFERENCES public.call_billing_ledger(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS voice_session_billing_jobs_pending_idx
  ON public.voice_session_billing_jobs (next_attempt_at, created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS voice_session_billing_jobs_active_heartbeat_idx
  ON public.voice_session_billing_jobs (last_heartbeat_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS voice_session_billing_jobs_merchant_created_idx
  ON public.voice_session_billing_jobs (merchant_id, created_at DESC);

ALTER TABLE public.voice_session_billing_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voice_session_billing_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.voice_session_billing_jobs TO service_role, postgres;

COMMENT ON TABLE public.voice_session_billing_jobs IS
  'Durable outbox for live voice billing. Active sessions are recovered using the last persisted heartbeat; pending jobs retry the idempotent call billing finalizer.';

-- The dashboard must never read a global device heartbeat. Pair a device to a
-- merchant on its first authenticated report and scope every stored log row.
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS box_device_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS merchants_box_device_id_uidx
  ON public.merchants (box_device_id)
  WHERE box_device_id IS NOT NULL;

ALTER TABLE public.device_logs
  ADD COLUMN IF NOT EXISTS merchant_id UUID
    REFERENCES public.merchants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS device_logs_merchant_created_idx
  ON public.device_logs (merchant_id, created_at DESC)
  WHERE merchant_id IS NOT NULL;

ALTER TABLE public.device_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.device_logs FROM PUBLIC, anon, authenticated;

COMMIT;
