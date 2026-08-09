export type StorefrontProfile = {
  brand_name: string;
  tagline: string;
  business_hours: string;
  phone: string;
  email: string;
  website: string;
  address_line: string;
  instagram_url: string;
  whatsapp_url: string;
  /** Digits-only international number for product “Chat with Seller” (e.g. 919876543210) */
  whatsapp_number: string;
  twitter_url: string;
  facebook_url: string;
  /** Official Instagram reel/post permalinks shown above the footer */
  instagram_reels: string[];
  designed_by_name: string;
  designed_by_org: string;
  designed_by_url: string;
  seo_title: string;
  seo_description: string;
  hero_eyebrow: string;
  hero_headline: string;
  hero_subcopy: string;
};

export const DEFAULT_STOREFRONT_PROFILE: StorefrontProfile = {
  brand_name: "Mahadev Mobiles",
  tagline:
    "Your trusted mobile store in Tiroda — new launches, quality-checked pre-owned phones, and genuine accessories.",
  business_hours: "Mon–Sat · 10:00 AM – 8:00 PM IST",
  phone: "085529 11313",
  email: "",
  website: "",
  address_line: "Old Bus Stop, Tiroda, Maharashtra 441911",
  instagram_url: "https://www.instagram.com/mahadevmobiletirora/",
  whatsapp_url: "https://chat.whatsapp.com/CFqzB24oVG004N7Haxtp2Q",
  whatsapp_number: "",
  twitter_url: "",
  facebook_url: "",
  instagram_reels: [],
  designed_by_name: "Evolw — Fattakse",
  designed_by_org: "A Unit of EVOLW",
  designed_by_url: "https://www.evolw.in",
  seo_title: "Mahadev Mobiles — Phones & Accessories in Tiroda",
  seo_description:
    "Mahadev Mobiles, Old Bus Stop, Tiroda. Shop new and certified pre-owned mobiles, accessories, and spare parts. Call 085529 11313.",
  hero_eyebrow: "Mahadev Mobiles · Tiroda",
  hero_headline: "Upgrade what you carry every day.",
  hero_subcopy:
    "New launches and quality-checked pre-owned phones — priced clearly, chosen carefully for Tiroda.",
};

export const STORE_PROFILE_R2_KEY = "config/store-profile.json";

function normalizeBrandName(raw: string) {
  const cleaned = String(raw || "")
    .replace(/\.+$/, "")
    .trim();
  return cleaned || DEFAULT_STOREFRONT_PROFILE.brand_name;
}

/**
 * Display pieces for the store logo.
 * No trailing dot. Accent split only for compact *STORE names (legacy).
 */
export function brandLogoParts(brandName: string) {
  const name = normalizeBrandName(brandName);
  const compact = name.replace(/\s+/g, "");
  if (/store$/i.test(compact) && !/\s/.test(name) && name.length > 5) {
    const accentLen = 5;
    return {
      lead: name.slice(0, -accentLen),
      accent: name.slice(-accentLen),
      suffix: "",
      full: name,
    };
  }
  return { lead: name, accent: "", suffix: "", full: name };
}

export function normalizeInstagramReelUrl(raw: string): string {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return "";
  try {
    const withProto = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    const u = new URL(withProto);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return "";
    // Accept reel / reels / p / tv — reject bare profile URLs (those cause X-Frame-Options deny)
    const match = u.pathname.match(/\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
    if (!match) return "";
    const kind = match[1].toLowerCase() === "reels" ? "reel" : match[1].toLowerCase();
    const code = match[2];
    return `https://www.instagram.com/${kind}/${code}/`;
  } catch {
    return "";
  }
}

/** Instagram's frame-friendly embed URL (main site root sets X-Frame-Options: deny). */
export function toInstagramEmbedSrc(permalink: string): string {
  const normalized = normalizeInstagramReelUrl(permalink);
  if (!normalized) return "";
  return `${normalized}embed/`;
}

export function parseInstagramReelUrls(raw: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : String(raw || "")
        .split(/\n|,/)
        .map((s) => s.trim());
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const url = normalizeInstagramReelUrl(part);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= 6) break;
  }
  return out;
}

export function sanitizeStorefrontProfile(
  input: Partial<StorefrontProfile> & { instagram_reels?: string[] | string | null } | null | undefined
): StorefrontProfile {
  const src = { ...DEFAULT_STOREFRONT_PROFILE, ...(input || {}) };
  return {
    brand_name: normalizeBrandName(src.brand_name),
    tagline: String(src.tagline || "").trim() || DEFAULT_STOREFRONT_PROFILE.tagline,
    business_hours:
      String(src.business_hours || "").trim() || DEFAULT_STOREFRONT_PROFILE.business_hours,
    phone: String(src.phone || "").trim() || DEFAULT_STOREFRONT_PROFILE.phone,
    email: String(src.email || "").trim(),
    website: String(src.website || "").trim(),
    address_line:
      String(src.address_line || "").trim() || DEFAULT_STOREFRONT_PROFILE.address_line,
    instagram_url:
      String(src.instagram_url || "").trim() || DEFAULT_STOREFRONT_PROFILE.instagram_url,
    whatsapp_url:
      String(src.whatsapp_url || "").trim() || DEFAULT_STOREFRONT_PROFILE.whatsapp_url,
    whatsapp_number: String(src.whatsapp_number || "").trim(),
    twitter_url: String(src.twitter_url || "").trim(),
    facebook_url: String(src.facebook_url || "").trim(),
    instagram_reels: parseInstagramReelUrls(src.instagram_reels),
    designed_by_name: "Evolw — Fattakse",
    designed_by_org: "A Unit of EVOLW",
    designed_by_url: "https://www.evolw.in",
    seo_title: String(src.seo_title || "").trim() || DEFAULT_STOREFRONT_PROFILE.seo_title,
    seo_description:
      String(src.seo_description || "").trim() || DEFAULT_STOREFRONT_PROFILE.seo_description,
    hero_eyebrow:
      String(src.hero_eyebrow || "").trim() || DEFAULT_STOREFRONT_PROFILE.hero_eyebrow,
    hero_headline:
      String(src.hero_headline || "").trim() || DEFAULT_STOREFRONT_PROFILE.hero_headline,
    hero_subcopy:
      String(src.hero_subcopy || "").trim() || DEFAULT_STOREFRONT_PROFILE.hero_subcopy,
  };
}
