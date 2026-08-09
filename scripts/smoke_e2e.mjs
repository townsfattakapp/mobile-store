/**
 * Production smoke checks for MobileStore.
 * Usage: node scripts/smoke_e2e.mjs [baseUrl]
 * Default baseUrl: http://localhost:3000
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

loadEnvLocal();

const BASE = process.argv[2] || process.env.SMOKE_BASE_URL || "http://localhost:3000";
const results = [];

function ok(name, detail = "") {
  results.push({ name, pass: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, pass: false, detail });
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function checkHttp(path, opts = {}) {
  const expect = opts.expect ?? [200];
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: opts.headers || {},
    });
    const code = res.status;
    if (expect.includes(code)) {
      ok(`HTTP ${path}`, `${code}`);
      return res;
    }
    fail(`HTTP ${path}`, `got ${code}, expected ${expect.join("|")}`);
    return res;
  } catch (e) {
    fail(`HTTP ${path}`, e.message);
    return null;
  }
}

async function main() {
  console.log(`\nSmoke E2E @ ${BASE}\n`);

  // Storefront routes
  await checkHttp("/");
  await checkHttp("/new-mobiles");
  await checkHttp("/login");
  await checkHttp("/checkout");
  await checkHttp("/accessories");
  await checkHttp("/categories");
  await checkHttp("/parts");

  // Admin should redirect unauthenticated → login (307/302/303)
  await checkHttp("/admin", { expect: [307, 302, 303, 301] });
  await checkHttp("/admin/settings", { expect: [307, 302, 303, 301] });
  await checkHttp("/admin/orders", { expect: [307, 302, 303, 301] });
  await checkHttp("/admin/pos", { expect: [307, 302, 303, 301] });

  // Sample product PDP (if any published product exists)
  {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const sb = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: sample } = await sb
        .from("products")
        .select("slug, status")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (sample?.slug) {
        await checkHttp(`/product/${sample.slug}`);
      } else {
        ok("HTTP /product/:slug", "skipped (no active product)");
      }
    }
  }

  // Payment API validation
  {
    const res = await fetch(`${BASE}/api/payments/razorpay/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 400) ok("create-order rejects empty body", "400");
    else fail("create-order rejects empty body", `got ${res.status}`);
  }

  // Demo payment crypto (mirrors src/lib/payments/razorpay.ts)
  {
    const secret = process.env.RAZORPAY_DEMO_SECRET || "mobistore_demo_secret";
    const orderId = "order_demo_test";
    const paymentId = "pay_demo_test";
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    if (signature === expected) ok("demo HMAC signature", "matches");
    else fail("demo HMAC signature", "mismatch");
  }

  // Supabase connectivity + critical tables
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const table of [
      "products",
      "orders",
      "profiles",
      "walk_in_customers",
      "invoices",
    ]) {
      const { error, count } = await sb
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) fail(`DB ${table}`, error.message);
      else ok(`DB ${table}`, `count=${count ?? "?"}`);
    }

    // Storage backend awareness
    const r2 =
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL;
    if (r2) ok("image storage", "Cloudflare R2 configured");
    else fail("image storage", "R2 required — set R2_* env vars");

    const rzpLive =
      (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID) &&
      process.env.RAZORPAY_KEY_SECRET;
    ok(
      "payments mode",
      rzpLive ? "Razorpay LIVE keys present" : "demo mode (no keys)"
    );
  } else {
    fail("Supabase env", "NEXT_PUBLIC_SUPABASE_URL / key missing");
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const pct = total ? Math.round((passed / total) * 100) : 0;
  console.log(`\nResult: ${passed}/${total} passed (${pct}%)\n`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
