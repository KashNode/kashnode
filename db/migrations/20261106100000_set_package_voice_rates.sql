BEGIN;

-- Package rates are fixed by the selected feature profile. Voice calls remain
-- pay-as-you-go and are billed by actual duration; no monthly or order quotas.
CREATE OR REPLACE FUNCTION public.set_merchant_package_voice_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.overage_rate_per_min := CASE lower(COALESCE(NEW.subscription_plan, 'free'))
    WHEN 'basic' THEN 7.00
    WHEN 'standard' THEN 6.50
    WHEN 'premium' THEN 6.00
    -- Trial usage is complimentary for the configured trial allowance; once
    -- paid usage begins, the default entry-level rate is applied.
    ELSE 7.00
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS merchants_package_voice_rate_before_write ON public.merchants;
CREATE TRIGGER merchants_package_voice_rate_before_write
BEFORE INSERT OR UPDATE OF subscription_plan
ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.set_merchant_package_voice_rate();

-- Align existing merchant records with their currently assigned package.
UPDATE public.merchants
   SET overage_rate_per_min = CASE lower(COALESCE(subscription_plan, 'free'))
     WHEN 'basic' THEN 7.00
     WHEN 'standard' THEN 6.50
     WHEN 'premium' THEN 6.00
     ELSE 7.00
   END;

COMMENT ON COLUMN public.merchants.overage_rate_per_min IS
  'Package-specific AI voice rate in BDT per minute: Basic 7.00, Standard 6.50, Premium 6.00; trial defaults to entry-level rate after complimentary trial usage.';

COMMIT;
