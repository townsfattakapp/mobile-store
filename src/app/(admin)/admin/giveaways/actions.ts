"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  adminAdjustEntries,
  executeGiveawayDraw,
  writeGiveawayAudit,
} from "@/lib/giveaway/server";
import { sendCustomerEmail } from "@/lib/notify/email";
import { GIVEAWAY_STATUSES, type GiveawayStatus } from "@/lib/giveaway/types";
import { safeDisplayName } from "@/lib/giveaway/displayName";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { error: "Unauthorized." as const };
  }

  return { error: null, supabase, user } as const;
}

function slugify(raw: string) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export type GiveawayFormInput = {
  id?: string;
  title: string;
  slug?: string;
  description?: string;
  prize_title: string;
  prize_description?: string;
  prize_image?: string;
  terms_and_conditions?: string;
  start_at?: string | null;
  end_at?: string | null;
  status?: GiveawayStatus;
  max_winners?: number;
  rules?: {
    action_type: string;
    entries: number;
    min_order_amount?: number | null;
    max_order_amount?: number | null;
    enabled?: boolean;
    configuration?: Record<string, unknown>;
  }[];
};

function parseDate(v?: string | null) {
  if (!v || !String(v).trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function listGiveawaysAction() {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error, giveaways: [] as any[], metrics: null };
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("giveaways")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (/giveaways|relation|schema cache|does not exist/i.test(error.message)) {
      return {
        error:
          "Giveaway tables missing. Run supabase/migrations/APPLY_NOW_giveaways.sql",
        giveaways: [],
        metrics: null,
      };
    }
    return { error: error.message, giveaways: [], metrics: null };
  }

  const giveaways = data || [];
  const ids = giveaways.map((g) => g.id);

  let participantCount = 0;
  let entrySum = 0;
  let referralCount = 0;
  let purchaseRevenue = 0;

  if (ids.length) {
    const { count: pc } = await admin
      .from("giveaway_participants")
      .select("id", { count: "exact", head: true })
      .in("giveaway_id", ids);
    participantCount = pc || 0;

    const { data: entries } = await admin
      .from("giveaway_entries")
      .select("entries, source_type, metadata, giveaway_id")
      .in("giveaway_id", ids);
    for (const e of entries || []) {
      entrySum += Number(e.entries) || 0;
      if (e.source_type === "referral") referralCount += 1;
      if (e.source_type === "purchase" && (Number(e.entries) || 0) > 0) {
        purchaseRevenue += Number((e.metadata as any)?.grand_total) || 0;
      }
    }
  }

  const metrics = {
    totalGiveaways: giveaways.length,
    activeGiveaways: giveaways.filter((g) => g.status === "active").length,
    participants: participantCount,
    totalEntries: entrySum,
    referrals: referralCount,
    purchaseRevenue,
  };

  return { giveaways, metrics, error: null };
}

export async function upsertGiveawayAction(input: GiveawayFormInput) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { user } = auth;
  const admin = createAdminClient();

  const title = String(input.title || "").trim();
  const prizeTitle = String(input.prize_title || "").trim();
  if (!title || !prizeTitle) return { error: "Title and prize title are required." };

  const slug = slugify(input.slug || title);
  if (!slug) return { error: "Invalid slug." };

  const status = (input.status || "draft") as GiveawayStatus;
  if (!GIVEAWAY_STATUSES.includes(status)) return { error: "Invalid status." };

  const startAt = parseDate(input.start_at);
  const endAt = parseDate(input.end_at);
  if (startAt && endAt && new Date(startAt) > new Date(endAt)) {
    return { error: "End date must be after start date." };
  }

  const payload = {
    title,
    slug,
    description: String(input.description || "").trim() || null,
    prize_title: prizeTitle,
    prize_description: String(input.prize_description || "").trim() || null,
    prize_image: String(input.prize_image || "").trim() || null,
    terms_and_conditions: String(input.terms_and_conditions || "").trim() || null,
    start_at: startAt,
    end_at: endAt,
    status,
    max_winners: Math.max(1, Math.floor(Number(input.max_winners) || 1)),
    updated_at: new Date().toISOString(),
  };

  let giveawayId = input.id;

  if (input.id) {
    const { error } = await admin.from("giveaways").update(payload).eq("id", input.id);
    if (error) {
      if (/unique|duplicate/i.test(error.message)) return { error: "Slug already in use." };
      return { error: error.message };
    }
    await writeGiveawayAudit({
      giveawayId: input.id,
      actorId: user.id,
      action: "giveaway_edited",
      entity: "giveaways",
      entityId: input.id,
    });
  } else {
    const { data, error } = await admin
      .from("giveaways")
      .insert({ ...payload, created_by: user.id })
      .select("id")
      .single();
    if (error) {
      if (/unique|duplicate/i.test(error.message)) return { error: "Slug already in use." };
      if (/giveaways|relation|does not exist/i.test(error.message)) {
        return {
          error:
            "Giveaway tables missing. Run supabase/migrations/APPLY_NOW_giveaways.sql",
        };
      }
      return { error: error.message };
    }
    giveawayId = data.id;
    await writeGiveawayAudit({
      giveawayId,
      actorId: user.id,
      action: "giveaway_created",
      entity: "giveaways",
      entityId: giveawayId,
    });
  }

  if (giveawayId && Array.isArray(input.rules)) {
    await admin.from("giveaway_entry_rules").delete().eq("giveaway_id", giveawayId);
    const rows = input.rules
      .filter((r) => r.action_type && Number(r.entries) !== 0)
      .map((r) => ({
        giveaway_id: giveawayId,
        action_type: r.action_type,
        entries: Math.trunc(Number(r.entries)),
        min_order_amount:
          r.min_order_amount == null || r.min_order_amount === ("" as any)
            ? null
            : Number(r.min_order_amount),
        max_order_amount:
          r.max_order_amount == null || r.max_order_amount === ("" as any)
            ? null
            : Number(r.max_order_amount),
        enabled: r.enabled !== false,
        configuration: r.configuration || {},
      }));
    if (rows.length) {
      const { error: rulesErr } = await admin.from("giveaway_entry_rules").insert(rows);
      if (rulesErr) return { error: "Saved giveaway but rules failed: " + rulesErr.message };
    }
  }

  revalidatePath("/admin/giveaways");
  if (giveawayId) revalidatePath(`/admin/giveaways/${giveawayId}`);
  return { success: true, id: giveawayId };
}

