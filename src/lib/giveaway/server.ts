"use server";

import { randomInt } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { safeDisplayName } from "./displayName";
import { generateReferralCode, normalizeReferralCode } from "./referralCode";
import {
  canJoinGiveaway,
  entriesToNextRank,
  getRuleEntries,
  getShareCooldownHours,
  pickPurchaseRule,
  resolvePublicState,
  weightedPickIndex,
} from "./rules";
import type {
  GiveawayEntryRule,
  GiveawayRow,
  LeaderboardRow,
  MyPosition,
} from "./types";

function mapGiveaway(row: any): GiveawayRow {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    prize_title: row.prize_title,
    prize_description: row.prize_description ?? null,
    prize_image: row.prize_image ?? null,
    terms_and_conditions: row.terms_and_conditions ?? null,
    start_at: row.start_at ?? null,
    end_at: row.end_at ?? null,
    status: row.status,
    max_winners: Number(row.max_winners) || 1,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapRule(row: any): GiveawayEntryRule {
  return {
    id: row.id,
    giveaway_id: row.giveaway_id,
    action_type: row.action_type,
    entries: Number(row.entries) || 0,
    min_order_amount:
      row.min_order_amount == null ? null : Number(row.min_order_amount),
    max_order_amount:
      row.max_order_amount == null ? null : Number(row.max_order_amount),
    enabled: Boolean(row.enabled),
    configuration: (row.configuration || {}) as Record<string, unknown>,
  };
}

export async function writeGiveawayAudit(input: {
  giveawayId?: string | null;
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("giveaway_audit_log").insert({
      giveaway_id: input.giveawayId || null,
      actor_id: input.actorId || null,
      action: input.action,
      entity: input.entity || null,
      entity_id: input.entityId || null,
      metadata: input.metadata || null,
    });
  } catch {
    // non-fatal
  }
}

async function loadRules(giveawayId: string): Promise<GiveawayEntryRule[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("giveaway_entry_rules")
    .select("*")
    .eq("giveaway_id", giveawayId);
  if (error) {
    if (/giveaway_entry_rules|relation|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Giveaway tables missing. Run supabase/migrations/APPLY_NOW_giveaways.sql"
      );
    }
    throw new Error(error.message);
  }
  return (data || []).map(mapRule);
}

export async function getGiveawayBySlug(slug: string): Promise<GiveawayRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("giveaways")
    .select("*")
    .ilike("slug", slug.trim())
    .maybeSingle();
  if (error) {
    if (/giveaways|relation|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Giveaway tables missing. Run supabase/migrations/APPLY_NOW_giveaways.sql"
      );
    }
    throw new Error(error.message);
  }
  return data ? mapGiveaway(data) : null;
}

export async function getGiveawayById(id: string): Promise<GiveawayRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("giveaways").select("*").eq("id", id).maybeSingle();
  return data ? mapGiveaway(data) : null;
}

async function participantEntryTotal(
  admin: ReturnType<typeof createAdminClient>,
  participantId: string
): Promise<number> {
  const { data } = await admin
    .from("giveaway_entries")
    .select("entries")
    .eq("participant_id", participantId);
  return (data || []).reduce((s, r) => s + (Number(r.entries) || 0), 0);
}

