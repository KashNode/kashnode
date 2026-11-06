BEGIN;

-- Preserve merchant and wallet values. Normalize legacy gateway labels only
-- where they do not satisfy the current enum.
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS gateway_mode TEXT,
  ADD COLUMN IF NOT EXISTS billing_phone TEXT,
  ADD COLUMN IF NOT EXISTS is_billing_phone_verified BOOLEAN DEFAULT FALSE;

UPDATE public.merchants
SET gateway_mode = CASE
  WHEN gateway_mode = 'kashnode_box' OR gateway_preference = 'box' THEN 'kashnode_box'
  ELSE 'android_app'
END
WHERE gateway_mode IS NULL OR gateway_mode NOT IN ('android_app', 'kashnode_box');

UPDATE public.merchants
SET is_billing_phone_verified = FALSE
WHERE is_billing_phone_verified IS NULL;

ALTER TABLE public.merchants
  ALTER COLUMN gateway_mode SET DEFAULT 'android_app',
  ALTER COLUMN gateway_mode SET NOT NULL,
  ALTER COLUMN gateway_preference SET DEFAULT 'app',
  ALTER COLUMN is_billing_phone_verified SET DEFAULT FALSE,
  ALTER COLUMN is_billing_phone_verified SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.merchants'::regclass
      AND conname = 'merchants_gateway_mode_repair_check'
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_gateway_mode_repair_check
      CHECK (gateway_mode IN ('android_app', 'kashnode_box')) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.merchants
  VALIDATE CONSTRAINT merchants_gateway_mode_repair_check;

-- Extend the legacy plaintext OTP table in place. Keep legacy data/columns,
-- but invalidate old OTPs instead of trusting or reusing plaintext codes.
ALTER TABLE public.phone_verifications
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'billing_phone',
  ADD COLUMN IF NOT EXISTS code_hash TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts SMALLINT DEFAULT 0;

UPDATE public.phone_verifications
SET phone = COALESCE(phone, phone_number),
    purpose = COALESCE(purpose, 'billing_phone'),
    code_hash = COALESCE(code_hash, 'legacy-invalidated'),
    attempts = GREATEST(COALESCE(attempts, 0), 6),
    verified_at = CASE
      WHEN COALESCE(is_verified, FALSE) THEN COALESCE(verified_at, created_at)
      ELSE verified_at
    END
WHERE code_hash IS NULL OR phone IS NULL OR purpose IS NULL OR attempts IS NULL;

ALTER TABLE public.phone_verifications
  ALTER COLUMN purpose SET DEFAULT 'billing_phone',
  ALTER COLUMN attempts SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS phone_verifications_latest_idx
  ON public.phone_verifications (merchant_id, purpose, verified_at, created_at DESC);

-- Extend the legacy top-up table without dropping receiver_phone, sms_raw_id,
-- matched_at, or any existing row.
ALTER TABLE public.merchant_topups
  ADD COLUMN IF NOT EXISTS matched_event_id UUID,
  ADD COLUMN IF NOT EXISTS credited_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS merchant_topups_gateway_trx_id_uidx
  ON public.merchant_topups (gateway, trx_id);

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
  CONSTRAINT payment_sms_events_gateway_trx_id_key UNIQUE (gateway, trx_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.merchant_topups'::regclass
      AND conname = 'merchant_topups_matched_event_fk'
  ) THEN
    ALTER TABLE public.merchant_topups
      ADD CONSTRAINT merchant_topups_matched_event_fk
      FOREIGN KEY (matched_event_id) REFERENCES public.payment_sms_events(id)
      NOT VALID;
  END IF;
END $$;
ALTER TABLE public.merchant_topups
  VALIDATE CONSTRAINT merchant_topups_matched_event_fk;

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_sms_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.phone_verifications, public.merchant_topups, public.payment_sms_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_verifications, public.merchant_topups, public.payment_sms_events
  TO service_role, postgres;

COMMIT;
