import { NextResponse } from "next/server";
import { getMyPosition } from "@/lib/giveaway/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const position = await getMyPosition(id);
    return NextResponse.json({
      participating: position.participating,
      participant_id: position.participantId,
      referral_code: position.referralCode,
      rank: position.rank,
      entries: position.entries,
      entries_to_next_rank: position.entriesToNextRank,
      percentile: position.percentile,
      total_participants: position.totalParticipants,
      participantId: position.participantId,
      referralCode: position.referralCode,
      entriesToNextRank: position.entriesToNextRank,
      totalParticipants: position.totalParticipants,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load position" },
      { status: 500 }
    );
  }
}