async function flagRisk(input: {
  giveawayId: string;
  participantId: string;
  flagType: string;
  details?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("giveaway_risk_flags").insert({
    giveaway_id: input.giveawayId,
    participant_id: input.participantId,
    flag_type: input.flagType,
    details: input.details || null,
  });
}

async function maybeFlagExcessiveReferrals(
  giveawayId: string,
  referrerParticipantId: string
) {
  const admin = createAdminClient();
  const { count } = await admin
    .from("giveaway_participants")
    .select("id", { count: "exact", head: true })
    .eq("referred_by_participant_id", referrerParticipantId);
  if ((count || 0) >= 25) {
    await flagRisk({
      giveawayId,
      participantId: referrerParticipantId,
      flagType: "EXCESSIVE_REFERRALS",
      details: { referral_count: count },
    });
  }
}

export type JoinResult =
  | {
      ok: true;
      alreadyJoined: boolean;
      participantId: string;
      referralCode: string;
      entries: number;
      joinAwarded: number;
      referralAwardedToReferrer: number;
      message: string;
    }
  | { ok: false; error: string; requireLogin?: boolean };

export async function joinGiveaway(input: {
  giveawayId: string;
  referralCode?: string | null;
}): Promise<JoinResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Please sign in to enter.", requireLogin: true };
  }

  const admin = createAdminClient();
  const giveaway = await getGiveawayById(input.giveawayId);
  if (!giveaway) return { ok: false, error: "Giveaway not found." };

  const { count: announced } = await admin
    .from("giveaway_winners")
    .select("id", { count: "exact", head: true })
    .eq("giveaway_id", giveaway.id)
    .eq("publicly_announced", true);

  const state = resolvePublicState({
    status: giveaway.status,
    startAt: giveaway.start_at,
    endAt: giveaway.end_at,
    hasAnnouncedWinner: (announced || 0) > 0,
  });

  const { data: existing } = await admin
    .from("giveaway_participants")
    .select("id, referral_code")
    .eq("giveaway_id", giveaway.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const entries = await participantEntryTotal(admin, existing.id);
    return {
      ok: true,
      alreadyJoined: true,
      participantId: existing.id,
      referralCode: existing.referral_code,
      entries,
      joinAwarded: 0,
      referralAwardedToReferrer: 0,
      message: "You're already entered.",
    };
  }

  if (!canJoinGiveaway(state)) {
    return { ok: false, error: "This giveaway is not open for new entries." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { ok: false, error: "Account profile not found. Please sign in again.", requireLogin: true };
  }

  const rules = await loadRules(giveaway.id);
  const joinEntries = getRuleEntries(rules, "join");

  let referredById: string | null = null;
  const refCode = normalizeReferralCode(input.referralCode);
  if (refCode) {
    const { data: referrer } = await admin
      .from("giveaway_participants")
      .select("id, user_id")
      .eq("giveaway_id", giveaway.id)
      .ilike("referral_code", refCode)
      .maybeSingle();
    if (referrer && referrer.user_id !== user.id) {
      referredById = referrer.id;
    }
  }

  let referralCode = generateReferralCode(profile.full_name);
  let participant: { id: string; referral_code: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from("giveaway_participants")
      .insert({
        giveaway_id: giveaway.id,
        user_id: user.id,
        referral_code: referralCode,
        referred_by_participant_id: referredById,
        status: "active",
      })
      .select("id, referral_code")
      .single();

    if (!error && data) {
      participant = data;
      break;
    }

    if (error && /giveaway_participants_one_user|duplicate|unique/i.test(error.message)) {
      const { data: again } = await admin
        .from("giveaway_participants")
        .select("id, referral_code")
        .eq("giveaway_id", giveaway.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (again) {
        const entries = await participantEntryTotal(admin, again.id);
        return {
          ok: true,
          alreadyJoined: true,
          participantId: again.id,
          referralCode: again.referral_code,
          entries,
          joinAwarded: 0,
          referralAwardedToReferrer: 0,
          message: "You're already entered.",
        };
      }
    }

    if (error && /referral_code|unique/i.test(error.message)) {
      referralCode = generateReferralCode(profile.full_name);
      continue;
    }

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  if (!participant) {
    return { ok: false, error: "Could not create participation. Try again." };
  }

  let joinAwarded = 0;
  if (joinEntries > 0) {
    const { error: joinErr } = await admin.from("giveaway_entries").insert({
      giveaway_id: giveaway.id,
      participant_id: participant.id,
      source_type: "join",
      source_id: participant.id,
      entries: joinEntries,
      description: "Joined the giveaway",
    });
    if (!joinErr) joinAwarded = joinEntries;
    // unique violation = already awarded
  }

  let referralAwardedToReferrer = 0;
  if (referredById) {
    const refEntries = getRuleEntries(rules, "referral");
    if (refEntries > 0) {
      const { error: refErr } = await admin.from("giveaway_entries").insert({
        giveaway_id: giveaway.id,
        participant_id: referredById,
        source_type: "referral",
        source_id: participant.id,
        entries: refEntries,
        description: "Referral bonus — friend joined",
        metadata: { referred_user_id: user.id },
      });
      if (!refErr) {
        referralAwardedToReferrer = refEntries;
        await maybeFlagExcessiveReferrals(giveaway.id, referredById);
      }
    }
  }

  await writeGiveawayAudit({
    giveawayId: giveaway.id,
    actorId: user.id,
    action: "participant_joined",
    entity: "giveaway_participants",
    entityId: participant.id,
    metadata: { joinAwarded, referredById },
  });

  const entries = await participantEntryTotal(admin, participant.id);
  return {
    ok: true,
    alreadyJoined: false,
    participantId: participant.id,
    referralCode: participant.referral_code,
    entries,
    joinAwarded,
    referralAwardedToReferrer,
    message:
      joinAwarded > 0
        ? `You're entered! +${joinAwarded} entr${joinAwarded === 1 ? "y" : "ies"}`
        : "You're entered!",
  };
}

export async function claimWhatsAppShareReward(input: {
  giveawayId: string;
}): Promise<{ ok: true; awarded: number; message: string } | { ok: false; error: string; requireLogin?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Please sign in.", requireLogin: true };
  }

  const admin = createAdminClient();
  const giveaway = await getGiveawayById(input.giveawayId);
  if (!giveaway) return { ok: false, error: "Giveaway not found." };

  const state = resolvePublicState({
    status: giveaway.status,
    startAt: giveaway.start_at,
    endAt: giveaway.end_at,
  });
  if (state !== "live") {
    return { ok: false, error: "Sharing rewards are only available while the giveaway is live." };
  }

  const { data: participant } = await admin
    .from("giveaway_participants")
    .select("id")
    .eq("giveaway_id", giveaway.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!participant) {
    return { ok: false, error: "Join the giveaway first." };
  }

  const rules = await loadRules(giveaway.id);
  const rule = rules.find((r) => r.enabled && r.action_type === "whatsapp_share");
  const award = rule ? Number(rule.entries) : 0;
  if (award <= 0) {
    return { ok: false, error: "WhatsApp share reward is not configured." };
  }

  const cooldownH = getShareCooldownHours(rule);
  const since = new Date(Date.now() - cooldownH * 3600 * 1000).toISOString();
  const { data: recent } = await admin
    .from("giveaway_entries")
    .select("id, created_at")
    .eq("participant_id", participant.id)
    .eq("source_type", "whatsapp_share")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  if (recent && recent.length > 0) {
    return {
      ok: false,
      error: `Share reward already claimed. Try again after ${cooldownH}h.`,
    };
  }

  // Rapid action: more than 5 share claims in 24h historically wouldn't happen with cooldown,
  // but count lifetime recent for RAPID_ACTIONS across types
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: rapidCount } = await admin
    .from("giveaway_entries")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participant.id)
    .gte("created_at", dayAgo);

  if ((rapidCount || 0) >= 40) {
    await flagRisk({
      giveawayId: giveaway.id,
      participantId: participant.id,
      flagType: "RAPID_ACTIONS",
      details: { entries_last_24h: rapidCount },
    });
    return { ok: false, error: "Too many actions. Please try again later." };
  }

  const { error } = await admin.from("giveaway_entries").insert({
    giveaway_id: giveaway.id,
    participant_id: participant.id,
    source_type: "whatsapp_share",
    source_id: `share:${participant.id}:${Math.floor(Date.now() / (cooldownH * 3600 * 1000))}`,
    entries: award,
    description: "WhatsApp / share reward",
  });

  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { ok: false, error: "Share reward already claimed for this period." };
    }
    return { ok: false, error: error.message };
  }

  await writeGiveawayAudit({
    giveawayId: giveaway.id,
    actorId: user.id,
    action: "entry_awarded",
    entity: "giveaway_entries",
    metadata: { source_type: "whatsapp_share", entries: award },
  });

  return {
    ok: true,
    awarded: award,
    message: `+${award} entr${award === 1 ? "y" : "ies"} for sharing!`,
  };
}

