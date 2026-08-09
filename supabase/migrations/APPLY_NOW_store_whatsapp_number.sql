-- Seller / store WhatsApp number for product "Chat with Seller"
-- Separate from whatsapp_url (which may be a community/group invite link).
-- Safe to re-run.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

COMMENT ON COLUMN store_settings.whatsapp_number IS
  'Digits-only international WhatsApp number, e.g. 919876543210';
