CREATE INDEX IF NOT EXISTS merchant_topups_matched_event_id_idx
  ON public.merchant_topups (matched_event_id)
  WHERE matched_event_id IS NOT NULL;