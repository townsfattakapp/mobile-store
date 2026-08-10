import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getLeaderboard } from "@/lib/giveaway/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await getLeaderboard({
      giveawayId: id,
      page,
      limit,
      currentUserId: user?.id,
    });

    return NextResponse.json({
      ...result,
      leaderboard: result.rows.map((r) => ({
        rank: r.rank,
        display_name: r.displayName,
        entries: r.entries,
        is_current_user: r.isCurrentUser,
      })),
      total_participants: result.totalParticipants,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}
