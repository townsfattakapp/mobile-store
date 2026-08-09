-- Laptop variant axes: CPU + display size (alongside existing ram/storage/color)
-- Safe to re-run.

ALTER TABLE master_device_variants
  ADD COLUMN IF NOT EXISTS cpu TEXT,
  ADD COLUMN IF NOT EXISTS display_size TEXT;

-- Optional helper index for admin lookups
CREATE INDEX IF NOT EXISTS idx_master_device_variants_cpu
  ON master_device_variants (cpu)
  WHERE cpu IS NOT NULL AND cpu <> '';

COMMENT ON COLUMN master_device_variants.cpu IS 'Laptop CPU / chipset label, e.g. Intel Core Ultra 7';
COMMENT ON COLUMN master_device_variants.display_size IS 'Laptop display size, e.g. 15.6″';
