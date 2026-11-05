BEGIN;

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS is_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS business_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS website_url VARCHAR(2048),
  ADD COLUMN IF NOT EXISTS admin_contact_phone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS box_sim_phone VARCHAR(32);

COMMENT ON COLUMN public.merchants.is_onboarding_complete IS
  'True only after the merchant has submitted the mandatory business and Pocket Box setup form.';
COMMENT ON COLUMN public.merchants.admin_contact_phone IS
  'Merchant administrator contact number; distinct from the Pocket Box SIM number.';
COMMENT ON COLUMN public.merchants.box_sim_phone IS
  'Phone number of the SIM installed in the merchant Pocket Box device.';

COMMIT;
