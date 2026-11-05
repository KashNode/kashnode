BEGIN;

-- Shopify shop identity and per-merchant webhook signing secret. These values
-- are only read by the server through its privileged database connection.
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS shopify_domain VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shopify_webhook_secret TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS merchants_shopify_domain_uidx
  ON public.merchants (lower(shopify_domain))
  WHERE shopify_domain IS NOT NULL;

-- Keep Shopify's original line items and financial state without overloading
-- the normalized payment_status used by KashNode's MFS reconciliation flow.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS financial_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3);

COMMENT ON COLUMN public.merchants.shopify_domain IS 'Canonical x-shopify-shop-domain used to resolve a Shopify webhook to its merchant workspace.';
COMMENT ON COLUMN public.merchants.shopify_webhook_secret IS 'Merchant-configured Shopify webhook signing secret. Never expose through public APIs or logs.';
COMMENT ON COLUMN public.orders.line_items IS 'Sanitized Shopify line item snapshot received with orders/create.';
COMMENT ON COLUMN public.orders.financial_status IS 'Original Shopify financial_status; payment_status remains normalized for KashNode reconciliation.';

COMMIT;
