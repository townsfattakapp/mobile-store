/**
 * End-to-end demo seed for MobiStore.
 * Creates admin + customers, addresses, walk-in POS-style orders, invoices.
 *
 * Usage: node scripts/seed_e2e_demo.mjs
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Optional: run APPLY_NOW_production_crm.sql first for CRM columns / walk_in_customers
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

const ADMIN_EMAIL = "admin@mobistore.in";
const ADMIN_PASSWORD = "Admin@12345";
const DEMO_PASSWORD = "Demo@12345";

function phoneKey(p) {
  const d = String(p || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d || null;
}

async function ensureAuthUser({ email, password, full_name, phone, role }) {
  const { data: listed } = await sb.auth.admin.listUsers({ perPage: 200 });
  let user = listed?.users?.find((u) => u.email === email);

  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    user = data.user;
    console.log("  + auth", email);
  } else {
    console.log("  · auth exists", email);
  }

  const base = {
    id: user.id,
    email,
    full_name,
    phone_number: phone,
    role,
    updated_at: new Date().toISOString(),
  };

  // Try with CRM columns first
  let { error } = await sb.from("profiles").upsert(
    { ...base, customer_status: role === "customer" ? "active" : "active" },
    { onConflict: "id" }
  );
  if (error && /customer_status|admin_notes/i.test(error.message)) {
    ({ error } = await sb.from("profiles").upsert(base, { onConflict: "id" }));
  }
  if (error) throw new Error(`profile ${email}: ${error.message}`);
  return user;
}

async function main() {
  console.log("\n=== MobiStore E2E Seed ===\n");

  // Capability checks
  const caps = {
    customer_status: true,
    walk_in_customers: true,
    store_settings: true,
  };
  {
    const { error } = await sb.from("profiles").select("customer_status").limit(1);
    if (error?.message?.includes("customer_status")) caps.customer_status = false;
  }
  {
    const { error } = await sb.from("walk_in_customers").select("id").limit(1);
    if (error) caps.walk_in_customers = false;
  }
  {
    const { error } = await sb.from("store_settings").select("id").limit(1);
    if (error) caps.store_settings = false;
  }
  console.log("Capabilities:", caps);
  if (!caps.customer_status || !caps.walk_in_customers || !caps.store_settings) {
    console.log(
      "\n⚠ Run supabase/migrations/APPLY_NOW_production_crm.sql then re-seed for full CRM.\n"
    );
  }

  // Products
  const { data: products, error: pErr } = await sb
    .from("products")
    .select("id, name, sku, selling_price, mrp, stock_quantity, status, type")
    .eq("status", "active")
    .limit(20);
  if (pErr) throw pErr;
  if (!products?.length) {
    console.error("No active products. Run scripts/seed_store_products.mjs first.");
    process.exit(1);
  }
  console.log("Active products:", products.length);

  // Users
  console.log("\nUsers…");
  const admin = await ensureAuthUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    full_name: "Store Admin",
    phone: "9876500001",
    role: "admin",
  });

  const customers = [
    {
      email: "priya.sharma@example.com",
      full_name: "Priya Sharma",
      phone: "9876511101",
      city: "Pune",
      state: "Maharashtra",
      pin: "411001",
      status: "vip",
    },
    {
      email: "rahul.mehta@example.com",
      full_name: "Rahul Mehta",
      phone: "9876511102",
      city: "Bengaluru",
      state: "Karnataka",
      pin: "560001",
      status: "active",
    },
    {
      email: "anjali.nair@example.com",
      full_name: "Anjali Nair",
      phone: "9876511103",
      city: "Kochi",
      state: "Kerala",
      pin: "682001",
      status: "active",
    },
  ];

  const customerUsers = [];
  for (const c of customers) {
    const u = await ensureAuthUser({
      email: c.email,
      password: DEMO_PASSWORD,
      full_name: c.full_name,
      phone: c.phone,
      role: "customer",
    });
    if (caps.customer_status) {
      await sb
        .from("profiles")
        .update({
          customer_status: c.status,
          admin_notes:
            c.status === "vip"
              ? "Loyal VIP — prefers flagship launches."
              : "Demo seeded customer.",
        })
        .eq("id", u.id);
    }
    customerUsers.push({ ...c, id: u.id });
  }

  // Addresses
  console.log("\nAddresses…");
  for (const c of customerUsers) {
    const { data: existing } = await sb
      .from("addresses")
      .select("id")
      .eq("user_id", c.id)
      .limit(1);
    if (existing?.length) continue;
    const { error } = await sb.from("addresses").insert({
      user_id: c.id,
      full_name: c.full_name,
      mobile_number: c.phone,
      address_line: `Flat 12, Demo Residency, Near Metro`,
      city: c.city,
      state: c.state,
      pin_code: c.pin,
      type: "home",
      is_default: true,
    });
    if (error) console.warn("  address", c.email, error.message);
    else console.log("  + address", c.full_name);
  }

  // Registered orders
  console.log("\nRegistered customer orders…");
  const statuses = ["pending", "confirmed", "shipped", "delivered"];
  for (let i = 0; i < customerUsers.length; i++) {
    const c = customerUsers[i];
    const prod = products[i % products.length];
    const orderNumber = `ORD-DEMO-${Date.now().toString().slice(-6)}-${i + 1}`;
    const price = Number(prod.selling_price) || 25000;
    const { data: order, error } = await sb
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: c.id,
        address_snapshot: {
          full_name: c.full_name,
          mobile_number: c.phone,
          address_line: "Flat 12, Demo Residency",
          city: c.city,
          state: c.state,
          pin_code: c.pin,
          type: "home",
        },
        subtotal: price,
        discount: 0,
        tax_total: Math.round(price * 0.18),
        shipping_charge: 0,
        grand_total: price,
        payment_method: i % 2 === 0 ? "online" : "cod",
        payment_status: i === 0 ? "pending" : "paid",
        status: statuses[i % statuses.length],
        notes: "Demo seeded order",
      })
      .select()
      .single();
    if (error) {
      console.warn("  order fail", error.message);
      continue;
    }
    await sb.from("order_items").insert({
      order_id: order.id,
      product_id: prod.id,
      product_name: prod.name,
      sku: prod.sku || `SKU-${prod.id.slice(0, 6)}`,
      quantity: 1,
      unit_price: price,
      total_price: price,
      tax_rate: 18,
    });
    console.log("  +", orderNumber, "→", c.full_name, prod.name);
  }

  // Walk-in POS-style orders (no user_id)
  console.log("\nWalk-in orders…");
  const walkins = [
    { name: "Amit Patel", phone: "9988776655", note: "Wants EMI on next phone" },
    { name: "Sneha Reddy", phone: "9123456780", note: "Screen guard only visitor" },
    { name: "Amit Patel", phone: "9988776655", note: "Repeat walk-in same day" },
  ];
  const walkOrderIds = [];
  for (let i = 0; i < walkins.length; i++) {
    const w = walkins[i];
    const prod = products[(i + 2) % products.length];
    const price = Math.min(Number(prod.selling_price) || 15000, 45000);
    const orderNumber = `POS-DEMO-${Date.now().toString().slice(-6)}-${i + 1}`;
    const { data: order, error } = await sb
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: null,
        address_snapshot: {
          full_name: w.name,
          mobile_number: w.phone,
          address_line: "Store Walk-in",
          city: "Mumbai",
          state: "Maharashtra",
          pin_code: "400001",
          type: "walkin",
        },
        subtotal: price,
        discount: 0,
        tax_total: 0,
        shipping_charge: 0,
        grand_total: price,
        payment_method: "store_pickup",
        payment_status: "paid",
        status: "delivered",
        notes: "Walk-in POS Sale",
      })
      .select()
      .single();
    if (error) {
      console.warn("  walk-in fail", error.message);
      continue;
    }
    await sb.from("order_items").insert({
      order_id: order.id,
      product_id: prod.id,
      product_name: prod.name,
      sku: prod.sku || `SKU-${prod.id.slice(0, 6)}`,
      quantity: 1,
      unit_price: price,
      total_price: price,
    });
    walkOrderIds.push({ order, w, prod, price });
    console.log("  +", orderNumber, w.name, w.phone);
  }

  // Walk-in CRM rows
  if (caps.walk_in_customers) {
    console.log("\nWalk-in CRM…");
    for (const phone of ["9988776655", "9123456780"]) {
      const { error } = await sb.from("walk_in_customers").upsert(
        {
          phone_key: phoneKey(phone),
          display_phone: phone,
          full_name: phone.endsWith("6655") ? "Amit Patel" : "Sneha Reddy",
          customer_status: phone.endsWith("6655") ? "vip" : "active",
          admin_notes:
            phone.endsWith("6655")
              ? "Repeat walker — interested in flagship trade-in."
              : "Demo walk-in.",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "phone_key" }
      );
      if (error) console.warn("  walk crm", error.message);
      else console.log("  + walk_in", phone);
    }
  }

  // Invoices for walk-ins + first registered order
  console.log("\nInvoices…");
  const storeSnap = {
    legal_name: "MobiStore",
    trade_name: "MobiStore",
    address_line1: "123 Tech Avenue",
    city: "Mumbai",
    state: "Maharashtra",
    state_code: "27",
    pin_code: "400001",
    phone: "+91 98765 43210",
    gst_registered: false,
  };

  let invN = 1;
  for (const row of walkOrderIds) {
    const invNum = `BILL-DEMO-${String(invN++).padStart(4, "0")}`;
    const { error } = await sb.from("invoices").insert({
      invoice_number: invNum,
      order_id: row.order.id,
      invoice_date: new Date().toISOString(),
      store_snapshot: storeSnap,
      customer_snapshot: {
        full_name: row.w.name,
        mobile_number: row.w.phone,
        address_line: "Store Walk-in",
        city: "Mumbai",
        state: "Maharashtra",
        pin_code: "400001",
        place_of_supply_code: "27",
      },
      totals_snapshot: {
        subtotal: row.price,
        tax_total: 0,
        grand_total: row.price,
        discount: 0,
      },
      items_snapshot: [
        {
          product_name: row.prod.name,
          sku: row.prod.sku,
          quantity: 1,
          unit_price: row.price,
          total_price: row.price,
        },
      ],
      status: "issued",
      is_gst: false,
      invoice_type: "retail_invoice",
    });
    if (error) console.warn("  invoice", invNum, error.message);
    else console.log("  +", invNum);
  }

  // Dashboard-friendly featured flags
  await sb
    .from("products")
    .update({ is_featured: true })
    .in(
      "id",
      products.slice(0, 4).map((p) => p.id)
    );

  console.log("\n=== Seed complete ===");
  console.log(`
Login credentials
─────────────────
Admin:     ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}
Customer:  priya.sharma@example.com / ${DEMO_PASSWORD}

Open
────
Storefront:  http://127.0.0.1:3000/
Admin:       http://127.0.0.1:3000/admin
Customers:   http://127.0.0.1:3000/admin/customers  (filter Walk-in)
POS:         http://127.0.0.1:3000/admin/pos
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
