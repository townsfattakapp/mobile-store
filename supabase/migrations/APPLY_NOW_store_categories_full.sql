-- Full store category catalog (safe to re-run)
-- Phones, tablets, laptops, accessories, parts

INSERT INTO categories (name, slug, description, active)
VALUES
  ('Smartphones — New', 'smartphones-new', 'Brand-new mobile phones', true),
  ('Smartphones — Pre-Owned', 'smartphones-pre-owned', 'Refurbished / used / certified pre-owned phones', true),
  ('Tablets — New', 'tablets-new', 'New iPad and Android tablets', true),
  ('Tablets — Pre-Owned', 'tablets-pre-owned', 'Used / refurbished tablets', true),
  ('Laptops — New', 'laptops-new', 'New laptops and notebooks', true),
  ('Laptops — Pre-Owned', 'laptops-pre-owned', 'Used / refurbished laptops', true),
  ('Smartwatches & Wearables', 'smartwatches-wearables', 'Smartwatches, fitness bands, wearables', true),
  ('Mobile Accessories', 'mobile-accessories', 'General mobile accessories', true),
  ('Cases & Covers', 'cases-covers', 'Phone and tablet cases, back covers', true),
  ('Screen Guards', 'screen-guards', 'Tempered glass and screen protectors', true),
  ('Chargers & Cables', 'chargers-cables', 'Wall chargers, car chargers, USB / Type-C cables', true),
  ('Power Banks', 'power-banks', 'Portable power banks', true),
  ('Audio — Earbuds & Headphones', 'audio-earbuds-headphones', 'TWS, neckbands, earphones, headphones', true),
  ('Car Accessories', 'car-accessories', 'Car mounts, car chargers, dash accessories', true),
  ('Computer Accessories', 'computer-accessories', 'General PC / laptop accessories', true),
  ('Keyboards & Mice', 'keyboards-mice', 'Keyboards, mice, mouse pads', true),
  ('Storage — Pendrive & HDD/SSD', 'storage-drives', 'USB drives, external HDD/SSD', true),
  ('Networking — WiFi & Adapters', 'networking', 'Routers, WiFi adapters, LAN accessories', true),
  ('Laptop Bags & Stands', 'laptop-bags-stands', 'Laptop bags, sleeves, stands, coolers', true),
  ('Gaming Accessories', 'gaming-accessories', 'Controllers, gaming gear', true),
  ('Smart Gadgets', 'smart-gadgets', 'Smart home and lifestyle gadgets', true),
  ('Spare Parts', 'spare-parts', 'Displays, flex cables, buttons, misc parts', true),
  ('Batteries', 'batteries', 'Phone and device batteries', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  active = true,
  updated_at = NOW();
