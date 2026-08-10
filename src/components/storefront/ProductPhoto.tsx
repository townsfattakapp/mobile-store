import Image from "next/image";

const PLACEHOLDER =
  "https://placehold.co/480x560/f7f3ec/8a8496?text=Mahadev+Mobiles";

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
 * Server-safe product photo (no canvas / no client JS).
 * Prefer this on homepage rails for fewer hydration islands.
 */
export function ProductPhoto({
  src,
  alt,
  priority = false,
  className,
  sizes = "(max-width: 640px) 46vw, 240px",
  width = 480,
  height = 560,
  fill = false,
  quality = 72,
}: {
  src?: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  quality?: number;
}) {
  const url = (src && src.trim()) || PLACEHOLDER;
  const unoptimized = !canOptimize(url);
  if (fill) {
    return (
      <Image
        src={url}
        alt={alt}
        sizes={sizes}
        priority={priority}
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
        quality={quality}
        className={className}
        unoptimized={unoptimized}
        fill
      />
    );
  }
  return (
    <Image
      src={url}
      alt={alt}
      sizes={sizes}
      priority={priority}
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? "eager" : "lazy"}
      quality={quality}
      className={className}
      unoptimized={unoptimized}
      width={width}
      height={height}
    />
  );
}
