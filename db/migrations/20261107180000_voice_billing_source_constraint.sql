BEGIN;
ALTER TABLE public.call_billing_ledger
  DROP CONSTRAINT IF EXISTS call_billing_ledger_billing_source_check;
ALTER TABLE public.call_billing_ledger
  ADD CONSTRAINT call_billing_ledger_billing_source_check
  CHECK (billing_source IN ('wallet','voice_minutes','included','included_minutes','included_minutes+wallet'));
COMMIT;
