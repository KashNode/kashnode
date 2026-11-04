BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- A user remains the login identity; a merchant is the B2B workspace.
-- Google-only accounts do not have a local password hash.
ALTER TABLE public.users
  ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uidx
  ON public.users (google_sub)
  WHERE google_sub IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx
  ON public.users (lower(email));

-- SaaS subscription and quota defaults for each merchant workspace.
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(32) NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS available_orders INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS available_voice_minutes INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS overage_rate_per_min NUMERIC(10,2) NOT NULL DEFAULT 7.00,
  ADD COLUMN IF NOT EXISTS email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS owner_user_id UUID;

ALTER TABLE public.merchants
  ALTER COLUMN webhook_secret
  SET DEFAULT encode(gen_random_bytes(32), 'hex');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'merchants_owner_user_id_fkey'
      AND conrelid = 'public.merchants'::regclass
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_owner_user_id_fkey
      FOREIGN KEY (owner_user_id)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'merchants_available_orders_nonnegative_check'
      AND conrelid = 'public.merchants'::regclass
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_available_orders_nonnegative_check
      CHECK (available_orders >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'merchants_available_voice_minutes_nonnegative_check'
      AND conrelid = 'public.merchants'::regclass
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_available_voice_minutes_nonnegative_check
      CHECK (available_voice_minutes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'merchants_overage_rate_nonnegative_check'
      AND conrelid = 'public.merchants'::regclass
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_overage_rate_nonnegative_check
      CHECK (overage_rate_per_min >= 0);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS merchants_webhook_secret_uidx
  ON public.merchants (webhook_secret);

CREATE UNIQUE INDEX IF NOT EXISTS merchants_owner_user_uidx
  ON public.merchants (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS merchants_email_lower_uidx
  ON public.merchants (lower(email))
  WHERE email IS NOT NULL;

-- OTPs are hashed with an application-only pepper and cannot be read via the
-- Supabase Data API. The pending password is bcrypt-hashed before storage.
CREATE TABLE IF NOT EXISTS public.merchant_signup_otps (
  email VARCHAR(254) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  password_hash TEXT NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS merchant_signup_otps_expires_idx
  ON public.merchant_signup_otps (expires_at);

ALTER TABLE public.merchant_signup_otps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.merchant_signup_otps FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.merchant_signup_otps TO service_role, postgres;

COMMIT;
