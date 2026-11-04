-- KashNode order / MFS reconciliation foundation.
-- Run through the project's migration runner after reviewing the preflight checks.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE merchant_id IS NULL OR platform_order_id IS NULL
  ) THEN
    RAISE EXCEPTION 'orders contains NULL merchant_id or platform_order_id values; resolve them before adding reconciliation uniqueness.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders
    GROUP BY merchant_id, platform_order_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate (merchant_id, platform_order_id) orders exist. Resolve duplicates before applying reconciliation_foundation.sql.';
  END IF;
END
$$;

ALTER TABLE public.orders
  ALTER COLUMN merchant_id SET NOT NULL,
  ALTER COLUMN platform_order_id SET NOT NULL,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS customer_trx_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_merchant_platform_order_uidx
  ON public.orders (merchant_id, platform_order_id);

ALTER TABLE public.raw_sms_inbox
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

CREATE INDEX IF NOT EXISTS raw_sms_inbox_unreconciled_idx
  ON public.raw_sms_inbox (merchant_id, received_at)
  WHERE is_reconciled = FALSE;

CREATE INDEX IF NOT EXISTS orders_pending_reconcile_idx
  ON public.orders (merchant_id, total_amount)
  WHERE payment_status = 'unpaid';

-- Historical transactions are retained. New rows must carry merchant_id, and
-- uniqueness is scoped by merchant + MFS gateway + provider transaction ID.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.merchants(id) ON DELETE RESTRICT;

DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (trx_id)'
  LOOP
    EXECUTE format('ALTER TABLE public.transactions DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END
$$;

-- The current schema uses transactions_trx_id_key for the legacy global
-- UNIQUE(trx_id). Dropping it is harmless if the constraint loop removed it.
DROP INDEX IF EXISTS public.transactions_trx_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_merchant_gateway_trx_uidx
  ON public.transactions (merchant_id, gateway, trx_id)
  WHERE merchant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_merchant_status_idx
  ON public.transactions (merchant_id, status, created_at DESC);

COMMENT ON COLUMN public.orders.payment_status IS 'unpaid, paid, manual_review, or platform-specific status';
COMMENT ON COLUMN public.raw_sms_inbox.provider IS 'Normalized MFS provider: bKash, Nagad, Rocket, Upay';
COMMENT ON COLUMN public.raw_sms_inbox.customer_phone IS 'Payer phone extracted from the MFS receipt SMS body';
