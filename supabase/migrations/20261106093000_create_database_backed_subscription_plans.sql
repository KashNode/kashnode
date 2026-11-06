-- Database-backed subscription catalog shared by the public website and Super Admin.
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  price_per_minute numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_per_minute >= 0),
  currency text NOT NULL DEFAULT 'BDT' CHECK (currency = 'BDT'),
  billing_unit text NOT NULL DEFAULT 'minute',
  short_features jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(short_features) = 'array'),
  details jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(details) = 'array'),
  feature_groups jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(feature_groups) = 'array'),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS subscription_plans_active_order_idx
  ON public.subscription_plans (is_active, display_order);

INSERT INTO public.subscription_plans
  (slug, name, tagline, price_per_minute, billing_unit, short_features, details, feature_groups, display_order, is_active)
VALUES
('free', 'Free Trial', 'Try it first', 0, 'trial',
 '["Order verification by SMS","AI confirmation calls","Payment code verification","Merchant dashboard"]'::jsonb,
 '["Explore the core KashNode workflow with 10 complimentary AI minutes."]'::jsonb,
 '[]'::jsonb, 0, true),
('basic', 'Basic', 'Essential automation', 5.50, 'minute',
 '["AI voice order verification","One gateway: Android app or Basic Box","Standard male or female AI voice","7-day call logs and status"]'::jsonb,
 '["Manual support through email or support ticket.","Designed for stores that need reliable, essential order verification."]'::jsonb,
 '[{"category":"AI voice verification","items":["Standard male or female AI voice"]},{"category":"Gateway","items":["One Android app or Basic Box"]},{"category":"History & support","items":["7-day call logs and status","Manual email or ticket support"]}]'::jsonb, 1, true),
('standard', 'Standard', 'More control for growing stores', 6.50, 'minute',
 '["Advanced AI voice verification","Up to 2 devices / SIMs with failover","bKash & Nagad payment SMS matching","Steadfast or Pathao courier booking"]'::jsonb,
 '["Faster, more natural AI responses.","Automatic TrxID matching from supported payment messages.","30-day call and payment history.","Priority chat support."]'::jsonb,
 '[{"category":"AI voice verification","items":["Advanced AI voice with faster, natural responses"]},{"category":"Gateway","items":["Up to 2 devices / SIMs","Backup SIM failover"]},{"category":"Payments & courier","items":["bKash and Nagad payment SMS matching","Automatic TrxID verification","Steadfast or Pathao API booking"]},{"category":"History & support","items":["30-day call and payment history","Priority chat support"]}]'::jsonb, 2, true),
('premium', 'Premium', 'Advanced business automation', 7.00, 'minute',
 '["Ultra-realistic AI voice with custom tone","Smart retry and dynamic scheduling","Unlimited multi-device / Box management","Advanced fraud and fake-order detection"]'::jsonb,
 '["Automatic blocklist for suspicious activity.","Full API and webhook access.","Dedicated account manager and VIP phone support."]'::jsonb,
 '[{"category":"AI voice verification","items":["Ultra-realistic AI voice with custom tone"]},{"category":"Automation","items":["Smart retry and dynamic scheduling"]},{"category":"Gateway","items":["Unlimited multi-device and Box management"]},{"category":"Risk & integrations","items":["Advanced fraud and fake-order detection","Automatic suspicious-number blocklist","Full API and webhook access"]},{"category":"Support","items":["Dedicated account manager","VIP phone support"]}]'::jsonb, 3, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, tagline = EXCLUDED.tagline, price_per_minute = EXCLUDED.price_per_minute,
  currency = EXCLUDED.currency, billing_unit = EXCLUDED.billing_unit,
  short_features = EXCLUDED.short_features, details = EXCLUDED.details,
  feature_groups = EXCLUDED.feature_groups, display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active, updated_at = now();

