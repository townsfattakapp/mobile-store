"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  measureProductImageFit,
  type ContentFit,
} from "@/lib/storefront/imageContentFit";

const PLACEHOLDER =
  "https://placehold.co/480x560/f7f3ec/8a8496?text=Mahadev+Mobiles";

/** Hosts we optimize via next/image; others still load early but unoptimized. */
const OPTIMIZABLE =
  /(^|\.)r2\.dev$|(^|\.)cloudflarestorage\.com$|(^|\.)placehold\.co$|(^|\.)supabase\.co$|(^|\.)apple\.com$|(^|\.)cdn-apple\.com$|(^|\.)samsung\.com$|(^|\.)vivo\.com$|(^|\.)vivoglobal\.com$|(^|\.)oppo\.com$|(^|\.)oneplus\.net$|(^|\.)oneplus\.com$|(^|\.)motorola\.com$|(^|\.)nothing\.tech$|(^|\.)flipkart\.com$|(^|\.)flixcart\.net$|(^|\.)media-amazon\.com$|(^|\.)ssl-images-amazon\.com$/i;

function canOptimize(src: string) {
  try {
    return OPTIMIZABLE.test(new URL(src).hostname);
  } catch {
    return false;
  }
}

const NO_FIT: ContentFit = { scale: 1, originX: 0.5, originY: 0.5 };

/**
 * Optimized product photo.
 * When `smartFit` is on, only sparse (small-looking) subjects get a gentle zoom.
 */
export function ProductImage({
  src,
  alt,
  priority = false,
  className,
  sizes = "(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 280px",
  width = 480,
  height = 560,
  fill = false,
  smartFit = false,
}: {
  src?: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  /** Analyze whitespace and zoom only undersized product subjects */
  smartFit?: boolean;
}) {
  const url = (src && src.trim()) || PLACEHOLDER;
  const unoptimized = !canOptimize(url);
  const [fit, setFit] = useState<ContentFit>(NO_FIT);

  useEffect(() => {
    if (!smartFit) {
      setFit(NO_FIT);
      return;
    }
    let alive = true;
    measureProductImageFit(url).then((next) => {
      if (alive) setFit(next);
    });
    return () => {
      alive = false;
    };
  }, [url, smartFit]);

  const style = useMemo(() => {
    if (!smartFit) return undefined;
    return {
      ["--fit-scale" as string]: String(fit.scale),
      // Always scale from card center so the subject stays visually centered
      transformOrigin: "center center",
    } as React.CSSProperties;
  }, [smartFit, fit.scale]);

  const shared = {
    src: url,
    alt,
    sizes,
    priority,
    fetchPriority: (priority ? "high" : "auto") as "high" | "auto",
    loading: (priority ? "eager" : "lazy") as "eager" | "lazy",
    quality: 78,
    className: smartFit ? `${className || ""} ms-smart-fit`.trim() : className,
    style,
    unoptimized,
  };

  if (fill) {
    return <Image {...shared} fill />;
  }

  return <Image {...shared} width={width} height={height} />;
}
