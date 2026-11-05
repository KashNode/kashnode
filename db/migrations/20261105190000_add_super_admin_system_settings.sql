BEGIN;

-- Super Admin's singleton configuration row. Provider API keys are never
-- stored as plaintext here: the UUID columns point to encrypted Supabase Vault
-- secrets, and only the trusted backend database role may read the decrypted view.
CREATE TABLE IF NOT EXISTS public.system_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_llm_provider TEXT NOT NULL DEFAULT 'openai'
    CHECK (active_llm_provider IN ('openai', 'gemini', 'groq')),
  default_voice_rate NUMERIC(10,2) NOT NULL DEFAULT 7.00
    CHECK (default_voice_rate >= 0),
  openai_api_key_secret_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL,
  gemini_api_key_secret_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL,
  groq_api_key_secret_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.system_settings IS
  'Singleton Super Admin settings. API key material is stored encrypted in Supabase Vault; this table stores only Vault secret IDs.';
COMMENT ON COLUMN public.system_settings.default_voice_rate IS
  'Default BDT per-minute voice rate applied to newly created merchants. Existing merchant-specific rates are preserved.';
COMMENT ON COLUMN public.system_settings.openai_api_key_secret_id IS
  'Reference to the encrypted OpenAI API key in vault.secrets. Never return the decrypted key to a browser.';
COMMENT ON COLUMN public.system_settings.gemini_api_key_secret_id IS
  'Reference to the encrypted Gemini API key in vault.secrets. Never return the decrypted key to a browser.';
COMMENT ON COLUMN public.system_settings.groq_api_key_secret_id IS
  'Reference to the encrypted Groq API key in vault.secrets. Never return the decrypted key to a browser.';

INSERT INTO public.system_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.system_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.system_settings TO postgres, service_role;

-- The application uses the trusted postgres database connection for Vault reads.
-- Explicitly prevent browser and service-role API callers from reading plaintext
-- secrets from Vault's decrypted view.
REVOKE ALL ON TABLE vault.decrypted_secrets FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE vault.decrypted_secrets TO postgres;

-- Secret mutation is also limited to the trusted backend database role.
REVOKE ALL ON FUNCTION vault.create_secret(TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION vault.create_secret(TEXT, TEXT, TEXT, UUID) TO postgres;
REVOKE ALL ON FUNCTION vault.update_secret(UUID, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION vault.update_secret(UUID, TEXT, TEXT, TEXT, UUID) TO postgres;

-- New merchants inherit the current Super Admin default rate. Existing
-- merchants keep their saved overage_rate_per_min value and are not repriced.
ALTER TABLE public.merchants
  ALTER COLUMN overage_rate_per_min DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.apply_default_merchant_voice_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.overage_rate_per_min IS NULL THEN
    SELECT settings.default_voice_rate
      INTO NEW.overage_rate_per_min
      FROM public.system_settings AS settings
     WHERE settings.id = 1;

    NEW.overage_rate_per_min := COALESCE(NEW.overage_rate_per_min, 7.00);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS merchants_default_voice_rate_before_insert ON public.merchants;
CREATE TRIGGER merchants_default_voice_rate_before_insert
BEFORE INSERT ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.apply_default_merchant_voice_rate();

COMMIT;
