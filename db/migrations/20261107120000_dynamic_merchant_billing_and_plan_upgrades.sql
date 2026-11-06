BEGIN;

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS monthly_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0),
  ADD COLUMN IF NOT EXISTS included_minutes integer NOT NULL DEFAULT 0 CHECK (included_minutes >= 0),
  ADD COLUMN IF NOT EXISTS minimum_topup_minutes integer NOT NULL DEFAULT 100 CHECK (minimum_topup_minutes > 0);

ALTER TABLE public.merchant_topups
  ADD COLUMN IF NOT EXISTS minutes_purchased integer CHECK (minutes_purchased IS NULL OR minutes_purchased > 0),
  ADD COLUMN IF NOT EXISTS plan_slug text;

CREATE TABLE IF NOT EXISTS public.merchant_plan_upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  requested_plan_slug text NOT NULL REFERENCES public.subscription_plans(slug),
  sender_phone text NOT NULL,
  gateway text NOT NULL CHECK (gateway IN ('bKash','Nagad','Rocket')),
  trx_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id),
  UNIQUE (gateway, trx_id)
);
CREATE INDEX IF NOT EXISTS merchant_plan_upgrade_requests_merchant_idx
  ON public.merchant_plan_upgrade_requests(merchant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mfs_payment_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('bKash','Nagad','Rocket')),
  account_label text NOT NULL DEFAULT 'Send Money',
  phone_number text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, phone_number)
);
ALTER TABLE public.mfs_payment_destinations ENABLE ROW LEVEL SECURITY;

COMMIT;
