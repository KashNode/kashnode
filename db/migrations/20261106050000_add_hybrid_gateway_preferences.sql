BEGIN;

ALTER TABLE public.merchant_signup_otps
  ADD COLUMN IF NOT EXISTS selected_plan VARCHAR(32) NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS gateway_preference VARCHAR(16) NOT NULL DEFAULT 'app';

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS gateway_preference VARCHAR(16) NOT NULL DEFAULT 'box',
  ADD COLUMN IF NOT EXISTS box_fulfillment_status VARCHAR(32) NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS box_preorder_requested_at TIMESTAMPTZ;

ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_gateway_preference_check,
  ADD CONSTRAINT merchants_gateway_preference_check
    CHECK (gateway_preference IN ('app', 'box'));

ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_box_fulfillment_status_check,
  ADD CONSTRAINT merchants_box_fulfillment_status_check
    CHECK (box_fulfillment_status IN ('not_requested', 'preorder_requested', 'pending', 'processing', 'shipped', 'delivered'));

ALTER TABLE public.merchant_signup_otps
  DROP CONSTRAINT IF EXISTS merchant_signup_otps_selected_plan_check,
  ADD CONSTRAINT merchant_signup_otps_selected_plan_check
    CHECK (selected_plan IN ('basic', 'standard', 'premium'));

ALTER TABLE public.merchant_signup_otps
  DROP CONSTRAINT IF EXISTS merchant_signup_otps_gateway_preference_check,
  ADD CONSTRAINT merchant_signup_otps_gateway_preference_check
    CHECK (gateway_preference IN ('app', 'box'));

CREATE INDEX IF NOT EXISTS merchants_gateway_preference_idx
  ON public.merchants (gateway_preference, box_fulfillment_status);

COMMIT;
