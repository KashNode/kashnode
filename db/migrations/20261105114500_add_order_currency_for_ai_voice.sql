BEGIN;

-- Persist the store's currency alongside its total so voice scripts never have
-- to guess which currency an order amount represents.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3);

COMMENT ON COLUMN public.orders.currency IS
  'ISO 4217 currency code supplied by the commerce platform (for example BDT).';

COMMIT;
