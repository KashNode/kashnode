BEGIN;

ALTER TABLE public.merchant_plan_upgrade_requests
  ADD COLUMN IF NOT EXISTS expected_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS payment_event_id uuid
    REFERENCES public.payment_sms_events(id) ON DELETE RESTRICT;

-- Historical requests remain pending_review and are not auto-approved because
-- they have no trusted amount snapshot. New requests must have a positive amount.
DO $body$ BEGIN
  ALTER TABLE public.merchant_plan_upgrade_requests
    ADD CONSTRAINT merchant_plan_upgrade_expected_amount_positive
    CHECK (expected_amount IS NULL OR expected_amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $body$;

CREATE UNIQUE INDEX IF NOT EXISTS merchant_plan_upgrade_payment_event_unique
  ON public.merchant_plan_upgrade_requests(payment_event_id)
  WHERE payment_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mfs_device_nonces (
  nonce text PRIMARY KEY,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS mfs_device_nonces_expiry_idx
  ON public.mfs_device_nonces(expires_at);

COMMIT;
