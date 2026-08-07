import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Starting Master Catalog Seed...");

  // 1. Insert Brands
  const { data: samsung, error: bErr1 } = await supabase
    .from('brands')
    .upsert({ name: 'Samsung', slug: 'samsung', active: true }, { onConflict: 'slug' })
    .select().single();

  const { data: apple, error: bErr2 } = await supabase
    .from('brands')
    .upsert({ name: 'Apple', slug: 'apple', active: true }, { onConflict: 'slug' })
    .select().single();

  if (bErr1 || bErr2) {
    console.error("Error creating brands:", bErr1 || bErr2);
    return;
  }

  // 2. Insert Master Devices
  const { data: s25, error: dErr1 } = await supabase
    .from('master_devices')
    .upsert({
      brand_id: samsung.id,
      model_name: 'Galaxy S25 Ultra',
      slug: 'samsung-galaxy-s25-ultra',
      release_year: 2025,
      device_type: 'smartphone',
      specifications: {
        network: "5G",
        display: "6.8 inch Dynamic AMOLED 2X, 120Hz",
        processor: "Snapdragon 8 Gen 4",
        main_camera: "200 MP",
        battery: "5000 mAh"
      }
    }, { onConflict: 'slug' })
    .select().single();

  const { data: iphone15, error: dErr2 } = await supabase
    .from('master_devices')
    .upsert({
      brand_id: apple.id,
      model_name: 'iPhone 15 Pro',
      slug: 'apple-iphone-15-pro',
      release_year: 2023,
      device_type: 'smartphone',
      specifications: {
        network: "5G",
        display: "6.1 inch Super Retina XDR OLED, 120Hz",
        processor: "A17 Pro",
        main_camera: "48 MP",
        battery: "3274 mAh"
      }
    }, { onConflict: 'slug' })
    .select().single();

  if (dErr1 || dErr2) {
    console.error("Error creating master devices:", dErr1 || dErr2);
    return;
  }

  console.log("Master Devices Created:", s25.model_name, iphone15.model_name);

  // 3. Insert Master Variants
  // Delete existing variants for these devices just in case we are running this multiple times
  await supabase.from('master_device_variants').delete().in('master_device_id', [s25.id, iphone15.id]);

  const variants = [
    { master_device_id: s25.id, ram: '12GB', storage: '256GB', color: 'Titanium Black' },
    { master_device_id: s25.id, ram: '12GB', storage: '512GB', color: 'Titanium Gray' },
    { master_device_id: s25.id, ram: '16GB', storage: '1TB', color: 'Titanium Violet' },
    
    { master_device_id: iphone15.id, ram: '8GB', storage: '128GB', color: 'Natural Titanium' },
    { master_device_id: iphone15.id, ram: '8GB', storage: '256GB', color: 'Blue Titanium' },
  ];

  const { error: vErr } = await supabase.from('master_device_variants').insert(variants);

  if (vErr) {
    console.error("Error creating variants:", vErr);
  } else {
    console.log("Successfully inserted Master Variants!");
  }

  console.log("Seed complete!");
}

seed();
