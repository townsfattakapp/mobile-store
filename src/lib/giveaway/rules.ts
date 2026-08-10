import type { GiveawayEntryRule, PublicGiveawayState, GiveawayStatus } from "./types";

export function resolvePublicState(input: {
  status: GiveawayStatus;
  startAt?: string | null;
  endAt?: string | null;
  hasAnnouncedWinner?: boolean;
  now?: Date;
}): PublicGiveawayState {
  if (input.status === "cancelled") return "cancelled";
  if (input.hasAnnouncedWinner || input.status === "completed") {
    return input.hasAnnouncedWinner ? "winner_announced" : "ended";
  }
  if (input.status === "paused") return "paused";
  if (input.status === "draft") return "coming_soon";

  const now = input.now || new Date();
  if (input.startAt && new Date(input.startAt) > now) return "coming_soon";
  if (input.endAt && new Date(input.endAt) < now) return "ended";
  if (input.status === "scheduled") {
    if (input.startAt && new Date(input.startAt) <= now) return "live";
    return "coming_soon";
  }
  if (input.status === "active") return "live";
  return "ended";
}

export function canJoinGiveaway(state: PublicGiveawayState): boolean {
  return state === "live";
}

/** Pick highest matching purchase tier (by min_order_amount). */
export function pickPurchaseRule(
  rules: GiveawayEntryRule[],
  orderTotal: number
): GiveawayEntryRule | null {
  const total = Number(orderTotal) || 0;
  const purchaseRules = rules
    .filter((r) => r.enabled && r.action_type === "purchase" && r.entries > 0)
    .filter((r) => {
      const min = r.min_order_amount == null ? 0 : Number(r.min_order_amount);
      const max =
        r.max_order_amount == null ? Number.POSITIVE_INFINITY : Number(r.max_order_amount);
      return total >= min && total <= max;
    })
    .sort((a, b) => Number(b.min_order_amount || 0) - Number(a.min_order_amount || 0));

  return purchaseRules[0] || null;
}

export function getRuleEntries(
  rules: GiveawayEntryRule[],
  actionType: string
): number {
  const rule = rules.find((r) => r.enabled && r.action_type === actionType);
  return rule ? Number(rule.entries) || 0 : 0;
}

export function getShareCooldownHours(rule: GiveawayEntryRule | undefined): number {
  const raw = rule?.configuration?.cooldown_hours;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return 24;
}

/** Rank helper: how many have strictly better (entries, joinedAt) than me. */
export function computeRankFromBetterCount(betterCount: number): number {
  return betterCount + 1;
}

export function entriesToNextRank(opts: {
  myEntries: number;
  nextHigherEntries: number | null;
}): number | null {
  if (opts.nextHigherEntries == null) return null;
  if (opts.nextHigherEntries <= opts.myEntries) return null;
  return opts.nextHigherEntries - opts.myEntries;
}

/** Weighted raffle pick: weights[i] chances for index i. */
export function weightedPickIndex(
  weights: number[],
  randomInt: (maxExclusive: number) => number
): number {
  const total = weights.reduce((s, w) => s + Math.max(0, Math.floor(w)), 0);
  if (total <= 0) throw new Error("No eligible entries for draw");
  let ticket = randomInt(total);
  for (let i = 0; i < weights.length; i++) {
    const w = Math.max(0, Math.floor(weights[i]));
    if (ticket < w) return i;
    ticket -= w;
  }
  return weights.length - 1;
}