export async function awardGiveawayEntriesForPaidOrder(orderId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id, user_id, payment_status, grand_total, status, deleted_at")
      .eq("id", orderId)
      .maybeSingle();

    if (!order?.user_id) return;
    if (order.payment_status !== "paid") return;
    if (order.deleted_at) return;
    if (order.status === "cancelled") return;

    const nowIso = new Date().toISOString();
    const { data: giveaways } = await admin
      .from("giveaways")
      .select("*")
      .eq("status", "active");

    for (const g of giveaways || []) {
      if (g.start_at && g.start_at > nowIso) continue;
      if (g.end_at && g.end_at < nowIso) continue;

      const { data: participant } = await admin
        .from("giveaway_participants")
        .select("id, status")
        .eq("giveaway_id", g.id)
        .eq("user_id", order.user_id)
        .maybeSingle();

      if (!participant || participant.status !== "active") continue;

      const rules = await loadRules(g.id);
      const rule = pickPurchaseRule(rules, Number(order.grand_total) || 0);
      if (!rule || rule.entries <= 0) continue;

      const { error } = await admin.from("giveaway_entries").insert({
        giveaway_id: g.id,
        participant_id: participant.id,
        source_type: "purchase",
        source_id: order.id,
        entries: rule.entries,
        description: `Purchase reward (order ₹${Number(order.grand_total || 0).toLocaleString("en-IN")})`,
        metadata: {
          order_id: order.id,
          grand_total: order.grand_total,
          rule_id: rule.id,
        },
      });

      if (!error) {
        await writeGiveawayAudit({
          giveawayId: g.id,
          actorId: order.user_id,
          action: "entry_awarded",
          entity: "orders",
          entityId: order.id,
          metadata: { source_type: "purchase", entries: rule.entries },
        });
      }
    }
  } catch (e) {
    console.warn("awardGiveawayEntriesForPaidOrder", e);
  }
}

