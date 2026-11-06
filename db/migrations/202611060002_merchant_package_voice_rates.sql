BEGIN;

-- Published per-minute rates are the source of truth for merchant wallet UI
-- and voice-call billing. Free trial accounts use the Basic rate after trial.
CREATE OR REPLACE FUNCTION public.set_merchant_package_voice_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.overage_rate_per_min := CASE lower(COALESCE(NEW.subscription_plan, 'free'))
    WHEN 'basic' THEN 5.50
    WHEN 'standard' THEN 6.50
    WHEN 'premium' THEN 7.00
    ELSE 5.50
  END;
  RETURN NEW;
END;
$function$;

UPDATE public.merchants
SET overage_rate_per_min = CASE lower(COALESCE(subscription_plan, 'free'))
  WHEN 'basic' THEN 5.50
  WHEN 'standard' THEN 6.50
  WHEN 'premium' THEN 7.00
  ELSE 5.50
END;

UPDATE public.subscription_plans
SET price_per_minute = CASE lower(slug)
  WHEN 'basic' THEN 5.50
  WHEN 'standard' THEN 6.50
  WHEN 'premium' THEN 7.00
  ELSE price_per_minute
END
WHERE lower(slug) IN ('basic', 'standard', 'premium');

COMMIT;
