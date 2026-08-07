import {
  fetchAndUploadImageToR2,
  isOurR2Url,
  isR2Configured,
  R2NotConfiguredError,
} from "@/lib/storage/R2Client";
import { isJunkBrandImage } from "@/lib/catalog/scraper/extractProductImages";

/** Keep storefront lean: 1 hero + a few gallery / color shots. */
export const IMAGE_LIMITS = {
  maxGallery: 5,
  maxColors: 5,
} as const;

function normalizeUrl(raw?: string | null): string {
  if (!raw) return "";
  let u = String(raw).trim();
  if (u.startsWith("//")) u = `https:${u}`;
  if (!/^https?:\/\//i.test(u)) return "";
  if (isJunkBrandImage(u)) return "";
  // Extra marketing noise that slips past logo filters
  if (
    /banner|promo|campaign|lifestyle|unbox|thumbnail-small|sprite|watermark|badge|offer|emi|exchange|trade[-_]?in|compare|kv-bg|hero-bg|background/i.test(
      u
    )
  ) {
    // Allow if it still looks like a product packshot
    if (!/product|phone|device|gallery|color|sku|800x|832\/832/i.test(u)) {
      return "";
    }
  }
  return u;
}

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export type CuratedSourceImages = {
  main: string;
  gallery: string[];
  colorImages: Record<string, string>;
};

/**
 * Drop junk / duplicate URLs and keep only what the storefront needs.
 */
export function curateSourceImages(input: {
  main?: string | null;
  gallery?: string[] | null;
  colorImages?: Record<string, string> | null;
  variantImages?: Array<{ color?: string; url?: string | null }> | null;
}): CuratedSourceImages {
  const seen = new Set<string>();
  const pushUnique = (raw: string | null | undefined): string => {
    const u = normalizeUrl(raw);
    if (!u) return "";
    const key = urlKey(u);
    if (seen.has(key)) return "";
    seen.add(key);
    return u;
  };

  const colorImages: Record<string, string> = {};
  const colorEntries = Object.entries(input.colorImages || {});
  for (const [color, img] of colorEntries) {
    if (Object.keys(colorImages).length >= IMAGE_LIMITS.maxColors) break;
    const u = normalizeUrl(img);
    if (!u) continue;
    colorImages[color] = u;
    seen.add(urlKey(u));
  }

  // Fill missing color slots from variant refs
  for (const v of input.variantImages || []) {
    if (Object.keys(colorImages).length >= IMAGE_LIMITS.maxColors) break;
    const color = String(v.color || "").trim();
    if (!color || colorImages[color]) continue;
    const u = normalizeUrl(v.url);
    if (!u) continue;
    colorImages[color] = u;
    seen.add(urlKey(u));
  }

  const gallery: string[] = [];
  const main =
    pushUnique(input.main) ||
    Object.values(colorImages)[0] ||
    "";
  if (main) {
    gallery.push(main);
    seen.add(urlKey(main));
  }

  for (const g of input.gallery || []) {
    if (gallery.length >= IMAGE_LIMITS.maxGallery) break;
    const u = pushUnique(g);
    if (u) gallery.push(u);
  }

  // Prefer at least one distinct color in gallery if room
  for (const img of Object.values(colorImages)) {
    if (gallery.length >= IMAGE_LIMITS.maxGallery) break;
    const key = urlKey(img);
    if (seen.has(key) && gallery.includes(img)) continue;
    if (!gallery.some((x) => urlKey(x) === key)) {
      gallery.push(img);
      seen.add(key);
    }
  }

  return {
    main: gallery[0] || main || "",
    gallery,
    colorImages,
  };
}

export type UploadedProductImages = {
  main: string;
  gallery: string[];
  colorImages: Record<string, string>;
};

/**
 * Upload curated source URLs to Cloudflare R2. DB should only store returned R2 URLs.
 * Throws R2NotConfiguredError if R2 env is missing.
 */
export async function uploadCuratedImagesToR2(
  curated: CuratedSourceImages,
  prefix: string
): Promise<UploadedProductImages> {
  if (!isR2Configured()) {
    throw new R2NotConfiguredError();
  }

  const cache = new Map<string, string>();

  const toR2 = async (url: string, key: string): Promise<string> => {
    if (!url) return "";
    if (isOurR2Url(url)) return url;
    const hit = cache.get(url);
    if (hit) return hit;
    try {
      const uploaded = await fetchAndUploadImageToR2(url, `${prefix}-${key}`);
      cache.set(url, uploaded);
      return uploaded;
    } catch (e) {
      console.warn(`R2 upload skipped for ${key}:`, (e as Error)?.message || e);
      return "";
    }
  };

  const main = curated.main
    ? await toR2(curated.main, "main")
    : "";

  const gallery: string[] = [];
  for (let i = 0; i < curated.gallery.length; i++) {
    const src = curated.gallery[i];
    const uploaded = await toR2(
      src,
      i === 0 && src === curated.main ? "main" : `g${i}`
    );
    if (uploaded && !gallery.includes(uploaded)) gallery.push(uploaded);
  }
  if (main && !gallery.includes(main)) gallery.unshift(main);

  const colorImages: Record<string, string> = {};
  let ci = 0;
  for (const [color, img] of Object.entries(curated.colorImages)) {
    const slug = color
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);
    const uploaded = await toR2(img, `color-${slug || ci}`);
    if (uploaded) colorImages[color] = uploaded;
    ci += 1;
  }

  // If every remote download failed but R2 is configured, still return empty
  // (caller may publish without images) — only throw when R2 itself is missing
  // (checked above).
  return {
    main: main || gallery[0] || "",
    gallery: gallery.slice(0, IMAGE_LIMITS.maxGallery),
    colorImages,
  };
}

/**
 * Map variants onto uploaded color / main R2 URLs (no external leftovers).
 */
export function mapVariantsToUploadedImages(
  variants: any[],
  uploaded: UploadedProductImages
): any[] {
  return (variants || []).map((v) => {
    const colorKey = String(v.color || "");
    const colorImg =
      uploaded.colorImages[colorKey] ||
      Object.entries(uploaded.colorImages).find(
        ([k]) => k.toLowerCase() === colorKey.toLowerCase()
      )?.[1] ||
      uploaded.main ||
      "";
    return { ...v, reference_image_url: colorImg };
  });
}
