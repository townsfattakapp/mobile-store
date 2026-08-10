/**
 * End-to-end giveaway verification against DEV Supabase + local Next server.
 *
 * Usage:
 *   node --env-file=.env.local scripts/e2e_giveaway.mjs
 *
 * Creates disposable auth users + a campaign, exercises join/referral/share/
 * purchase/refund/draw at the DB layer (same constraints the app uses), then
 * hits public HTTP endpoints on localhost:3000.
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";

if (!SUPABASE_URL || !SERVICE || !ANON) {
  console.error("Missing Supabase env in .env.local");
  process.exit(1);
}

const host = new URL(SUPABASE_URL).hostname;
if (host.includes("nedyfakmrzvzoqaqsnqe")) {
  console.error("Refusing to run against PRODUCTION Supabase.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now().toString(36);
const SLUG = `e2e-iphone-${stamp}`;
const PASSWORD = "TestPass123!e2e";

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`  ✅ ${name}${detail ? " — " + detail : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error(`  ❌ ${name}${detail ? " — " + detail : ""}`);
}

async function ensureProfile(user) {
  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email.split("@")[0],
      role: "customer",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error("profile upsert: " + error.message);
}

async function createUser(label, name) {
  const email = `giveaway.${label}.${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  await ensureProfile(data.user);
  return data.user;
}

function weightedPick(weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let ticket = randomInt(total);
  for (let i = 0; i < weights.length; i++) {
    if (ticket < weights[i]) return i;
    ticket -= weights[i];
  }
  return weights.length - 1;
}

async function main() {
  console.log("\n🎯 Giveaway E2E against", host);
  console.log("   HTTP base:", BASE, "\n");

  // ── 0. Tables ────────────────────────────────────────────────────────────
  console.log("0) Schema check");
  {
    const { error } = await admin.from("giveaways").select("id").limit(1);
    if (error) {
      fail("giveaways table", error.message);
      console.error("\nRun APPLY_NOW_giveaways.sql on this DEV project first.\n");
      process.exit(1);
    }
    pass("giveaways table exists");
  }

  // ── 1. Users ─────────────────────────────────────────────────────────────
  console.log("\n1) Create dummy users");
  const userA = await createUser("a", "Rahul Sharma");
  const userB = await createUser("b", "Amit Patel");
  pass("created user A", userA.email);
  pass("created user B", userB.email);

  // ── 2. Campaign + rules ──────────────────────────────────────────────────
  console.log("\n2) Seed campaign");
  const start = new Date(Date.now() - 3600_000).toISOString();
  const end = new Date(Date.now() + 7 * 86400_000).toISOString();
  const { data: giveaway, error: gErr } = await admin
    .from("giveaways")
    .insert({
      title: `E2E Win iPhone ${stamp}`,
      slug: SLUG,
      description: "Automated end-to-end test giveaway. Safe to delete.",
      prize_title: "iPhone 16 Pro",
      prize_description: "Dummy prize for local testing",
      terms_and_conditions: "E2E test terms. No real prize.",
      start_at: start,
      end_at: end,
      status: "active",
      max_winners: 1,
    })
    .select("*")
    .single();
  if (gErr) throw new Error(gErr.message);
  pass("created giveaway", `/giveaway/${SLUG}`);

  const rules = [
    { action_type: "join", entries: 1, enabled: true, configuration: {} },
    {
      action_type: "whatsapp_share",
      entries: 1,
      enabled: true,
      configuration: { cooldown_hours: 24 },
    },
    { action_type: "referral", entries: 2, enabled: true, configuration: {} },
    {
      action_type: "purchase",
      entries: 5,
      min_order_amount: 20000,
      enabled: true,
      configuration: {},
    },
    {
      action_type: "purchase",
      entries: 10,
      min_order_amount: 50000,
      enabled: true,
      configuration: {},
    },
  ].map((r) => ({ ...r, giveaway_id: giveaway.id }));

  const { error: rErr } = await admin.from("giveaway_entry_rules").insert(rules);
  if (rErr) throw new Error(rErr.message);
  pass("seeded entry rules", "join/share/referral/purchase tiers");

  // ── 3. Join A ────────────────────────────────────────────────────────────
  console.log("\n3) Join user A");
  const codeA = `RAHUL${stamp.slice(-2).toUpperCase()}${randomInt(10, 99)}`;
  const { data: partA, error: pAErr } = await admin
    .from("giveaway_participants")
    .insert({
      giveaway_id: giveaway.id,
      user_id: userA.id,
      referral_code: codeA,
      status: "active",
    })
    .select("*")
    .single();
  if (pAErr) throw new Error(pAErr.message);

  const { error: joinAErr } = await admin.from("giveaway_entries").insert({
    giveaway_id: giveaway.id,
    participant_id: partA.id,
    source_type: "join",
    source_id: partA.id,
    entries: 1,
    description: "Joined the giveaway",
  });
  if (joinAErr) throw new Error(joinAErr.message);
  pass("A joined + JOIN +1", codeA);

  // Duplicate join credit must fail unique
  const { error: dupJoin } = await admin.from("giveaway_entries").insert({
    giveaway_id: giveaway.id,
    participant_id: partA.id,
    source_type: "join",
    source_id: partA.id,
    entries: 1,
    description: "dup",
  });
  if (dupJoin && /unique|duplicate/i.test(dupJoin.message)) {
    pass("duplicate JOIN blocked by unique index");
  } else {
    fail("duplicate JOIN should fail", dupJoin?.message || "no error");
  }

  // Duplicate participant must fail
  const { error: dupPart } = await admin.from("giveaway_participants").insert({
    giveaway_id: giveaway.id,
    user_id: userA.id,
    referral_code: codeA + "X",
    status: "active",
  });
  if (dupPart && /unique|duplicate/i.test(dupPart.message)) {
    pass("duplicate participant blocked");
  } else {
    fail("duplicate participant should fail", dupPart?.message || "no error");
  }

  // ── 4. Join B with referral ──────────────────────────────────────────────
  console.log("\n4) Join user B via referral");
  const codeB = `AMIT${stamp.slice(-2).toUpperCase()}${randomInt(10, 99)}`;
  const { data: partB, error: pBErr } = await admin
    .from("giveaway_participants")
    .insert({
      giveaway_id: giveaway.id,
      user_id: userB.id,
      referral_code: codeB,
      referred_by_participant_id: partA.id,
      status: "active",
    })
    .select("*")
    .single();
  if (pBErr) throw new Error(pBErr.message);

  await admin.from("giveaway_entries").insert({
    giveaway_id: giveaway.id,
    participant_id: partB.id,
    source_type: "join",
    source_id: partB.id,
    entries: 1,
    description: "Joined the giveaway",
  });

  const { error: refErr } = await admin.from("giveaway_entries").insert({
    giveaway_id: giveaway.id,
    participant_id: partA.id,
    source_type: "referral",
    source_id: partB.id,
    entries: 2,
    description: "Referral bonus — friend joined",
  });
  if (refErr) throw new Error(refErr.message);
  pass("B joined with ref; A got +2 referral");

  const { error: dupRef } = await admin.from("giveaway_entries").insert({
    giveaway_id: giveaway.id,
    participant_id: partA.id,
    source_type: "referral",
    source_id: partB.id,
    entries: 2,
    description: "dup referral",
  });
  if (dupRef && /unique|duplicate/i.test(dupRef.message)) {
    pass("duplicate referral reward blocked");
  } else {
    fail("duplicate referral should fail", dupRef?.message || "no error");
  }

  // ── 5. Share reward + cooldown ───────────────────────────────────────────
  console.log("\n5) WhatsApp share reward");
  const shareKey = `share:${partA.id}:bucket1`;
  const { error: shErr } = await admin.from("giveaway_entries").insert({
    giveaway_id: giveaway.id,
    participant_id: partA.id,
    source_type: "whatsapp_share",
    source_id: shareKey,
    entries: 1,
    description: "WhatsApp / share reward",
  });
  if (shErr) throw new Error(shErr.message);
  pass("A share +1");

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: recentShare } = await admin
    .from("giveaway_entries")
    .select("id")
    .eq("participant_id", partA.id)
    .eq("source_type", "whatsapp_share")
    .gte("created_at", since);
  if ((recentShare || []).length >= 1) {
    pass("cooldown query sees recent share", `count=${recentShare.length}`);
  } else {
    fail("cooldown query should find share");
  }

  // ── 6. Purchase + duplicate + reverse ────────────────────────────────────
  console.log("\n6) Purchase reward + refund reversal");
  const orderId = crypto.randomUUID();
  // Fake order row if orders FK required — check: source_id is TEXT, no FK. Good.
  const { error: buyErr } = await admin.from("giveaway_entries").insert({
    giveaway_id: giveaway.id,
    participant_id: partA.id,
    source_type: "purchase",
    source_id: orderId,
    entries: 5,
    description: "Purchase reward (order ₹40,000)",
    metadata: { grand_total: 40000, order_id: orderId },
  });
  if (buyErr) throw new Error(buyErr.message);
  pass("purchase +5 for ₹40k tier");

  const { error: dupBuy } = await admin.from("giveaway_entries").insert({
    giveaway_id: giveaway.id,
    participant_id: partA.id,
    source_type: "purchase",
    source_id: orderId,
    entries: 5,
    description: "dup purchase",
  });
  if (dupBuy && /unique|duplicate/i.test(dupBuy.message)) {
    pass("duplicate purchase reward blocked");
  } else {
    fail("duplicate purchase should fail", dupBuy?.message || "no error");
  }

  const { error: revErr } = await admin.from("giveaway_entries").insert({
    giveaway_id: giveaway.id,
    participant_id: partA.id,
    source_type: "refund_reversal",
    source_id: orderId,
    entries: -5,
    description: "Purchase reward reversed (cancel/refund)",
  });
  if (revErr) throw new Error(revErr.message);
  pass("refund_reversal -5 written (original +5 kept)");

  // Re-award pathway after reversal for draw: add a fresh purchase
  const order2 = crypto.randomUUID();
  await admin.from("giveaway_entries").insert({
    giveaway_id: giveaway.id,
    participant_id: partA.id,
    source_type: "purchase",
    source_id: order2,
    entries: 10,
    description: "Purchase reward (order ₹55,000)",
    metadata: { grand_total: 55000 },
  });
  pass("second purchase +10");

  // ── 7. Totals / leaderboard order ────────────────────────────────────────
  console.log("\n7) Leaderboard aggregation");
  const { data: parts } = await admin
    .from("giveaway_participants")
    .select("id, user_id, joined_at, entries:giveaway_entries(entries)")
    .eq("giveaway_id", giveaway.id);

  const agg = (parts || []).map((p) => ({
    id: p.id,
    user_id: p.user_id,
    total: (p.entries || []).reduce((s, e) => s + Number(e.entries || 0), 0),
    joined_at: p.joined_at,
  }));
  agg.sort((a, b) => b.total - a.total || +new Date(a.joined_at) - +new Date(b.joined_at));

  const aTot = agg.find((x) => x.user_id === userA.id)?.total;
  const bTot = agg.find((x) => x.user_id === userB.id)?.total;
  // A: join1 + ref2 + share1 + buy5 -5 + buy10 = 14
  // B: join1 = 1
  if (aTot === 14 && bTot === 1 && agg[0].user_id === userA.id) {
    pass("totals & rank correct", `A=${aTot} (#1), B=${bTot} (#2)`);
  } else {
    fail("totals unexpected", `A=${aTot} B=${bTot} order=${agg.map((x) => x.total).join(",")}`);
  }

  // ── 8. Weighted draw ─────────────────────────────────────────────────────
  console.log("\n8) Secure weighted draw");
  await admin
    .from("giveaways")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", giveaway.id);

  const eligible = agg.filter((x) => x.total > 0);
  const idx = weightedPick(eligible.map((e) => e.total));
  const winner = eligible[idx];

  const { data: draw, error: dErr } = await admin
    .from("giveaway_draws")
    .insert({
      giveaway_id: giveaway.id,
      total_eligible_entries: eligible.reduce((s, e) => s + e.total, 0),
      eligible_participant_count: eligible.length,
      algorithm: "weighted_crypto_random",
      algorithm_seed: `e2e:${new Date().toISOString()}`,
      snapshot: { winner: winner.id },
    })
    .select("*")
    .single();
  if (dErr) throw new Error(dErr.message);

  const { error: wErr } = await admin.from("giveaway_winners").insert({
    giveaway_id: giveaway.id,
    draw_id: draw.id,
    participant_id: winner.id,
    user_id: winner.user_id,
    display_name: winner.user_id === userA.id ? "Rahul S." : "Amit P.",
    prize_title: giveaway.prize_title,
    status: "announced",
    publicly_announced: true,
  });
  if (wErr) throw new Error(wErr.message);
  pass("draw + winner recorded", winner.user_id === userA.id ? "Rahul S." : "Amit P.");

  const { error: dupDraw } = await admin.from("giveaway_draws").insert({
    giveaway_id: giveaway.id,
    total_eligible_entries: 1,
    eligible_participant_count: 1,
    algorithm: "weighted_crypto_random",
  });
  if (dupDraw && /unique|duplicate/i.test(dupDraw.message)) {
    pass("second draw blocked by unique constraint");
  } else {
    fail("second draw should fail", dupDraw?.message || "no error");
  }

  // ── 9. HTTP smoke (local Next) ───────────────────────────────────────────
  console.log("\n9) HTTP smoke against", BASE);
  async function httpCheck(path, expectOk = true) {
    try {
      const res = await fetch(BASE + path, { redirect: "manual" });
      const ok = expectOk ? res.status < 400 : true;
      if (ok && res.status < 500) {
        pass(`GET ${path}`, `status ${res.status}`);
        return res;
      }
      fail(`GET ${path}`, `status ${res.status}`);
      return res;
    } catch (e) {
      fail(`GET ${path}`, e.message);
      return null;
    }
  }

  await httpCheck(`/giveaway/${SLUG}`);
  await httpCheck(`/giveaways`);
  const lb = await httpCheck(`/api/giveaways/${giveaway.id}/leaderboard?page=1&limit=10`);
  if (lb && lb.ok) {
    const json = await lb.json();
    const n = json.total_participants ?? json.totalParticipants;
    if (n >= 2) pass("leaderboard API has participants", `total=${n}`);
    else fail("leaderboard API participants", JSON.stringify(json).slice(0, 200));
  }
  await httpCheck(`/api/giveaways/${giveaway.id}/my-position`);

  // ── Summary ──────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log("\n────────────────────────────────────────");
  console.log(`Passed ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log("Failures:");
    for (const f of failed) console.log(" -", f.name, f.detail);
  }
  console.log("\nDummy data left on DEV (safe to delete):");
  console.log("  slug:", SLUG);
  console.log("  giveaway_id:", giveaway.id);
  console.log("  users:", userA.email, userB.email);
  console.log("  password:", PASSWORD);
  console.log("  open:", `${BASE}/giveaway/${SLUG}`);
  console.log("────────────────────────────────────────\n");

  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("\nE2E crashed:", e);
  process.exit(1);
});
