-- Promo codes + redemptions — run on prod Supabase (safe to re-run)

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  max_discount_amount NUMERIC(10, 2) CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  usage_limit INT CHECK (usage_limit IS NULL OR usage_limit > 0),
  per_customer_limit INT CHECK (per_customer_limit IS NULL OR per_customer_limit > 0),
  first_order_only BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  -- 'all' or product types: new_mobile, used_mobile, accessory, part
  applies_to TEXT[] NOT NULL DEFAULT ARRAY['all']::TEXT[],
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promo_codes_percent_cap CHECK (
    discount_type <> 'percent' OR discount_value <= 100
  ),
  CONSTRAINT promo_codes_window CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_unique
  ON promo_codes (upper(trim(code)));

CREATE INDEX IF NOT EXISTS promo_codes_active_idx
  ON promo_codes (active) WHERE active = true;

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_phone TEXT,
  customer_email TEXT,
  code_snapshot TEXT NOT NULL,
  discount_amount NUMERIC(10, 2) NOT NULL CHECK (discount_amount >= 0),
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promo_redemptions_one_per_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS promo_redemptions_promo_idx
  ON promo_redemptions (promo_code_id)
  WHERE voided_at IS NULL;

CREATE INDEX IF NOT EXISTS promo_redemptions_user_idx
  ON promo_redemptions (user_id)
  WHERE voided_at IS NULL;

CREATE INDEX IF NOT EXISTS promo_redemptions_phone_idx
  ON promo_redemptions (customer_phone)
  WHERE voided_at IS NULL AND customer_phone IS NOT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL;

-- Role helper (safe if already exists from policies.sql / master_catalog RLS)
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated, anon;

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage promo codes" ON promo_codes;
CREATE POLICY "Staff manage promo codes" ON promo_codes
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- Authenticated customers can preview active codes via RPC/server; no direct public SELECT of all fields
DROP POLICY IF EXISTS "Public read active promo metadata" ON promo_codes;
CREATE POLICY "Public read active promo metadata" ON promo_codes
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Staff manage promo redemptions" ON promo_redemptions;
CREATE POLICY "Staff manage promo redemptions" ON promo_redemptions
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Users read own promo redemptions" ON promo_redemptions;
CREATE POLICY "Users read own promo redemptions" ON promo_redemptions
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE promo_codes IS 'Storefront + POS discount codes managed in Admin → Promo codes';
COMMENT ON TABLE promo_redemptions IS 'One redemption per order; voided_at clears usage toward limits';