export async function reverseGiveawayEntriesForOrder(orderId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: purchases } = await admin
      .from("giveaway_entries")
      .select("id, giveaway_id, participant_id, entries, source_id")
      .eq("source_type", "purchase")
      .eq("source_id", orderId);

    for (const row of purchases || []) {
      const amt = Number(row.entries) || 0;
      if (amt <= 0) continue;

      const { error } = await admin.from("giveaway_entries").insert({
        giveaway_id: row.giveaway_id,
        participant_id: row.participant_id,
        source_type: "refund_reversal",
        source_id: orderId,
        entries: -amt,
        description: "Purchase reward reversed (cancel/refund)",
        metadata: { original_entry_id: row.id },
      });

      if (!error) {
        await writeGiveawayAudit({
          giveawayId: row.giveaway_id,
          action: "entry_reversed",
          entity: "orders",
          entityId: orderId,
          metadata: { entries: -amt },
        });
      }
    }
  } catch (e) {
    console.warn("reverseGiveawayEntriesForOrder", e);
  }
}

export async function getLeaderboard(input: {
  giveawayId: string;
  page?: number;
  limit?: number;
  currentUserId?: string | null;
}): Promise<{
  rows: LeaderboardRow[];
  page: number;
  limit: number;
  totalParticipants: number;
}> {
  const admin = createAdminClient();
  const page = Math.max(1, Number(input.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(input.limit) || 20));
  const offset = (page - 1) * limit;

  const { count } = await admin
    .from("giveaway_participants")
    .select("id", { count: "exact", head: true })
    .eq("giveaway_id", input.giveawayId)
    .eq("status", "active");

  const totalParticipants = count || 0;

  // Aggregate via RPC-less approach: fetch participants page of ranked IDs using raw SQL via rpc if available;
  // Fallback: load entry sums in SQL using a view-style query through PostgREST is limited —
  // Use two-step: get all participant ids with joined_at, get sums grouped — for scale use a single query via admin.rpc.
  // Practical approach for Supabase without custom RPC: use from with select of entries nested.

  const { data: parts } = await admin
    .from("giveaway_participants")
    .select(
      `
      id,
      user_id,
      joined_at,
      profiles:user_id ( full_name, email ),
      entries:giveaway_entries ( entries )
    `
    )
    .eq("giveaway_id", input.giveawayId)
    .eq("status", "active");

  type Agg = {
    id: string;
    user_id: string;
    joined_at: string;
    total: number;
    displayName: string;
  };

  const aggregated: Agg[] = (parts || []).map((p: any) => {
    const total = (p.entries || []).reduce(
      (s: number, e: any) => s + (Number(e.entries) || 0),
      0
    );
    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    return {
      id: p.id,
      user_id: p.user_id,
      joined_at: p.joined_at,
      total,
      displayName: safeDisplayName(profile?.full_name, profile?.email),
    };
  });

  aggregated.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
  });

  const slice = aggregated.slice(offset, offset + limit);
  const rows: LeaderboardRow[] = slice.map((row, i) => ({
    rank: offset + i + 1,
    displayName: row.displayName,
    entries: row.total,
    isCurrentUser: Boolean(input.currentUserId && row.user_id === input.currentUserId),
    participantId: row.id,
  }));

  return { rows, page, limit, totalParticipants };
}

