export const GIVEAWAY_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;

export type GiveawayStatus = (typeof GIVEAWAY_STATUSES)[number];

export const ENTRY_SOURCE_TYPES = [
  "join",
  "referral",
  "whatsapp_share",
  "social_action",
  "purchase",
  "bonus",
  "admin_adjustment",
  "refund_reversal",
] as const;

export type EntrySourceType = (typeof ENTRY_SOURCE_TYPES)[number];

export const ENTRY_ACTION_TYPES = [
  "join",
  "referral",
  "whatsapp_share",
  "social_action",
  "purchase",
  "bonus",
  "admin_adjustment",
] as const;

export type EntryActionType = (typeof ENTRY_ACTION_TYPES)[number];

export type GiveawayRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  prize_title: string;
  prize_description: string | null;
  prize_image: string | null;
  terms_and_conditions: string | null;
  start_at: string | null;
  end_at: string | null;
  status: GiveawayStatus;
  max_winners: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GiveawayEntryRule = {
  id: string;
  giveaway_id: string;
  action_type: EntryActionType;
  entries: number;
  min_order_amount: number | null;
  max_order_amount: number | null;
  enabled: boolean;
  configuration: Record<string, unknown> | null;
};

export type PublicGiveawayState =
  | "coming_soon"
  | "live"
  | "paused"
  | "ended"
  | "winner_announced"
  | "cancelled";

export type MyPosition = {
  participating: boolean;
  participantId?: string;
  referralCode?: string;
  rank: number | null;
  entries: number;
  entriesToNextRank: number | null;
  percentile?: number | null;
  totalParticipants: number;
};

export type LeaderboardRow = {
  rank: number;
  displayName: string;
  entries: number;
  isCurrentUser: boolean;
  participantId: string;
};
