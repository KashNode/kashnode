-- KashNode reconciliation foundation. Run once with the Supabase SQL editor or migration runner.
-- Preflight: refuse to add idempotency if existing duplicate orders would make the constraint unsafe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.orders
    GROUP BY merchant_id, platform_order_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate (merchant_id, platform_order_id) orders exist. Resolve duplicates before applying reconciliation_foundation.sql.';
  END IF;
END $$;

ALTER TABLE public.orders
  ALTER COLUMN merchant_id SET NOT NULL,
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
  WHERE payment_status IN ('unpaid', 'manual_review');

-- Preserve historical transactions with NULL merchant_id; all new reconciliation
-- writes must provide merchant_id. Replace any legacy global trx_id uniqueness.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE;
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (trx_id)'
  LOOP
    EXECUTE format('ALTER TABLE public.transactions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
DROP INDEX IF EXISTS public.transactions_trx_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_merchant_gateway_trx_uidx
  ON public.transactions (merchant_id, gateway, trx_id)
  WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_merchant_status_idx
  ON public.transactions (merchant_id, status, created_at DESC);

COMMENT ON COLUMN public.orders.payment_status IS 'unpaid, paid, manual_review, or platform-specific status';
COMMENT ON COLUMN public.raw_sms_inbox.provider IS 'Normalized MFS provider: bKash, Nagad, Rocket, Upay';
COMMENT ON COLUMN public.raw_sms_inbox.customer_phone IS 'Sender phone extracted from the MFS receipt SMS body';
