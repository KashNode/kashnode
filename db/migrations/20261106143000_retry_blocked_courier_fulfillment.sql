BEGIN;

ALTER TABLE public.courier_fulfillment_outbox
  DROP CONSTRAINT IF EXISTS courier_fulfillment_outbox_status_check;
ALTER TABLE public.courier_fulfillment_outbox
  ADD CONSTRAINT courier_fulfillment_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'blocked'));

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

COMMIT;
