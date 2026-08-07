"use client";

import React, { useMemo } from "react";
import { useStoreConfig } from "@/components/storefront/StoreConfigProvider";
import {
  normalizeInstagramReelUrl,
  toInstagramEmbedSrc,
} from "@/lib/store/profile-shared";

function ReelCard({ permalink }: { permalink: string }) {
  const clean = normalizeInstagramReelUrl(permalink);
  const embedSrc = toInstagramEmbedSrc(clean);
  if (!clean || !embedSrc) return null;

  // Instagram's official in-page player (frame-allowed /embed path — not a new tab)
  return (
    <div className="ms-ig-card">
      <iframe
        src={`${embedSrc}?utm_source=ig_web_copy_link`}
        title="Instagram Reel"
        className="ms-ig-iframe"
        loading="lazy"
        referrerPolicy="origin-when-cross-origin"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

/**
 * Instagram Reels band — plays inline via Instagram /embed/ iframes (same page, no new tab).
 */
export function InstagramReelsSection() {
  const store = useStoreConfig();
  const reels = useMemo(
    () =>
      (store.instagram_reels || [])
        .map((u) => normalizeInstagramReelUrl(u))
        .filter(Boolean),
    [store.instagram_reels]
  );

  if (!reels.length) return null;

  return (
    <section className="ms-ig" aria-labelledby="ig-reels-heading">
      <div className="ms-shell">
        <div className="ms-ig-head">
          <div>
            <p className="ms-eyebrow">Instagram</p>
            <h2 id="ig-reels-heading" className="ms-display ms-display--md">
              Latest from {store.brand_name}
            </h2>
            <p className="ms-lede ms-lede--narrow mt-3">
              Watch reels right here — tap play on a card to start.
            </p>
          </div>
        </div>

        <div className="ms-ig-rail">
          {reels.map((url) => (
            <ReelCard key={url} permalink={url} />
          ))}
        </div>
      </div>
    </section>
  );
}
