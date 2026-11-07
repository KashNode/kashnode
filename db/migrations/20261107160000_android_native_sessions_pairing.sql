BEGIN;
CREATE TABLE IF NOT EXISTS public.native_device_sessions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,device_id TEXT NOT NULL CHECK(length(device_id) BETWEEN 8 AND 128),device_name TEXT NOT NULL DEFAULT 'Android device',device_role TEXT NOT NULL CHECK(device_role IN('merchant','admin_gateway')),token_hash BYTEA NOT NULL UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS native_device_sessions_user_idx ON public.native_device_sessions(user_id,expires_at DESC) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS public.device_pairing_tokens(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),token_hash BYTEA NOT NULL UNIQUE,user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,device_role TEXT NOT NULL CHECK(device_role IN('merchant','admin_gateway')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,consumed_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS device_pairing_tokens_expiry_idx ON public.device_pairing_tokens(expires_at) WHERE consumed_at IS NULL;
ALTER TABLE public.native_device_sessions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.device_pairing_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.native_device_sessions,public.device_pairing_tokens FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.native_device_sessions,public.device_pairing_tokens TO service_role,postgres;
COMMIT;
