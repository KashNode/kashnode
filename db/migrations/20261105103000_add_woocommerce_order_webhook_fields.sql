BEGIN;

-- The existing live orders table already has customer_phone, but this
-- defensive ADD COLUMN keeps clean installs and audited databases aligned.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS customer_trx_id TEXT,
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_call_status VARCHAR(32) NOT NULL DEFAULT 'pending';

-- Fail with a useful message rather than creating an unusable unique index
-- over legacy records that cannot be safely assigned to a merchant/order.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE merchant_id IS NULL
       OR platform_order_id IS NULL
       OR customer_phone IS NULL
  ) THEN
    RAISE EXCEPTION
      'orders contains rows without merchant_id, platform_order_id, or customer_phone; repair those rows before enabling WooCommerce webhooks.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders
    GROUP BY merchant_id, platform_order_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate (merchant_id, platform_order_id) orders exist; resolve duplicates before enabling WooCommerce webhook idempotency.';
  END IF;
END
$$;

ALTER TABLE public.orders
  ALTER COLUMN merchant_id SET NOT NULL,
  ALTER COLUMN platform_order_id SET NOT NULL,
  ALTER COLUMN customer_phone SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_merchant_platform_order_uidx
  ON public.orders (merchant_id, platform_order_id);

CREATE INDEX IF NOT EXISTS orders_pending_ai_call_idx
  ON public.orders (merchant_id, ai_call_status, created_at DESC)
  WHERE ai_call_status = 'pending';

COMMENT ON COLUMN public.orders.is_phone_verified IS
  'True only after KashNode completes its phone verification workflow.';
COMMENT ON COLUMN public.orders.ai_call_status IS
  'KashNode call lifecycle state; newly ingested WooCommerce orders begin as pending.';
COMMENT ON COLUMN public.orders.line_items IS
  'Sanitized product/quantity/amount snapshot sent by the store integration.';

COMMIT;
