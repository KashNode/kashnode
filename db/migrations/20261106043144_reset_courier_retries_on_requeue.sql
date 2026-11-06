BEGIN;

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
      SET status = 'pending', attempts = 0, next_attempt_at = NOW(),
          last_error = NULL, updated_at = NOW()
      WHERE public.courier_fulfillment_outbox.status IN ('blocked', 'failed');
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
