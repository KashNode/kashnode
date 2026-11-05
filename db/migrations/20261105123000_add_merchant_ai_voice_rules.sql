BEGIN;

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS ai_voice_rules JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.merchants.ai_voice_rules IS
  'Optional merchant voice-call preferences as a JSON array of short strings; hard KashNode safety/payment guardrails always take precedence.';

COMMIT;
