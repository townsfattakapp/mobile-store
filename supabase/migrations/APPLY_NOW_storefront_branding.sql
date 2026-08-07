-- Storefront branding fields on store_settings (safe to re-run)
-- Apply in Supabase SQL editor, then restart Next.js

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS brand_name TEXT DEFAULT 'MOBISTORE';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT 'India''s calm destination for new launches and quality-checked pre-owned phones.';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS business_hours TEXT DEFAULT 'Mon–Sat · 10:00 AM – 8:00 PM IST';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS designed_by_name TEXT DEFAULT 'Evolw — Fattakse';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS designed_by_org TEXT DEFAULT 'A Unit of EVOLW';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS designed_by_url TEXT DEFAULT 'https://www.evolw.in';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS seo_title TEXT DEFAULT 'MobiStore - Premium Mobile & Accessories';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT 'Shop the best new and quality-checked used mobile phones, accessories, and spare parts in India.';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS hero_eyebrow TEXT DEFAULT 'The new generation';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS hero_headline TEXT DEFAULT 'Upgrade what you carry every day.';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS hero_subcopy TEXT DEFAULT 'A curated destination for new launches and quality-checked pre-owned phones — priced clearly, chosen carefully for India.';

-- Public can read storefront/business profile (needed by the shop website)
DROP POLICY IF EXISTS "Public read store settings" ON store_settings;
CREATE POLICY "Public read store settings" ON store_settings
  FOR SELECT
  USING (true);

-- Seed brand_name for existing row if empty
UPDATE store_settings
SET
  brand_name = COALESCE(NULLIF(TRIM(brand_name), ''), 'MOBISTORE'),
  tagline = COALESCE(tagline, 'India''s calm destination for new launches and quality-checked pre-owned phones.'),
  business_hours = COALESCE(business_hours, 'Mon–Sat · 10:00 AM – 8:00 PM IST'),
  designed_by_name = COALESCE(designed_by_name, 'Evolw — Fattakse'),
  designed_by_org = COALESCE(designed_by_org, 'A Unit of EVOLW'),
  designed_by_url = COALESCE(designed_by_url, 'https://www.evolw.in'),
  seo_title = COALESCE(seo_title, 'MobiStore - Premium Mobile & Accessories'),
  seo_description = COALESCE(
    seo_description,
    'Shop the best new and quality-checked used mobile phones, accessories, and spare parts in India.'
  ),
  hero_eyebrow = COALESCE(hero_eyebrow, 'The new generation'),
  hero_headline = COALESCE(hero_headline, 'Upgrade what you carry every day.'),
  hero_subcopy = COALESCE(
    hero_subcopy,
    'A curated destination for new launches and quality-checked pre-owned phones — priced clearly, chosen carefully for India.'
  ),
  updated_at = NOW()
WHERE TRUE;
