BEGIN;

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS gateway_mode TEXT
    CHECK (gateway_mode IN ('android_app', 'kashnode_box')),
  ADD COLUMN IF NOT EXISTS billing_phone TEXT,
  ADD COLUMN IF NOT EXISTS is_billing_phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing workspaces from their legacy selection before setting the
-- Android software gateway as the default for newly created workspaces.
UPDATE public.merchants SET gateway_mode = CASE
  WHEN gateway_preference = 'box' THEN 'kashnode_box' ELSE 'android_app' END
WHERE gateway_mode IS NULL;
ALTER TABLE public.merchants ALTER COLUMN gateway_mode SET DEFAULT 'android_app';
ALTER TABLE public.merchants ALTER COLUMN gateway_mode SET NOT NULL;
ALTER TABLE public.merchants ALTER COLUMN gateway_preference SET DEFAULT 'app';

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL CHECK (phone ~ '^01[3-9][0-9]{8}$'),
  purpose TEXT NOT NULL DEFAULT 'billing_phone' CHECK (purpose = 'billing_phone'),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS phone_verifications_latest_idx
  ON public.phone_verifications (merchant_id, phone, created_at DESC);

CREATE TABLE IF NOT EXISTS public.merchant_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('bKash', 'Nagad', 'Rocket', 'Upay')),
  trx_id TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  sender_phone TEXT NOT NULL CHECK (sender_phone ~ '^01[3-9][0-9]{8}$'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'expired', 'exception')),
  matched_event_id UUID,
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gateway, trx_id)
);
CREATE INDEX IF NOT EXISTS merchant_topups_pending_match_idx
  ON public.merchant_topups (gateway, trx_id, amount, sender_phone)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.payment_sms_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway TEXT NOT NULL CHECK (gateway IN ('bKash', 'Nagad', 'Rocket', 'Upay')),
  trx_id TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  sender_phone TEXT NOT NULL CHECK (sender_phone ~ '^01[3-9][0-9]{8}$'),
  receiver_phone TEXT NOT NULL CHECK (receiver_phone ~ '^01[3-9][0-9]{8}$'),
  received_at TIMESTAMPTZ NOT NULL,
  device_id TEXT NOT NULL,
  raw_message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gateway, trx_id)
);
ALTER TABLE public.merchant_topups
  DROP CONSTRAINT IF EXISTS merchant_topups_matched_event_fk;
ALTER TABLE public.merchant_topups
  ADD CONSTRAINT merchant_topups_matched_event_fk
  FOREIGN KEY (matched_event_id) REFERENCES public.payment_sms_events(id);

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_sms_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phone_verifications, public.merchant_topups, public.payment_sms_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_verifications, public.merchant_topups, public.payment_sms_events
  TO service_role, postgres;

COMMIT;
