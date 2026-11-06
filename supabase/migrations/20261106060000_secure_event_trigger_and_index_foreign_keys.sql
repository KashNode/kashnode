-- Restrict the event-trigger helper from exposed API roles.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Cover foreign keys that currently lack a leading-column index.
CREATE INDEX IF NOT EXISTS courier_fulfillment_outbox_merchant_id_idx
  ON public.courier_fulfillment_outbox (merchant_id);

CREATE INDEX IF NOT EXISTS system_settings_gemini_api_key_secret_id_idx
  ON public.system_settings (gemini_api_key_secret_id);
CREATE INDEX IF NOT EXISTS system_settings_groq_api_key_secret_id_idx
  ON public.system_settings (groq_api_key_secret_id);
CREATE INDEX IF NOT EXISTS system_settings_openai_api_key_secret_id_idx
  ON public.system_settings (openai_api_key_secret_id);
CREATE INDEX IF NOT EXISTS system_settings_updated_by_idx
  ON public.system_settings (updated_by);

CREATE INDEX IF NOT EXISTS voice_session_billing_jobs_ledger_id_idx
  ON public.voice_session_billing_jobs (ledger_id);
CREATE INDEX IF NOT EXISTS voice_session_billing_jobs_order_id_idx
  ON public.voice_session_billing_jobs (order_id);
CREATE INDEX IF NOT EXISTS voice_session_billing_jobs_worker_id_idx
  ON public.voice_session_billing_jobs (worker_id);
