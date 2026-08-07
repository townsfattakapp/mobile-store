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

async function seedStore() {
  console.log("Starting Store Data Seed...");

  // Fetch Master Devices
  const { data: masters, error: errM } = await supabase.from('master_devices').select('*, variants:master_device_variants(*)');
  if (errM || !masters || masters.length === 0) {
    console.error("No master devices found! Seed master catalog first.");
    return;
  }

  const samsung = masters.find(m => m.model_name.includes("S25"));
  const apple = masters.find(m => m.model_name.includes("iPhone"));

  // Create active new mobile for S25
  if (samsung) {
    const s25Payload = {
      name: samsung.model_name,
      slug: samsung.slug + '-store',
      sku: 'SKU-S25-' + Date.now(),
      type: 'new_mobile',
      brand_id: samsung.brand_id,
      master_device_id: samsung.id,
      mrp: 129999,
      selling_price: 114999,
      stock_quantity: 15,
      status: 'active',
      main_image_url: 'https://images.samsung.com/is/image/samsung/p6pim/in/2401/gallery/in-galaxy-s24-s928-sm-s928bzkqins-539573322?$650_519_PNG$',
      short_description: 'The ultimate AI smartphone with 200MP camera.',
      specifications: {
        offers: ["Flat ₹5000 Instant Discount on HDFC Credit Cards", "Free Samsung Care+ for 1 Year"]
      }
    };

    const { data: s25Prod, error: s25Err } = await supabase.from('products').upsert(s25Payload, { onConflict: 'slug' }).select().single();
    if (!s25Err && samsung.variants) {
      const vars = samsung.variants.map(v => ({
        product_id: s25Prod.id,
        sku: 'VAR-' + v.id.substring(0,6),
        name: `${v.ram} + ${v.storage}${v.color ? ` - ${v.color}` : ''}`,
        mrp: 129999,
        selling_price: 114999,
        stock_quantity: 5,
        attributes: { color: v.color, ram: v.ram, storage: v.storage }
      }));
      await supabase.from('product_variants').upsert(vars, { onConflict: 'sku' });
    }
  }

  // Create an active NEW mobile for iPhone
  if (apple) {
    const iphonePayload = {
      name: apple.model_name,
      slug: apple.slug + '-store-new',
      sku: 'SKU-IP15-' + Date.now(),
      type: 'new_mobile',
      brand_id: apple.brand_id,
      master_device_id: apple.id,
      mrp: 134900,
      selling_price: 127900,
      stock_quantity: 8,
      status: 'active',
      main_image_url: 'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692875994004',
      short_description: 'Forged in titanium. A17 Pro chip. 48MP camera.',
      specifications: {
        offers: ["Flat ₹6000 Cashback on ICICI Bank Cards"]
      }
    };
    const { data: ipProd } = await supabase.from('products').upsert(iphonePayload, { onConflict: 'slug' }).select().single();
    if (ipProd && apple.variants) {
      const vars = apple.variants.map(v => ({
        product_id: ipProd.id,
        sku: 'VAR-' + v.id.substring(0,6) + '-new',
        name: `${v.ram} + ${v.storage}${v.color ? ` - ${v.color}` : ''}`,
        mrp: 134900,
        selling_price: 127900,
        stock_quantity: 4,
        attributes: { color: v.color, ram: v.ram, storage: v.storage }
      }));
      await supabase.from('product_variants').upsert(vars, { onConflict: 'sku' });
    }

    // Create an active USED mobile for iPhone
    const usedIphonePayload = {
      name: "Pre-Owned " + apple.model_name,
      slug: apple.slug + '-store-used',
      sku: 'SKU-USED-IP15-' + Date.now(),
      type: 'used_mobile',
      brand_id: apple.brand_id,
      master_device_id: apple.id,
      mrp: 134900,
      selling_price: 89000,
      stock_quantity: 1,
      status: 'active',
      main_image_url: 'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-bluetitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692875994004',
      short_description: 'Pristine condition used iPhone. Fully inspected.',
      specifications: {
        offers: ["Free Fast Charger Included"]
      }
    };
    
    const { data: usedIpProd } = await supabase.from('products').upsert(usedIphonePayload, { onConflict: 'slug' }).select().single();
    
    if (usedIpProd) {
      // Add used inspection checklist
      await supabase.from('used_device_inspections').upsert({
        product_id: usedIpProd.id,
        display_tested: true,
        touch_tested: true,
        camera_tested: true,
        speaker_tested: true,
        microphone_tested: true,
        wifi_tested: true,
        bluetooth_tested: true,
        charging_tested: true,
        battery_tested: true,
        fingerprint_tested: true,
        face_id_tested: true,
        sim_tested: true,
        buttons_tested: true
      }, { onConflict: 'product_id' });
    }
  }

  console.log("Store Data Seeded Successfully!");
}

seedStore();
