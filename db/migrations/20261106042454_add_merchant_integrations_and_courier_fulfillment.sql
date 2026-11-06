BEGIN;

CREATE TABLE IF NOT EXISTS public.merchant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('steadfast', 'pathao', 'woocommerce', 'shopify')),
  credentials_ciphertext BYTEA NOT NULL,
  credentials_nonce BYTEA NOT NULL,
  credentials_auth_tag BYTEA NOT NULL,
  credentials_key_version SMALLINT NOT NULL DEFAULT 1 CHECK (credentials_key_version > 0),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT CHECK (last_test_status IN ('connected', 'failed')),
  last_test_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, provider)
);

CREATE INDEX IF NOT EXISTS merchant_integrations_merchant_active_idx
  ON public.merchant_integrations (merchant_id, is_active);

ALTER TABLE public.merchant_integrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_integrations TO service_role, postgres;

-- Extend orders with the delivery address and a durable courier-fulfillment state.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_address TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_zone TEXT,
  ADD COLUMN IF NOT EXISTS shipping_area TEXT,
  ADD COLUMN IF NOT EXISTS shipping_postcode TEXT,
  ADD COLUMN IF NOT EXISTS alternative_phone TEXT,
  ADD COLUMN IF NOT EXISTS store_provider TEXT CHECK (store_provider IN ('woocommerce', 'shopify')),
  ADD COLUMN IF NOT EXISTS courier_provider TEXT,
  ADD COLUMN IF NOT EXISTS courier_consignment_id TEXT,
  ADD COLUMN IF NOT EXISTS courier_tracking_code TEXT,
  ADD COLUMN IF NOT EXISTS courier_booked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.courier_fulfillment_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'order_verified' CHECK (event_type = 'order_verified'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'blocked')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, event_type)
);

CREATE INDEX IF NOT EXISTS courier_fulfillment_outbox_pending_idx
  ON public.courier_fulfillment_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE public.courier_fulfillment_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.courier_fulfillment_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_fulfillment_outbox TO service_role, postgres;

-- A verified phone or a reconciled paid order is eligible for automated booking.
CREATE OR REPLACE FUNCTION public.enqueue_verified_order_for_courier()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF (NEW.is_phone_verified IS TRUE OR NEW.payment_status = 'paid')
     AND COALESCE(NEW.delivery_status, 'pending') = 'pending'
     AND NEW.courier_booked_at IS NULL THEN
    INSERT INTO public.courier_fulfillment_outbox (merchant_id, order_id)
    VALUES (NEW.merchant_id, NEW.id)
    ON CONFLICT (order_id, event_type) DO UPDATE
      SET status = 'pending', next_attempt_at = NOW(), last_error = NULL, updated_at = NOW()
      WHERE public.courier_fulfillment_outbox.status IN ('blocked', 'failed');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orders_enqueue_verified_courier ON public.orders;
CREATE TRIGGER orders_enqueue_verified_courier
AFTER INSERT OR UPDATE OF is_phone_verified, payment_status, delivery_status,
  shipping_address, shipping_city, shipping_zone, shipping_area
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_verified_order_for_courier();

ALTER TABLE public.courier_orders
  ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consignment_id TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS booking_response JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS courier_orders_merchant_created_idx
  ON public.courier_orders (merchant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS courier_orders_order_uidx
  ON public.courier_orders (order_id) WHERE order_id IS NOT NULL;

COMMIT;
