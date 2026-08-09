/**
 * Nuclear wipe of demo/seed data on the Supabase project in .env.local
 * (same DB as Vercel if you reused those env vars).
 *
 * Keeps: store_settings, admin/staff profiles + their auth users
 * Removes: products, orders, invoices, carts, categories, brands,
 *          walk-ins, addresses, demo customer auth users
 *
 * Usage: node scripts/wipe_demo_data.mjs
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_CUSTOMER_EMAILS = [
  "priya.sharma@example.com",
  "rahul.mehta@example.com",
  "anjali.nair@example.com",
];

async function wipeTable(table) {
  const { error, count } = await sb.from(table).delete({ count: "exact" }).neq(
    "id",
    "00000000-0000-0000-0000-000000000000"
  );
  if (error) {
    if (/does not exist|schema cache|Could not find/i.test(error.message)) {
      console.log(`  · skip ${table} (missing)`);
      return;
    }
    console.warn(`  ! ${table}: ${error.message}`);
    return;
  }
  console.log(`  ✓ ${table}${count != null ? ` (${count})` : ""}`);
}

async function main() {
  console.log("\n=== Wipe demo data for production ===");
  console.log("Target:", url);
  console.log("This does NOT delete store_settings or admin users.\n");

  // Child → parent-ish order
  const tables = [
    "order_items",
    "order_status_history",
    "invoices",
    "orders",
    "cart_items",
    "carts",
    "inventory_movements",
    "used_device_inspections",
    "used_device_details",
    "product_images",
    "product_variants",
    "products",
    "master_device_variants",
    "master_devices",
    "walk_in_customers",
    "addresses",
    "categories",
    "brands",
  ];

  for (const t of tables) {
    await wipeTable(t);
  }

  // Reset invoice sequences if table exists
  const { error: seqErr } = await sb
    .from("invoice_sequences")
    .update({ last_number: 0 })
    .gte("last_number", 0);
  if (seqErr) console.log("  · invoice_sequences:", seqErr.message);
  else console.log("  ✓ invoice_sequences reset");

  // Remove known demo auth customers (not admins)
  console.log("\nDemo auth users…");
  const { data: listed, error: listErr } = await sb.auth.admin.listUsers({ perPage: 200 });
  if (listErr) {
    console.warn("  ! listUsers:", listErr.message);
  } else {
    for (const u of listed?.users || []) {
      const email = (u.email || "").toLowerCase();
      if (!DEMO_CUSTOMER_EMAILS.includes(email)) continue;
      const { error } = await sb.auth.admin.deleteUser(u.id);
      if (error) console.warn("  ! delete", email, error.message);
      else console.log("  ✓ deleted auth", email);
    }
  }

  // Soft-clean demo notes on leftover customer profiles (keep real signups)
  await sb
    .from("profiles")
    .update({ admin_notes: null })
    .eq("admin_notes", "Demo seeded customer.");
  await sb
    .from("profiles")
    .update({ admin_notes: null })
    .ilike("admin_notes", "%Demo seeded%");

  console.log("\nDone. Production catalog is empty.");
  console.log("Next: Admin → Brands/Categories/Products — add real inventory.");
  console.log("Do NOT run seed_e2e_demo.mjs against this project again.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
