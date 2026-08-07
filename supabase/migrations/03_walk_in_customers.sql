-- Walk-in CRM records (POS / guest orders keyed by normalized phone)

CREATE TABLE IF NOT EXISTS walk_in_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_key TEXT UNIQUE NOT NULL,
    display_phone TEXT,
    full_name TEXT,
    customer_status customer_status DEFAULT 'active'::customer_status NOT NULL,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_walk_in_customers_status
  ON walk_in_customers (customer_status);

ALTER TABLE walk_in_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage walk_in_customers" ON walk_in_customers;
CREATE POLICY "Staff manage walk_in_customers" ON walk_in_customers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff')
    )
  );
