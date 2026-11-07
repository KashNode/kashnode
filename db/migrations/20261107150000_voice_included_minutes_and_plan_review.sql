BEGIN;

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
  v_included_minutes INTEGER := 0;
  v_overage_seconds NUMERIC(12,3);
  v_billed_amount NUMERIC(12,2);
  v_billing_source TEXT;
BEGIN
  IF p_merchant_id IS NULL OR p_order_id IS NULL OR p_session_id IS NULL THEN RAISE EXCEPTION 'INVALID_BILLING_ARGUMENTS'; END IF;
  IF p_call_duration_seconds IS NULL OR p_call_duration_seconds <= 0 OR p_call_duration_seconds > 86400 THEN RAISE EXCEPTION 'INVALID_CALL_DURATION'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::TEXT, 0));
  SELECT ledger.* INTO v_existing FROM public.call_billing_ledger ledger WHERE ledger.session_id=p_session_id;
  IF FOUND THEN
    IF v_existing.merchant_id<>p_merchant_id OR v_existing.order_id<>p_order_id THEN RAISE EXCEPTION 'BILLING_SESSION_ID_CONFLICT'; END IF;
    RETURN QUERY SELECT v_existing.id,v_existing.merchant_id,v_existing.order_id,v_existing.session_id,
      v_existing.call_duration_seconds,v_existing.billed_amount,v_existing.currency,v_existing.billing_source,
      v_existing.voice_minutes_debited,v_existing.rate_per_minute,v_existing.created_at,TRUE;
    RETURN;
  END IF;

  SELECT m.id,m.wallet_balance,m.available_voice_minutes,p.price_per_minute
    INTO v_merchant
    FROM public.merchants m
    JOIN public.subscription_plans p ON lower(p.slug)=lower(m.subscription_plan) AND p.is_active=TRUE
   WHERE m.id=p_merchant_id FOR UPDATE OF m;
  IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_MERCHANT_OR_PLAN_NOT_FOUND'; END IF;
  PERFORM 1 FROM public.orders o WHERE o.id=p_order_id AND o.merchant_id=p_merchant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_ORDER_NOT_FOUND'; END IF;
  v_rate_per_minute:=v_merchant.price_per_minute;
  IF v_rate_per_minute IS NULL OR v_rate_per_minute<0 THEN RAISE EXCEPTION 'BILLING_PLAN_RATE_INVALID'; END IF;

  v_overage_seconds := GREATEST(0, p_call_duration_seconds - GREATEST(0,COALESCE(v_merchant.available_voice_minutes,0))::NUMERIC * 60);
  v_included_minutes := LEAST(GREATEST(0,COALESCE(v_merchant.available_voice_minutes,0)),
    CEIL((p_call_duration_seconds-v_overage_seconds)/60.0)::INTEGER);
  v_billed_amount := ROUND((v_overage_seconds*v_rate_per_minute)/60.0,2);

  IF COALESCE(v_merchant.wallet_balance,0)<v_billed_amount THEN RAISE EXCEPTION 'INSUFFICIENT_VOICE_CREDIT'; END IF;
  UPDATE public.merchants
     SET available_voice_minutes=GREATEST(0,COALESCE(available_voice_minutes,0)-v_included_minutes),
         wallet_balance=COALESCE(wallet_balance,0)-v_billed_amount
   WHERE id=p_merchant_id;

  v_billing_source := CASE
    WHEN v_overage_seconds=0 AND v_included_minutes>0 THEN 'included_minutes'
    WHEN v_included_minutes>0 AND v_billed_amount>0 THEN 'included_minutes+wallet'
    ELSE 'wallet'
  END;
  INSERT INTO public.call_billing_ledger(merchant_id,order_id,session_id,call_duration_seconds,billed_amount,currency,billing_source,voice_minutes_debited,rate_per_minute)
  VALUES(p_merchant_id,p_order_id,p_session_id,ROUND(p_call_duration_seconds,3),v_billed_amount,'BDT',v_billing_source,v_included_minutes,v_rate_per_minute)
  RETURNING * INTO v_ledger;
  RETURN QUERY SELECT v_ledger.id,v_ledger.merchant_id,v_ledger.order_id,v_ledger.session_id,
    v_ledger.call_duration_seconds,v_ledger.billed_amount,v_ledger.currency,v_ledger.billing_source,
    v_ledger.voice_minutes_debited,v_ledger.rate_per_minute,v_ledger.created_at,FALSE;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_voice_call_billing(UUID,UUID,UUID,NUMERIC) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_voice_call_billing(UUID,UUID,UUID,NUMERIC) TO service_role,postgres;

COMMIT;
