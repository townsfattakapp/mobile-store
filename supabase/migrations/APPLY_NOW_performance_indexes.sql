-- Performance indexes for storefront listings / search / PDP
-- Run once in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_status_type_created
  ON products (status, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_status_type_price
  ON products (status, type, selling_price);

CREATE INDEX IF NOT EXISTS idx_products_brand_status
  ON products (brand_id, status);

CREATE INDEX IF NOT EXISTS idx_products_slug
  ON products (slug);

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON product_variants (product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_product_sort
  ON product_images (product_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_brands_slug
  ON brands (slug);

CREATE INDEX IF NOT EXISTS idx_categories_slug
  ON categories (slug);

CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON orders (user_id, created_at DESC);

ANALYZE products;
ANALYZE product_variants;
ANALYZE brands;
