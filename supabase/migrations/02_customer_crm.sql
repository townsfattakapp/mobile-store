-- Customer CRM fields on profiles + staff update access

DO $$ BEGIN
  CREATE TYPE customer_status AS ENUM ('active', 'vip', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS customer_status customer_status
    DEFAULT 'active'::customer_status NOT NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_customer_status
  ON profiles (customer_status)
  WHERE role = 'customer';

CREATE INDEX IF NOT EXISTS idx_profiles_role_created
  ON profiles (role, created_at DESC);

-- Staff/admin can manage all profiles (CRM edits). Safe to re-run.
DROP POLICY IF EXISTS "Staff can manage profiles" ON profiles;
CREATE POLICY "Staff can manage profiles" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'staff')
    )
  );
