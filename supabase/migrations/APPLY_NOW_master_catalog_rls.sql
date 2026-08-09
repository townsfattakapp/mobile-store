-- Master catalog RLS (safe to re-run)
-- Fixes browser ManualProvider PGRST116 when RLS is on with no policies.

ALTER TABLE master_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_device_variants ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Public can view master devices" ON master_devices;
DROP POLICY IF EXISTS "Admin can manage master devices" ON master_devices;
DROP POLICY IF EXISTS "Public can view master variants" ON master_device_variants;
DROP POLICY IF EXISTS "Admin can manage master variants" ON master_device_variants;

CREATE POLICY "Public can view master devices" ON master_devices
  FOR SELECT USING (true);
CREATE POLICY "Admin can manage master devices" ON master_devices
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

CREATE POLICY "Public can view master variants" ON master_device_variants
  FOR SELECT USING (true);
CREATE POLICY "Admin can manage master variants" ON master_device_variants
  FOR ALL USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());
