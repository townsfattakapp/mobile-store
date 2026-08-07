import Image from "next/image";

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

/**
 * Optimized product photo — eager/high priority for above-the-fold tiles.
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
}: {
  src?: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  const url = (src && src.trim()) || PLACEHOLDER;
  const unoptimized = !canOptimize(url);

  const shared = {
    src: url,
    alt,
    sizes,
    priority,
    fetchPriority: (priority ? "high" : "auto") as "high" | "auto",
    loading: (priority ? "eager" : "lazy") as "eager" | "lazy",
    quality: 78,
    className,
    unoptimized,
  };

  if (fill) {
    return <Image {...shared} fill />;
  }

  return <Image {...shared} width={width} height={height} />;
}
