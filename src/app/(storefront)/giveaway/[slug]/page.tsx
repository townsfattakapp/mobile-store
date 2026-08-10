import { createClient } from "@/utils/supabase/server";
import {
  getGiveawayBySlug,
  getGiveawayRules,
  getLeaderboard,
  getMyPosition,
  listPublicPreviousWinners,
} from "@/lib/giveaway/server";
import { resolvePublicState } from "@/lib/giveaway/rules";
import { notFound } from "next/navigation";
import GiveawayClient from "./GiveawayClient";

export default async function GiveawayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string; autojoin?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  let giveaway;
  try {
    giveaway = await getGiveawayBySlug(slug);
  } catch (e: any) {
    return (
      <div className="ms-page px-5 py-16 text-center">
        <h1 className="ms-display ms-display--md">Giveaway unavailable</h1>
        <p className="ms-lede mt-3">{e?.message || "Please try again later."}</p>
      </div>
    );
  }

  if (!giveaway || giveaway.status === "draft") notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [rules, board, position, previous] = await Promise.all([
    getGiveawayRules(giveaway.id),
    getLeaderboard({
      giveawayId: giveaway.id,
      page: 1,
      limit: 10,
      currentUserId: user?.id,
    }),
    getMyPosition(giveaway.id),
    listPublicPreviousWinners(8),
  ]);

  const { createAdminClient } = await import("@/utils/supabase/admin");
  const admin = createAdminClient();
  const { count: announced } = await admin
    .from("giveaway_winners")
    .select("id", { count: "exact", head: true })
    .eq("giveaway_id", giveaway.id)
    .eq("publicly_announced", true);

  const { data: announcedWinners } = await admin
    .from("giveaway_winners")
    .select("display_name, prize_title, created_at")
    .eq("giveaway_id", giveaway.id)
    .eq("publicly_announced", true)
    .limit(5);

  const publicState = resolvePublicState({
    status: giveaway.status,
    startAt: giveaway.start_at,
    endAt: giveaway.end_at,
    hasAnnouncedWinner: (announced || 0) > 0,
  });

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.mahadevmobile.in";

  return (
    <GiveawayClient
      giveaway={giveaway}
      rules={rules.filter((r) => r.enabled)}
      publicState={publicState}
      leaderboard={board.rows}
      totalParticipants={board.totalParticipants}
      position={position}
      isLoggedIn={Boolean(user)}
      referralFromUrl={sp.ref || null}
      autojoin={sp.autojoin === "1"}
      previousWinners={previous}
      announcedWinners={announcedWinners || []}
      siteUrl={siteUrl}
      serverNowIso={new Date().toISOString()}
    />
  );
}
