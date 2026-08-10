"use server";

import {
  claimWhatsAppShareReward,
  joinGiveaway,
} from "@/lib/giveaway/server";

export async function joinGiveawayAction(input: {
  giveawayId: string;
  referralCode?: string | null;
}) {
  return joinGiveaway(input);
}

export async function claimShareRewardAction(input: { giveawayId: string }) {
  return claimWhatsAppShareReward(input);
}
