BEGIN;

-- Pricing already exists per merchant. Keep it explicit for older installs.
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS overage_rate_per_min NUMERIC(10,2) NOT NULL DEFAULT 7.00;

CREATE TABLE IF NOT EXISTS public.call_billing_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  -- One ledger entry per live WebSocket session makes retries idempotent.
  session_id UUID NOT NULL UNIQUE,
  call_duration_seconds NUMERIC(12,3) NOT NULL CHECK (call_duration_seconds > 0),
  billed_amount NUMERIC(12,2) NOT NULL CHECK (billed_amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BDT' CHECK (currency = upper(currency)),
  -- billed_amount is the rated value of the call; billing_source identifies
  -- whether wallet money, prepaid voice minutes, or a zero-price plan covered it.
  billing_source TEXT NOT NULL CHECK (billing_source IN ('wallet', 'voice_minutes', 'included')),
  voice_minutes_debited INTEGER NOT NULL DEFAULT 0 CHECK (voice_minutes_debited >= 0),
  rate_per_minute NUMERIC(10,2) NOT NULL CHECK (rate_per_minute >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS call_billing_ledger_merchant_created_idx
  ON public.call_billing_ledger (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_billing_ledger_order_created_idx
  ON public.call_billing_ledger (order_id, created_at DESC);

ALTER TABLE public.call_billing_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.call_billing_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.call_billing_ledger TO service_role, postgres;

COMMENT ON TABLE public.call_billing_ledger IS
  'Immutable audit ledger for finalized live voice sessions. billed_amount is the rated usage value; billing_source shows how it was covered.';

CREATE OR REPLACE FUNCTION public.finalize_voice_call_billing(
  p_merchant_id UUID,
  p_order_id UUID,
  p_session_id UUID,
  p_call_duration_seconds NUMERIC
)
RETURNS TABLE (
  id UUID,
  merchant_id UUID,
  order_id UUID,
  session_id UUID,
  call_duration_seconds NUMERIC,
  billed_amount NUMERIC,
  currency VARCHAR,
  billing_source TEXT,
  voice_minutes_debited INTEGER,
  rate_per_minute NUMERIC,
  created_at TIMESTAMPTZ,
  idempotent_replay BOOLEAN
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
  v_required_voice_minutes INTEGER;
  v_billing_source TEXT;
  v_voice_minutes_debited INTEGER := 0;
BEGIN
  IF p_merchant_id IS NULL OR p_order_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_BILLING_ARGUMENTS';
  END IF;

  IF p_call_duration_seconds IS NULL
     OR p_call_duration_seconds <= 0
     OR p_call_duration_seconds > 86400 THEN
    RAISE EXCEPTION 'INVALID_CALL_DURATION';
  END IF;

  -- Serialize the same session ID even if a retry reaches a different worker.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::TEXT, 0));

  SELECT ledger.*
    INTO v_existing
    FROM public.call_billing_ledger AS ledger
   WHERE ledger.session_id = p_session_id;

  IF FOUND THEN
    IF v_existing.merchant_id <> p_merchant_id OR v_existing.order_id <> p_order_id THEN
      RAISE EXCEPTION 'BILLING_SESSION_ID_CONFLICT';
    END IF;

    RETURN QUERY SELECT
      v_existing.id,
      v_existing.merchant_id,
      v_existing.order_id,
      v_existing.session_id,
      v_existing.call_duration_seconds,
      v_existing.billed_amount,
      v_existing.currency,
      v_existing.billing_source,
      v_existing.voice_minutes_debited,
      v_existing.rate_per_minute,
      v_existing.created_at,
      TRUE;
    RETURN;
  END IF;

  -- Lock the merchant row so concurrent calls cannot overspend either credit source.
  SELECT merchant.id,
         merchant.wallet_balance,
         merchant.available_voice_minutes,
         merchant.overage_rate_per_min
    INTO v_merchant
    FROM public.merchants AS merchant
   WHERE merchant.id = p_merchant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BILLING_MERCHANT_NOT_FOUND';
  END IF;

  PERFORM 1
    FROM public.orders AS order_row
   WHERE order_row.id = p_order_id
     AND order_row.merchant_id = p_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BILLING_ORDER_NOT_FOUND';
  END IF;

  v_rate_per_minute := COALESCE(v_merchant.overage_rate_per_min, 2.00);
  IF v_rate_per_minute < 0 THEN
    RAISE EXCEPTION 'INVALID_VOICE_RATE';
  END IF;

  -- Pro-rate to the exact elapsed seconds, then round only the currency amount.
  v_billed_amount := ROUND((p_call_duration_seconds * v_rate_per_minute) / 60.0, 2);
  v_required_voice_minutes := CEIL(p_call_duration_seconds / 60.0)::INTEGER;

  IF v_billed_amount = 0 THEN
    v_billing_source := 'included';
  ELSIF COALESCE(v_merchant.wallet_balance, 0) >= v_billed_amount THEN
    UPDATE public.merchants
       SET wallet_balance = COALESCE(wallet_balance, 0) - v_billed_amount
     WHERE id = p_merchant_id;
    v_billing_source := 'wallet';
  ELSIF COALESCE(v_merchant.available_voice_minutes, 0) >= v_required_voice_minutes THEN
    UPDATE public.merchants
       SET available_voice_minutes = available_voice_minutes - v_required_voice_minutes
     WHERE id = p_merchant_id;
    v_billing_source := 'voice_minutes';
    v_voice_minutes_debited := v_required_voice_minutes;
  ELSE
    RAISE EXCEPTION 'INSUFFICIENT_VOICE_CREDIT';
  END IF;

  INSERT INTO public.call_billing_ledger (
    merchant_id,
    order_id,
    session_id,
    call_duration_seconds,
    billed_amount,
    currency,
    billing_source,
    voice_minutes_debited,
    rate_per_minute
  )
  VALUES (
    p_merchant_id,
    p_order_id,
    p_session_id,
    ROUND(p_call_duration_seconds, 3),
    v_billed_amount,
    'BDT',
    v_billing_source,
    v_voice_minutes_debited,
    v_rate_per_minute
  )
  RETURNING * INTO v_ledger;

  RETURN QUERY SELECT
    v_ledger.id,
    v_ledger.merchant_id,
    v_ledger.order_id,
    v_ledger.session_id,
    v_ledger.call_duration_seconds,
    v_ledger.billed_amount,
    v_ledger.currency,
    v_ledger.billing_source,
    v_ledger.voice_minutes_debited,
    v_ledger.rate_per_minute,
    v_ledger.created_at,
    FALSE;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_voice_call_billing(UUID, UUID, UUID, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_voice_call_billing(UUID, UUID, UUID, NUMERIC)
  TO service_role, postgres;

COMMIT;
