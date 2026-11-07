BEGIN;

-- Keep the call queue self-contained and compatible with both the original
-- call_id API and consumers that use a conventional id primary key.
CREATE TABLE IF NOT EXISTS public.edge_voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_name TEXT,
  total_amount NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','dispatching','dialing','completed','no_answer','busy','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  sim_slot INTEGER CHECK (sim_slot IS NULL OR sim_slot BETWEEN 1 AND 2),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 0 AND 86400),
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  confirmation_response TEXT
);

-- Upgrade databases where the earlier dispatch migration created the table
-- with call_id as its primary key and without the denormalized order fields.
ALTER TABLE public.edge_voice_calls
  ADD COLUMN IF NOT EXISTS id UUID,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS session_id UUID,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS sim_slot INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS confirmation_response TEXT;

UPDATE public.edge_voice_calls SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.edge_voice_calls ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.edge_voice_calls ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.edge_voice_calls ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.edge_voice_calls DROP CONSTRAINT IF EXISTS edge_voice_calls_status_check;
ALTER TABLE public.edge_voice_calls ADD CONSTRAINT edge_voice_calls_status_check
  CHECK (status IN ('pending','dispatching','dialing','completed','no_answer','busy','failed'));

CREATE UNIQUE INDEX IF NOT EXISTS edge_voice_calls_id_uidx ON public.edge_voice_calls(id);
CREATE UNIQUE INDEX IF NOT EXISTS edge_voice_calls_call_id_uidx ON public.edge_voice_calls(call_id);
CREATE UNIQUE INDEX IF NOT EXISTS edge_voice_calls_session_id_uidx ON public.edge_voice_calls(session_id);
CREATE INDEX IF NOT EXISTS edge_voice_calls_lease_idx
  ON public.edge_voice_calls(status, lease_expires_at)
  WHERE status IN ('dispatching','dialing');

ALTER TABLE public.edge_voice_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edge_voice_calls FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edge_voice_calls TO service_role, postgres;

COMMIT;
