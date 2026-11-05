BEGIN;

-- Retire fixed order quotas without changing either voice-credit column.
ALTER TABLE public.merchants
  DROP COLUMN IF EXISTS available_orders;

COMMIT;
