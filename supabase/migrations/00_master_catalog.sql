-- Add Master Catalog Architecture

CREATE TYPE master_device_type AS ENUM ('smartphone', 'tablet', 'accessory', 'part');

CREATE TABLE IF NOT EXISTS master_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT,
    model_name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    release_year INTEGER,
    device_type master_device_type DEFAULT 'smartphone'::master_device_type,
    specifications JSONB DEFAULT '{}'::jsonb,
    source_provider TEXT DEFAULT 'manual',
    source_external_id TEXT,
    is_verified BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_device_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    master_device_id UUID REFERENCES master_devices(id) ON DELETE CASCADE,
    ram TEXT, -- e.g., '12GB'
    storage TEXT, -- e.g., '256GB'
    color TEXT,
    reference_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alter existing products table to link to master catalog
ALTER TABLE products 
    ADD COLUMN IF NOT EXISTS master_device_id UUID REFERENCES master_devices(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS master_variant_id UUID REFERENCES master_device_variants(id) ON DELETE SET NULL;

-- Triggers for updated_at
CREATE TRIGGER update_master_devices_modtime
    BEFORE UPDATE ON master_devices
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_master_variants_modtime
    BEFORE UPDATE ON master_device_variants
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