/**
 * Efficient-ish my-position: aggregates only current participant + compare counts.
 * For very large campaigns, replace with SQL window functions via a DB function.
 */
export async function getMyPosition(giveawayId: string): Promise<MyPosition> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { count } = await admin
    .from("giveaway_participants")
    .select("id", { count: "exact", head: true })
    .eq("giveaway_id", giveawayId)
    .eq("status", "active");
  const totalParticipants = count || 0;

  if (!user?.id) {
    return {
      participating: false,
      rank: null,
      entries: 0,
      entriesToNextRank: null,
      totalParticipants,
    };
  }

  const { data: me } = await admin
    .from("giveaway_participants")
    .select("id, referral_code, joined_at")
    .eq("giveaway_id", giveawayId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me) {
    return {
      participating: false,
      rank: null,
      entries: 0,
      entriesToNextRank: null,
      totalParticipants,
    };
  }

  const myEntries = await participantEntryTotal(admin, me.id);

  const full = await getLeaderboard({
    giveawayId,
    page: 1,
    limit: Math.min(10000, Math.max(50, totalParticipants || 50)),
    currentUserId: user.id,
  });

  const mine = full.rows.find((r) => r.isCurrentUser);
  const rank = mine?.rank ?? null;

  let nextHigher: number | null = null;
  if (rank && rank > 1) {
    const above = full.rows.find((r) => r.rank === rank - 1);
    nextHigher = above?.entries ?? null;
  }

  return {
    participating: true,
    participantId: me.id,
    referralCode: me.referral_code,
    rank,
    entries: myEntries,
    entriesToNextRank: entriesToNextRank({
      myEntries,
      nextHigherEntries: nextHigher,
    }),
    percentile:
      rank && totalParticipants
        ? Math.round(((totalParticipants - rank + 1) / totalParticipants) * 100)
        : null,
    totalParticipants,
  };
}

