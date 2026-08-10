import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canJoinGiveaway,
  computeRankFromBetterCount,
  entriesToNextRank,
  getRuleEntries,
  getShareCooldownHours,
  pickPurchaseRule,
  resolvePublicState,
  weightedPickIndex,
} from "./rules";
import { safeDisplayName } from "./displayName";
import { normalizeReferralCode } from "./referralCode";
import type { GiveawayEntryRule } from "./types";

describe("resolvePublicState", () => {
  it("detects live vs coming soon vs cancelled", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    assert.equal(
      resolvePublicState({
        status: "active",
        startAt: "2026-05-01T00:00:00Z",
        endAt: "2026-07-01T00:00:00Z",
        now,
      }),
      "live"
    );
    assert.equal(
      resolvePublicState({
        status: "scheduled",
        startAt: "2026-08-01T00:00:00Z",
        endAt: "2026-09-01T00:00:00Z",
        now,
      }),
      "coming_soon"
    );
    assert.equal(resolvePublicState({ status: "cancelled", now }), "cancelled");
    assert.equal(
      resolvePublicState({
        status: "completed",
        hasAnnouncedWinner: true,
        now,
      }),
      "winner_announced"
    );
  });
});

describe("canJoinGiveaway", () => {
  it("only allows live", () => {
    assert.equal(canJoinGiveaway("live"), true);
    assert.equal(canJoinGiveaway("paused"), false);
    assert.equal(canJoinGiveaway("ended"), false);
  });
});

describe("pickPurchaseRule", () => {
  const rules: GiveawayEntryRule[] = [
    {
      id: "a",
      giveaway_id: "g",
      action_type: "purchase",
      entries: 5,
      min_order_amount: 20000,
      max_order_amount: null,
      enabled: true,
      configuration: {},
    },
    {
      id: "b",
      giveaway_id: "g",
      action_type: "purchase",
      entries: 10,
      min_order_amount: 50000,
      max_order_amount: null,
      enabled: true,
      configuration: {},
    },
  ];

  it("picks highest matching tier", () => {
    assert.equal(pickPurchaseRule(rules, 25000)?.entries, 5);
    assert.equal(pickPurchaseRule(rules, 50000)?.entries, 10);
    assert.equal(pickPurchaseRule(rules, 10000), null);
  });
});

describe("getRuleEntries", () => {
  it("reads join entries", () => {
    const rules: GiveawayEntryRule[] = [
      {
        id: "1",
        giveaway_id: "g",
        action_type: "join",
        entries: 1,
        min_order_amount: null,
        max_order_amount: null,
        enabled: true,
        configuration: {},
      },
    ];
    assert.equal(getRuleEntries(rules, "join"), 1);
    assert.equal(getRuleEntries(rules, "referral"), 0);
  });
});

describe("share cooldown", () => {
  it("defaults to 24h", () => {
    assert.equal(getShareCooldownHours(undefined), 24);
    assert.equal(
      getShareCooldownHours({
        id: "1",
        giveaway_id: "g",
        action_type: "whatsapp_share",
        entries: 1,
        min_order_amount: null,
        max_order_amount: null,
        enabled: true,
        configuration: { cooldown_hours: 12 },
      }),
      12
    );
  });
});

describe("ranking helpers", () => {
  it("computes rank and entries to next", () => {
    assert.equal(computeRankFromBetterCount(11), 12);
    assert.equal(
      entriesToNextRank({ myEntries: 18, nextHigherEntries: 21 }),
      3
    );
    assert.equal(entriesToNextRank({ myEntries: 50, nextHigherEntries: null }), null);
  });
});

describe("weightedPickIndex", () => {
  it("respects weights deterministically with stub RNG", () => {
    // weights [10, 2] — tickets 0..11
    assert.equal(
      weightedPickIndex([10, 2], () => 0),
      0
    );
    assert.equal(
      weightedPickIndex([10, 2], () => 9),
      0
    );
    assert.equal(
      weightedPickIndex([10, 2], () => 10),
      1
    );
  });

  it("throws when no entries", () => {
    assert.throws(() => weightedPickIndex([0, 0], () => 0));
  });
});

describe("safeDisplayName", () => {
  it("masks names safely", () => {
    assert.equal(safeDisplayName("Rahul Sharma"), "Rahul S.");
    assert.match(safeDisplayName(null, "amit@example.com"), /A/);
  });
});

describe("referral code normalize", () => {
  it("uppercases", () => {
    assert.equal(normalizeReferralCode(" rahul82 "), "RAHUL82");
  });
});

describe("refund reversal netting mental model", () => {
  it("nets purchase + reversal", () => {
    const ledger = [
      { source_type: "purchase", entries: 5 },
      { source_type: "refund_reversal", entries: -5 },
    ];
    const total = ledger.reduce((s, r) => s + r.entries, 0);
    assert.equal(total, 0);
  });
});
