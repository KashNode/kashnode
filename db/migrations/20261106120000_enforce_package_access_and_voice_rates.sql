BEGIN;

-- Normalize merchant package identity and prevent unsupported package values.
ALTER TABLE public.merchants
  ALTER COLUMN subscription_plan SET DEFAULT 'basic';

UPDATE public.merchants
   SET subscription_plan = CASE lower(COALESCE(subscription_plan, 'basic'))
     WHEN 'standard' THEN 'standard'
     WHEN 'premium' THEN 'premium'
     WHEN 'basic' THEN 'basic'
     ELSE 'basic'
   END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'merchants_subscription_plan_allowed'
       AND conrelid = 'public.merchants'::regclass
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_subscription_plan_allowed
      CHECK (subscription_plan IN ('basic', 'standard', 'premium'));
  END IF;
END $$;

-- Derive the billable rate from the active tier inside the locked billing
-- transaction. A stale or manually edited rate column cannot change pricing.
CREATE OR REPLACE FUNCTION public.finalize_voice_call_billing(
  p_merchant_id UUID,
  p_order_id UUID,
  p_session_id UUID,
  p_call_duration_seconds NUMERIC
)
RETURNS TABLE (
  id UUID, merchant_id UUID, order_id UUID, session_id UUID,
  call_duration_seconds NUMERIC, billed_amount NUMERIC, currency VARCHAR,
  billing_source TEXT, voice_minutes_debited INTEGER, rate_per_minute NUMERIC,
  created_at TIMESTAMPTZ, idempotent_replay BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_merchant RECORD;
  v_existing public.call_billing_ledger%ROWTYPE;
  v_ledger public.call_billing_ledger%ROWTYPE;
  v_rate_per_minute NUMERIC(10,2);
  v_billed_amount NUMERIC(12,2);
  v_billing_source TEXT;
BEGIN
  IF p_merchant_id IS NULL OR p_order_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_BILLING_ARGUMENTS';
  END IF;
  IF p_call_duration_seconds IS NULL OR p_call_duration_seconds <= 0 OR p_call_duration_seconds > 86400 THEN
    RAISE EXCEPTION 'INVALID_CALL_DURATION';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::TEXT, 0));
  SELECT ledger.* INTO v_existing
    FROM public.call_billing_ledger AS ledger
   WHERE ledger.session_id = p_session_id;
  IF FOUND THEN
    IF v_existing.merchant_id <> p_merchant_id OR v_existing.order_id <> p_order_id THEN
      RAISE EXCEPTION 'BILLING_SESSION_ID_CONFLICT';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.merchant_id, v_existing.order_id,
      v_existing.session_id, v_existing.call_duration_seconds, v_existing.billed_amount,
      v_existing.currency, v_existing.billing_source, v_existing.voice_minutes_debited,
      v_existing.rate_per_minute, v_existing.created_at, TRUE;
    RETURN;
  END IF;

  SELECT merchant.id, merchant.wallet_balance, merchant.available_voice_minutes,
         merchant.subscription_plan
    INTO v_merchant
    FROM public.merchants AS merchant
   WHERE merchant.id = p_merchant_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_MERCHANT_NOT_FOUND'; END IF;

  PERFORM 1 FROM public.orders AS order_row
   WHERE order_row.id = p_order_id AND order_row.merchant_id = p_merchant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_ORDER_NOT_FOUND'; END IF;

  v_rate_per_minute := CASE lower(COALESCE(v_merchant.subscription_plan, 'basic'))
    WHEN 'standard' THEN 6.50
    WHEN 'premium' THEN 6.00
    ELSE 7.00
  END;
  v_billed_amount := ROUND((p_call_duration_seconds * v_rate_per_minute) / 60.0, 2);
  IF COALESCE(v_merchant.wallet_balance, 0) < v_billed_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_VOICE_CREDIT';
  END IF;

  UPDATE public.merchants
     SET wallet_balance = COALESCE(wallet_balance, 0) - v_billed_amount
   WHERE id = p_merchant_id;
  v_billing_source := 'wallet';

  INSERT INTO public.call_billing_ledger (
    merchant_id, order_id, session_id, call_duration_seconds, billed_amount,
    currency, billing_source, voice_minutes_debited, rate_per_minute
  )
  VALUES (
    p_merchant_id, p_order_id, p_session_id, ROUND(p_call_duration_seconds, 3),
    v_billed_amount, 'BDT', v_billing_source, 0, v_rate_per_minute
  )
  RETURNING * INTO v_ledger;

  RETURN QUERY SELECT v_ledger.id, v_ledger.merchant_id, v_ledger.order_id,
    v_ledger.session_id, v_ledger.call_duration_seconds, v_ledger.billed_amount,
    v_ledger.currency, v_ledger.billing_source, v_ledger.voice_minutes_debited,
    v_ledger.rate_per_minute, v_ledger.created_at, FALSE;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_voice_call_billing(UUID, UUID, UUID, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_voice_call_billing(UUID, UUID, UUID, NUMERIC)
  TO service_role, postgres;

COMMIT;