export async function adminAdjustEntries(input: {
  giveawayId: string;
  participantId: string;
  entries: number;
  reason: string;
  actorId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const delta = Math.trunc(Number(input.entries) || 0);
  if (delta === 0) return { ok: false, error: "Entries delta cannot be zero." };
  const reason = String(input.reason || "").trim();
  if (reason.length < 3) return { ok: false, error: "Reason is required." };

  const admin = createAdminClient();
  const { data: p } = await admin
    .from("giveaway_participants")
    .select("id")
    .eq("id", input.participantId)
    .eq("giveaway_id", input.giveawayId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Participant not found." };

  const { error } = await admin.from("giveaway_entries").insert({
    giveaway_id: input.giveawayId,
    participant_id: input.participantId,
    source_type: "admin_adjustment",
    source_id: `adj:${Date.now()}`,
    entries: delta,
    description: reason,
    metadata: { reason, actor_id: input.actorId },
  });
  if (error) return { ok: false, error: error.message };

  await writeGiveawayAudit({
    giveawayId: input.giveawayId,
    actorId: input.actorId,
    action: "admin_adjustment",
    entity: "giveaway_participants",
    entityId: input.participantId,
    metadata: { entries: delta, reason },
  });

  return { ok: true };
}

export async function executeGiveawayDraw(input: {
  giveawayId: string;
  actorId: string;
}): Promise<
  | { ok: true; winners: { displayName: string; participantId: string }[] }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const giveaway = await getGiveawayById(input.giveawayId);
  if (!giveaway) return { ok: false, error: "Giveaway not found." };

  const endedByTime =
    Boolean(giveaway.end_at) && new Date(giveaway.end_at!).getTime() < Date.now();
  const canDraw =
    giveaway.status === "completed" ||
    (giveaway.status === "active" && endedByTime);

  if (!canDraw) {
    return {
      ok: false,
      error: "End the giveaway (status completed) before drawing winners.",
    };
  }

  const { data: existingDraw } = await admin
    .from("giveaway_draws")
    .select("id")
    .eq("giveaway_id", giveaway.id)
    .maybeSingle();
  if (existingDraw) {
    return { ok: false, error: "A draw has already been executed for this giveaway." };
  }

  // Ensure status completed
  if (giveaway.status !== "completed") {
    await admin
      .from("giveaways")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", giveaway.id);
  }

  const { data: parts } = await admin
    .from("giveaway_participants")
    .select(
      `
      id,
      user_id,
      joined_at,
      status,
      profiles:user_id ( full_name, email ),
      entries:giveaway_entries ( entries )
    `
    )
    .eq("giveaway_id", giveaway.id)
    .eq("status", "active");

  const eligible = (parts || [])
    .map((p: any) => {
      const total = (p.entries || []).reduce(
        (s: number, e: any) => s + (Number(e.entries) || 0),
        0
      );
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      return {
        id: p.id,
        user_id: p.user_id,
        total,
        displayName: safeDisplayName(profile?.full_name, profile?.email),
        email: profile?.email as string | undefined,
      };
    })
    .filter((p) => p.total > 0);

  if (!eligible.length) {
    return { ok: false, error: "No eligible participants with entries." };
  }

  const maxWinners = Math.min(giveaway.max_winners, eligible.length);
  const remaining = [...eligible];
  const winners: typeof eligible = [];

  for (let w = 0; w < maxWinners; w++) {
    const weights = remaining.map((r) => r.total);
    const idx = weightedPickIndex(weights, (max) => randomInt(max));
    winners.push(remaining[idx]);
    remaining.splice(idx, 1);
  }

  const totalEntries = eligible.reduce((s, e) => s + e.total, 0);
  const seedNote = `crypto.randomInt weighted; at=${new Date().toISOString()}`;

  const { data: draw, error: drawErr } = await admin
    .from("giveaway_draws")
    .insert({
      giveaway_id: giveaway.id,
      total_eligible_entries: totalEntries,
      eligible_participant_count: eligible.length,
      algorithm: "weighted_crypto_random",
      algorithm_seed: seedNote,
      snapshot: {
        participants: eligible.map((e) => ({
          participant_id: e.id,
          entries: e.total,
        })),
      },
      executed_by: input.actorId,
    })
    .select("id")
    .single();

  if (drawErr || !draw) {
    if (/unique|duplicate/i.test(drawErr?.message || "")) {
      return { ok: false, error: "Draw already executed." };
    }
    return { ok: false, error: drawErr?.message || "Draw failed." };
  }

  const winnerRows = winners.map((w) => ({
    giveaway_id: giveaway.id,
    draw_id: draw.id,
    participant_id: w.id,
    user_id: w.user_id,
    display_name: w.displayName,
    prize_title: giveaway.prize_title,
    status: "selected",
    publicly_announced: false,
  }));

  const { error: winErr } = await admin.from("giveaway_winners").insert(winnerRows);
  if (winErr) return { ok: false, error: winErr.message };

  await writeGiveawayAudit({
    giveawayId: giveaway.id,
    actorId: input.actorId,
    action: "draw_executed",
    entity: "giveaway_draws",
    entityId: draw.id,
    metadata: {
      winners: winners.map((w) => w.id),
      total_eligible_entries: totalEntries,
    },
  });

  return {
    ok: true,
    winners: winners.map((w) => ({
      displayName: w.displayName,
      participantId: w.id,
    })),
  };
}

export async function listPublicPreviousWinners(limit = 12) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("giveaway_previous_winners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("announced_at", { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getGiveawayRules(giveawayId: string) {
  return loadRules(giveawayId);
}
