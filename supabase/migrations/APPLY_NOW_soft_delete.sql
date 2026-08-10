-- Soft-delete / archive for orders, invoices, customers — run on prod Supabase
-- Safe to re-run. Does NOT hard-delete rows.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

ALTER TABLE walk_in_customers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders (deleted_at);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices (deleted_at);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles (deleted_at);
CREATE INDEX IF NOT EXISTS idx_walk_in_customers_deleted_at ON walk_in_customers (deleted_at);

COMMENT ON COLUMN orders.deleted_at IS 'Soft-delete archive timestamp; NULL = active in admin lists';
COMMENT ON COLUMN invoices.deleted_at IS 'Soft-delete archive timestamp; NULL = active in admin lists';
COMMENT ON COLUMN profiles.deleted_at IS 'Soft-delete archive for registered customers';
COMMENT ON COLUMN walk_in_customers.deleted_at IS 'Soft-delete archive for walk-in CRM rows';
