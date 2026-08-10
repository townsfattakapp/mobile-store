import Link from "next/link";
import { Gift, ArrowUpRight } from "lucide-react";

export type ActiveGiveawayPromo = {
  slug: string;
  title: string;
  prize_title: string;
  end_at: string | null;
};

/** Slim homepage strip — only rendered when an active giveaway exists. */
export function HomeGiveawayBanner({ promo }: { promo: ActiveGiveawayPromo }) {
  const href = `/giveaway/${promo.slug}`;
  return (
    <section className="ms-shell px-4 sm:px-6 pt-4" aria-label="Active giveaway">
      <Link
        href={href}
        className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border border-black/10 bg-gradient-to-r from-[#1d1d1f] to-[#3a3a3c] px-4 py-4 sm:px-5 text-white shadow-sm transition-[transform,opacity] hover:opacity-95 active:scale-[0.99]"
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <Gift className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Live giveaway
          </span>
          <span className="block text-base sm:text-lg font-semibold truncate">
            Win {promo.prize_title}
          </span>
          <span className="block text-sm text-white/75 truncate">{promo.title}</span>
        </span>
        <span className="inline-flex items-center gap-1 self-start sm:self-center text-sm font-semibold underline-offset-4 group-hover:underline">
          Enter now
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </span>
      </Link>
    </section>
  );
}
