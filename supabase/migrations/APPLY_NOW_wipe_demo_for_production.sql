-- Wipe demo / local seed data for production go-live
-- Keeps: auth admin users, profiles (you delete demo users separately), store_settings
-- Clears: products, orders, invoices, carts, walk-ins, addresses, categories, brands, master catalog
--
-- Run in Supabase → SQL Editor once. Review before execute.
-- Or: node scripts/wipe_demo_data.mjs

BEGIN;

-- Sales / invoices
TRUNCATE TABLE IF EXISTS order_items CASCADE;
TRUNCATE TABLE IF EXISTS order_status_history CASCADE;
TRUNCATE TABLE IF EXISTS invoices CASCADE;
TRUNCATE TABLE IF EXISTS orders CASCADE;

-- Carts
TRUNCATE TABLE IF EXISTS cart_items CASCADE;
TRUNCATE TABLE IF EXISTS carts CASCADE;

-- Inventory / used phones
TRUNCATE TABLE IF EXISTS inventory_movements CASCADE;
TRUNCATE TABLE IF EXISTS used_device_inspections CASCADE;
TRUNCATE TABLE IF EXISTS used_device_details CASCADE;

-- Catalog
TRUNCATE TABLE IF EXISTS product_images CASCADE;
TRUNCATE TABLE IF EXISTS product_variants CASCADE;
TRUNCATE TABLE IF EXISTS products CASCADE;
TRUNCATE TABLE IF EXISTS categories CASCADE;
TRUNCATE TABLE IF EXISTS brands CASCADE;

-- Optional master / importer tables (ignore errors if missing — run separately if needed)
-- TRUNCATE TABLE IF EXISTS master_device_variants CASCADE;
-- TRUNCATE TABLE IF EXISTS master_devices CASCADE;

-- CRM walk-ins + saved addresses
TRUNCATE TABLE IF EXISTS walk_in_customers CASCADE;
TRUNCATE TABLE IF EXISTS addresses CASCADE;

-- Fresh invoice numbering
UPDATE invoice_sequences SET last_number = 0 WHERE true;

COMMIT;

-- After this: Admin → Products → add real stock (or seed_store_products only on a DEV project)
-- Do NOT re-run scripts/seed_e2e_demo.mjs against production.
