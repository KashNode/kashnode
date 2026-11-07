BEGIN;
CREATE TABLE IF NOT EXISTS public.edge_voice_calls(
 call_id UUID PRIMARY KEY,
 session_id UUID NOT NULL UNIQUE,
 merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
 order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN ('dispatching','dialing','completed','no_answer','busy','failed')),
 lease_expires_at TIMESTAMPTZ,
 duration_seconds INTEGER CHECK(duration_seconds IS NULL OR duration_seconds BETWEEN 0 AND 86400),
 sim_slot INTEGER CHECK(sim_slot IS NULL OR sim_slot BETWEEN 1 AND 2),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 completed_at TIMESTAMPTZ,
 UNIQUE(order_id,call_id)
);
CREATE INDEX IF NOT EXISTS edge_voice_calls_lease_idx ON public.edge_voice_calls(status,lease_expires_at) WHERE status IN ('dispatching','dialing');
ALTER TABLE public.edge_voice_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edge_voice_calls FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.edge_voice_calls TO service_role,postgres;
CREATE INDEX IF NOT EXISTS orders_pending_voice_call_idx ON public.orders(merchant_id,created_at) WHERE ai_call_status='pending';
COMMIT;
