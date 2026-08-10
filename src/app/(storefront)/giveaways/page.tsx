import Link from "next/link";
import { createAdminClient } from "@/utils/supabase/admin";

export default async function GiveawaysIndexPage() {
  let giveaways: any[] = [];
  let errorMsg: string | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("giveaways")
      .select("id, title, slug, prize_title, prize_image, status, end_at")
      .in("status", ["scheduled", "active", "paused", "completed"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) errorMsg = error.message;
    else giveaways = data || [];
  } catch (e: any) {
    errorMsg = e?.message || "Unable to load giveaways";
  }

  return (
    <div className="ms-page">
      <div className="ms-shell max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="ms-eyebrow">GIVEAWAYS</p>
          <h1 className="ms-display text-3xl mt-2">Win with Mahadev Mobiles</h1>
          <p className="ms-lede mt-2">Join live campaigns, earn entries, and climb the leaderboard.</p>
        </div>

        {errorMsg ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            {errorMsg}
          </p>
        ) : null}

        <ul className="space-y-3">
          {giveaways.length === 0 ? (
            <li className="rounded-2xl border bg-white p-8 text-center text-sm text-[#6e6e73]">
              No giveaways right now. Check back soon.
            </li>
          ) : (
            giveaways.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/giveaway/${g.slug}`}
                  className="flex gap-4 rounded-2xl border bg-white p-4 hover:bg-[#fafafa] transition-colors"
                >
                  {g.prize_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.prize_image}
                      alt=""
                      className="h-20 w-20 rounded-xl object-cover bg-[#f5f5f7]"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-[#f5f5f7]" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-[#6e6e73]">{g.status}</p>
                    <p className="font-semibold text-[#1d1d1f] truncate">{g.prize_title}</p>
                    <p className="text-sm text-[#6e6e73] truncate">{g.title}</p>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
