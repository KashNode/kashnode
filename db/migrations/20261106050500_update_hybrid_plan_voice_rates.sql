BEGIN;

CREATE OR REPLACE FUNCTION public.set_merchant_package_voice_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.overage_rate_per_min := CASE lower(COALESCE(NEW.subscription_plan, 'free'))
    WHEN 'basic' THEN 6.50
    WHEN 'standard' THEN 6.00
    WHEN 'premium' THEN 5.50
    ELSE 6.50
  END;
  RETURN NEW;
END;
$function$;

UPDATE public.merchants
   SET overage_rate_per_min = CASE lower(COALESCE(subscription_plan, 'free'))
     WHEN 'basic' THEN 6.50
     WHEN 'standard' THEN 6.00
     WHEN 'premium' THEN 5.50
     ELSE 6.50
   END;

COMMIT;
