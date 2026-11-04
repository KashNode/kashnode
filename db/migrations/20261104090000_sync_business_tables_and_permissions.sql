-- Keep the checked-in schema reproducible against the current production tables.
CREATE TABLE IF NOT EXISTS public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  webhook_secret VARCHAR(255) NOT NULL,
  wallet_balance NUMERIC(12,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  platform_order_id VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  total_amount NUMERIC(10,2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  delivery_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.raw_sms_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  sender_number VARCHAR(50) NOT NULL,
  raw_message TEXT NOT NULL,
  parsed_trxid VARCHAR(100),
  parsed_amount NUMERIC(10,2),
  is_reconciled BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_sms_inbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.merchants, public.orders, public.raw_sms_inbox
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.merchants, public.orders, public.raw_sms_inbox
  TO service_role, postgres;
