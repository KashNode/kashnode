BEGIN;

-- Supabase grants service_role privileges on newly created public tables via
-- default privileges. This settings singleton is intentionally not a Data API
-- resource; the Node backend connects with the trusted postgres DB role.
REVOKE ALL ON TABLE public.system_settings
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.system_settings
  TO postgres;

COMMIT;
