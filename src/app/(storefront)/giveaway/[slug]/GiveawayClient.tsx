"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  claimShareRewardAction,
  joinGiveawayAction,
} from "../actions";
import type { GiveawayEntryRule, GiveawayRow, LeaderboardRow, MyPosition, PublicGiveawayState } from "@/lib/giveaway/types";
import { canJoinGiveaway } from "@/lib/giveaway/rules";

function medal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}

function Countdown({ endAt, serverNowIso }: { endAt: string | null; serverNowIso: string }) {
  const end = endAt ? new Date(endAt).getTime() : null;
  const skew = useMemo(() => Date.now() - new Date(serverNowIso).getTime(), [serverNowIso]);
  const [now, setNow] = useState(() => Date.now() - skew);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() - skew), 1000);
    return () => clearInterval(t);
  }, [skew]);

  if (!end) return <span className="text-sm text-[#6e6e73]">No end date set</span>;
  const diff = Math.max(0, end - now);
  if (diff <= 0) return <span className="font-semibold">Ended</span>;

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex gap-2 justify-center" aria-live="polite">
      {[
        [d, "d"],
        [h, "h"],
        [m, "m"],
        [s, "s"],
      ].map(([val, label]) => (
        <div
          key={String(label)}
          className="min-w-[3.25rem] rounded-xl bg-black/5 px-2 py-2 text-center"
        >
          <div className="text-lg font-bold tabular-nums text-[#1d1d1f]">{pad(Number(val))}</div>
          <div className="text-[10px] uppercase tracking-wide text-[#6e6e73]">{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function GiveawayClient({
  giveaway,
  rules,
  publicState,
  leaderboard,
  totalParticipants,
  position: initialPosition,
  isLoggedIn,
  referralFromUrl,
  autojoin,
  previousWinners,
  announcedWinners,
  siteUrl,
  serverNowIso,
}: {
  giveaway: GiveawayRow;
  rules: GiveawayEntryRule[];
  publicState: PublicGiveawayState;
  leaderboard: LeaderboardRow[];
  totalParticipants: number;
  position: MyPosition;
  isLoggedIn: boolean;
  referralFromUrl: string | null;
  autojoin: boolean;
  previousWinners: any[];
  announcedWinners: any[];
  siteUrl: string;
  serverNowIso: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [position, setPosition] = useState(initialPosition);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const autojoinRan = useRef(false);

  const referralLink = position.referralCode
    ? `${siteUrl}/giveaway/${giveaway.slug}?ref=${encodeURIComponent(position.referralCode)}`
    : `${siteUrl}/giveaway/${giveaway.slug}`;

  const loginNext = `/giveaway/${giveaway.slug}?${new URLSearchParams({
    ...(referralFromUrl ? { ref: referralFromUrl } : {}),
    autojoin: "1",
  }).toString()}`;

  const refreshPosition = async () => {
    const res = await fetch(`/api/giveaways/${giveaway.id}/my-position`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setPosition(data);
    }
  };

  const doJoin = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await joinGiveawayAction({
        giveawayId: giveaway.id,
        referralCode: referralFromUrl,
      });
      if (!res.ok) {
        if (res.requireLogin) {
          router.push(`/login?next=${encodeURIComponent(loginNext)}`);
          return;
        }
        setError(res.error);
        return;
      }
      setMessage(res.message);
      await refreshPosition();
      router.refresh();
    });
  };

  useEffect(() => {
    if (!autojoin || !isLoggedIn || autojoinRan.current) return;
    if (position.participating) return;
    if (!canJoinGiveaway(publicState)) return;
    autojoinRan.current = true;
    doJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autojoin, isLoggedIn]);

  const onEnterClick = () => {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    doJoin();
  };

  const shareText = `I'm entering the ${giveaway.title} giveaway to win ${giveaway.prize_title}! Join here: ${referralLink}`;

  const onShare = async () => {
    setError(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: giveaway.title,
          text: shareText,
          url: referralLink,
        });
      } else {
        const wa = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        window.open(wa, "_blank", "noopener,noreferrer");
      }
    } catch {
      // user cancelled share
    }

    if (position.participating) {
      startTransition(async () => {
        const res = await claimShareRewardAction({ giveawayId: giveaway.id });
        if (!res.ok) {
          if (res.requireLogin) {
            router.push(`/login?next=${encodeURIComponent(loginNext)}`);
            return;
          }
          // soft: share still happened; show cooldown quietly
          setMessage(res.error);
          return;
        }
        setMessage(res.message);
        await refreshPosition();
        router.refresh();
      });
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link.");
    }
  };

  const openJoin = canJoinGiveaway(publicState);
  const stateLabel: Record<PublicGiveawayState, string> = {
    coming_soon: "Coming Soon",
    live: "Live",
    paused: "Temporarily Paused",
    ended: "Giveaway Ended",
    winner_announced: "Winner Announced",
    cancelled: "Giveaway Cancelled",
  };

  const ruleLabel = (r: GiveawayEntryRule) => {
    switch (r.action_type) {
      case "join":
        return "Join Giveaway";
      case "whatsapp_share":
        return "WhatsApp / Share";
      case "referral":
        return "Refer a Friend";
      case "purchase": {
        const min = Number(r.min_order_amount || 0);
        return min > 0
          ? `Purchase ₹${min.toLocaleString("en-IN")}+`
          : "Qualifying Purchase";
      }
      default:
        return r.action_type;
    }
  };

  return (
    <div className="ms-page pb-24">
      <div className="ms-shell max-w-lg mx-auto px-4 pt-6 space-y-6">
        <div className="text-center space-y-2">
          <p className="ms-eyebrow tracking-[0.2em]">GIVEAWAY</p>
          <h1 className="ms-display text-3xl sm:text-4xl leading-tight">{giveaway.prize_title}</h1>
          <p className="text-sm text-[#6e6e73]">{giveaway.title}</p>
          <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-black/5 text-[#1d1d1f]">
            {stateLabel[publicState]}
          </span>
        </div>

        {giveaway.prize_image ? (
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-[#f5f5f7]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={giveaway.prize_image}
              alt={giveaway.prize_title}
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
        ) : null}

        {publicState === "winner_announced" && announcedWinners.length > 0 ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center space-y-2">
            <p className="text-sm font-semibold text-emerald-900">Winner Announced</p>
            {announcedWinners.map((w, i) => (
              <div key={i}>
                <p className="text-xl font-bold text-[#1d1d1f]">{w.display_name}</p>
                <p className="text-sm text-[#6e6e73]">{w.prize_title}</p>
              </div>
            ))}
          </section>
        ) : null}

        {giveaway.end_at && publicState === "live" ? (
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">
              Ends in
            </p>
            <Countdown endAt={giveaway.end_at} serverNowIso={serverNowIso} />
          </div>
        ) : null}

        {giveaway.description ? (
          <p className="text-center text-[15px] leading-relaxed text-[#1d1d1f]">
            {giveaway.description}
          </p>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
            {message}
          </div>
        ) : null}

        {!position.participating ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onEnterClick}
              disabled={pending || !openJoin}
              className="ms-btn ms-btn--primary w-full h-14 text-base disabled:opacity-50"
            >
              {pending ? "Joining…" : openJoin ? "Enter Giveaway" : stateLabel[publicState]}
            </button>
            <p className="text-center text-xs text-[#6e6e73]">
              Earn more entries to increase your chances of winning.
            </p>
            {!isLoggedIn && openJoin ? (
              <p className="text-center text-xs text-[#6e6e73]">
                Sign in with email & password to join instantly.{" "}
                <Link href={`/signup?next=${encodeURIComponent(loginNext)}`} className="underline">
                  Create account
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <section className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm">
            <p className="text-sm font-semibold text-emerald-800">You&apos;re entered!</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f5f5f7] p-3">
                <p className="text-[11px] text-[#6e6e73]">Your Entries</p>
                <p className="text-2xl font-bold tabular-nums">{position.entries}</p>
              </div>
              <div className="rounded-xl bg-[#f5f5f7] p-3">
                <p className="text-[11px] text-[#6e6e73]">Your Rank</p>
                <p className="text-2xl font-bold tabular-nums">
                  {position.rank ? `#${position.rank}` : "—"}
                </p>
              </div>
            </div>
            {position.entriesToNextRank != null && position.entriesToNextRank > 0 ? (
              <p className="text-sm text-[#1d1d1f]">
                {position.entriesToNextRank} more entr
                {position.entriesToNextRank === 1 ? "y" : "ies"} to reach #
                {(position.rank || 1) - 1}
              </p>
            ) : position.rank === 1 ? (
              <p className="text-sm text-emerald-800 font-medium">You&apos;re #1 on the board!</p>
            ) : null}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onShare}
                disabled={pending}
                className="ms-btn ms-btn--primary w-full h-12"
              >
                Share & Invite Friends
              </button>
              <button
                type="button"
                onClick={onCopy}
                className="h-11 rounded-xl border text-sm font-medium"
              >
                {copied ? "Copied!" : "Copy Referral Link"}
              </button>
            </div>
            <p className="text-[11px] break-all text-[#6e6e73]">{referralLink}</p>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Ways to earn</h2>
          <ul className="space-y-2">
            {rules
              .filter((r) =>
                ["join", "whatsapp_share", "referral", "purchase"].includes(r.action_type)
              )
              .map((r) => {
                const done =
                  r.action_type === "join" && position.participating
                    ? true
                    : false;
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm"
                  >
                    <span className={done ? "text-emerald-800" : "text-[#1d1d1f]"}>
                      {done ? "✓ " : ""}
                      {ruleLabel(r)}
                    </span>
                    <span className="font-semibold tabular-nums">+{r.entries}</span>
                  </li>
                );
              })}
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-semibold">Top participants</h2>
            <span className="text-xs text-[#6e6e73]">{totalParticipants} joined</span>
          </div>
          <ol className="rounded-2xl border bg-white divide-y overflow-hidden">
            {leaderboard.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[#6e6e73]">
                Be the first to enter.
              </li>
            ) : (
              leaderboard.map((row) => (
                <li
                  key={row.participantId}
                  className={`flex items-center justify-between px-4 py-3 text-sm ${
                    row.isCurrentUser ? "bg-amber-50" : ""
                  }`}
                >
                  <span>
                    <span className="inline-block w-8">{medal(row.rank)}</span>
                    {row.displayName}
                    {row.isCurrentUser ? " (you)" : ""}
                  </span>
                  <strong className="tabular-nums">{row.entries}</strong>
                </li>
              ))
            )}
          </ol>
          {position.participating && position.rank && position.rank > 10 ? (
            <p className="text-sm text-center text-[#1d1d1f]">
              Your position: <strong>#{position.rank}</strong> · {position.entries} entries
            </p>
          ) : null}
        </section>

        {giveaway.terms_and_conditions ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Rules</h2>
            <div className="rounded-2xl border bg-white p-4 text-sm leading-relaxed text-[#424245] whitespace-pre-wrap">
              {giveaway.terms_and_conditions}
            </div>
          </section>
        ) : null}

        {(previousWinners.length > 0 || announcedWinners.length > 0) && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Previous winners</h2>
            <ul className="space-y-2">
              {previousWinners.map((w) => (
                <li key={w.id} className="rounded-xl border bg-white px-4 py-3 text-sm flex gap-3">
                  {w.winner_photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.winner_photo} alt="" className="h-12 w-12 rounded-lg object-cover" loading="lazy" />
                  ) : null}
                  <div>
                    <p className="font-semibold">{w.display_name}</p>
                    <p className="text-[#6e6e73]">{w.prize_title}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
