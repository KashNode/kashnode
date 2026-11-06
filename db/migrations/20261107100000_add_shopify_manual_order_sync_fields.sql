BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(50);

-- Shopify orders may legitimately have no phone number. Keep them visible in
-- the merchant order list rather than dropping otherwise valid COD orders.
ALTER TABLE public.orders ALTER COLUMN customer_phone DROP NOT NULL;

CREATE INDEX IF NOT EXISTS orders_merchant_created_at_idx
  ON public.orders (merchant_id, created_at DESC);

COMMIT;