export async function setGiveawayStatusAction(id: string, status: GiveawayStatus) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  if (!GIVEAWAY_STATUSES.includes(status)) return { error: "Invalid status." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("giveaways")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await writeGiveawayAudit({
    giveawayId: id,
    actorId: auth.user.id,
    action: `giveaway_${status}`,
    entity: "giveaways",
    entityId: id,
  });

  revalidatePath("/admin/giveaways");
  revalidatePath(`/admin/giveaways/${id}`);
  return { success: true };
}

export async function getGiveawayDetailAction(id: string) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };

  const admin = createAdminClient();
  const { data: giveaway, error } = await admin
    .from("giveaways")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !giveaway) return { error: error?.message || "Not found." };

  const [{ data: rules }, { data: participants }, { data: entries }, { data: flags }, { data: audit }, { data: draws }, { data: winners }] =
    await Promise.all([
      admin.from("giveaway_entry_rules").select("*").eq("giveaway_id", id),
      admin
        .from("giveaway_participants")
        .select(
          `id, user_id, referral_code, referred_by_participant_id, joined_at, status,
           profiles:user_id ( email, full_name, phone_number )`
        )
        .eq("giveaway_id", id)
        .order("joined_at", { ascending: true })
        .limit(500),
      admin
        .from("giveaway_entries")
        .select("*")
        .eq("giveaway_id", id)
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("giveaway_risk_flags")
        .select("*")
        .eq("giveaway_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("giveaway_audit_log")
        .select("*")
        .eq("giveaway_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      admin.from("giveaway_draws").select("*").eq("giveaway_id", id).maybeSingle(),
      admin.from("giveaway_winners").select("*").eq("giveaway_id", id),
    ]);

  const entryByParticipant = new Map<string, number>();
  const referralCount = new Map<string, number>();
  const purchaseContribution = new Map<string, number>();
  const sourceDist: Record<string, number> = {};

  for (const e of entries || []) {
    entryByParticipant.set(
      e.participant_id,
      (entryByParticipant.get(e.participant_id) || 0) + (Number(e.entries) || 0)
    );
    sourceDist[e.source_type] =
      (sourceDist[e.source_type] || 0) + Math.max(0, Number(e.entries) || 0);
    if (e.source_type === "referral") {
      // referrer is participant_id on referral rows
      referralCount.set(
        e.participant_id,
        (referralCount.get(e.participant_id) || 0) + 1
      );
    }
    if (e.source_type === "purchase" && (Number(e.entries) || 0) > 0) {
      purchaseContribution.set(
        e.participant_id,
        (purchaseContribution.get(e.participant_id) || 0) +
          (Number((e.metadata as any)?.grand_total) || 0)
      );
    }
  }

  const ranked = [...(participants || [])]
    .map((p: any) => ({
      ...p,
      entries: entryByParticipant.get(p.id) || 0,
      referral_count: referralCount.get(p.id) || 0,
      purchase_contribution: purchaseContribution.get(p.id) || 0,
    }))
    .sort((a, b) => {
      if (b.entries !== a.entries) return b.entries - a.entries;
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    })
    .map((p, i) => ({ ...p, rank: i + 1 }));

  return {
    giveaway,
    rules: rules || [],
    participants: ranked,
    entries: entries || [],
    flags: flags || [],
    audit: audit || [],
    draw: draws || null,
    winners: winners || [],
    analytics: {
      participants: ranked.length,
      totalEntries: [...entryByParticipant.values()].reduce((s, n) => s + n, 0),
      referrals: [...referralCount.values()].reduce((s, n) => s + n, 0),
      sourceDistribution: sourceDist,
      topReferrers: ranked
        .filter((p) => p.referral_count > 0)
        .sort((a, b) => b.referral_count - a.referral_count)
        .slice(0, 10),
      topParticipants: ranked.slice(0, 10),
    },
    error: null,
  };
}

export async function adjustEntriesAction(input: {
  giveawayId: string;
  participantId: string;
  entries: number;
  reason: string;
}) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const res = await adminAdjustEntries({
    ...input,
    actorId: auth.user.id,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath(`/admin/giveaways/${input.giveawayId}`);
  return { success: true };
}

export async function runDrawAction(giveawayId: string) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const res = await executeGiveawayDraw({
    giveawayId,
    actorId: auth.user.id,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath(`/admin/giveaways/${giveawayId}`);
  return { success: true, winners: res.winners };
}

export async function announceWinnersAction(giveawayId: string) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const admin = createAdminClient();

  const { data: winners } = await admin
    .from("giveaway_winners")
    .select("*")
    .eq("giveaway_id", giveawayId);

  if (!winners?.length) return { error: "No winners to announce." };

  const { data: giveaway } = await admin
    .from("giveaways")
    .select("title, prize_title, slug")
    .eq("id", giveawayId)
    .maybeSingle();

  await admin
    .from("giveaway_winners")
    .update({ status: "announced", publicly_announced: true })
    .eq("giveaway_id", giveawayId);

  for (const w of winners) {
    await admin.from("giveaway_previous_winners").insert({
      giveaway_id: giveawayId,
      prize_title: w.prize_title || giveaway?.prize_title || "Prize",
      display_name: w.display_name,
      announced_at: new Date().toISOString(),
    });

    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", w.user_id)
      .maybeSingle();

    if (profile?.email) {
      await sendCustomerEmail({
        to: profile.email,
        subject: `You're a winner — ${giveaway?.prize_title || "Giveaway"}`,
        text: `Congratulations ${safeDisplayName(profile.full_name, profile.email)}!\n\nYou won: ${w.prize_title || giveaway?.prize_title}\nGiveaway: ${giveaway?.title || ""}\n\nOur team will contact you shortly.`,
        html: `<p>Congratulations <strong>${safeDisplayName(profile.full_name, profile.email)}</strong>!</p><p>You won: <strong>${w.prize_title || giveaway?.prize_title}</strong></p><p>Giveaway: ${giveaway?.title || ""}</p><p>Our team will contact you shortly.</p>`,
      });
      await admin
        .from("giveaway_winners")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", w.id);
    }
  }

  await writeGiveawayAudit({
    giveawayId,
    actorId: auth.user.id,
    action: "winner_announced",
    entity: "giveaway_winners",
  });

  revalidatePath(`/admin/giveaways/${giveawayId}`);
  revalidatePath(`/giveaway/${giveaway?.slug || ""}`);
  return { success: true };
}

export async function exportParticipantsCsvAction(giveawayId: string) {
  const detail = await getGiveawayDetailAction(giveawayId);
  if (detail.error) return { error: detail.error };

  const header = [
    "rank",
    "full_name",
    "email",
    "joined_at",
    "entries",
    "referral_code",
    "referral_count",
    "purchase_contribution",
    "status",
  ];
  const lines = [header.join(",")];
  for (const p of detail.participants || []) {
    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    const cells = [
      p.rank,
      JSON.stringify(profile?.full_name || ""),
      JSON.stringify(profile?.email || ""),
      p.joined_at,
      p.entries,
      p.referral_code,
      p.referral_count,
      p.purchase_contribution,
      p.status,
    ];
    lines.push(cells.join(","));
  }
  return { csv: lines.join("\n"), success: true };
}

export async function resolveRiskFlagAction(flagId: string, giveawayId: string, status: "resolved" | "dismissed") {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const admin = createAdminClient();
  const { error } = await admin
    .from("giveaway_risk_flags")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: auth.user.id,
    })
    .eq("id", flagId);
  if (error) return { error: error.message };
  await writeGiveawayAudit({
    giveawayId,
    actorId: auth.user.id,
    action: "risk_flag_" + status,
    entity: "giveaway_risk_flags",
    entityId: flagId,
  });
  revalidatePath(`/admin/giveaways/${giveawayId}`);
  return { success: true };
}
