-- Store CMS pages (warranty, refund, shipping, contact) — run on prod Supabase
-- Safe to re-run.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS warranty_content TEXT,
  ADD COLUMN IF NOT EXISTS refund_policy_content TEXT,
  ADD COLUMN IF NOT EXISTS shipping_policy_content TEXT,
  ADD COLUMN IF NOT EXISTS contact_page_content TEXT;

COMMENT ON COLUMN store_settings.warranty_content IS 'Markdown body for /warranty';
COMMENT ON COLUMN store_settings.refund_policy_content IS 'Markdown body for /refund-policy';
COMMENT ON COLUMN store_settings.shipping_policy_content IS 'Markdown body for /shipping-policy';
COMMENT ON COLUMN store_settings.contact_page_content IS 'Markdown intro/body for /contact (contact cards still use phone/email/address)';
