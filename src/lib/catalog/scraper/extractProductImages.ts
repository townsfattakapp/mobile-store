import type { CheerioAPI } from "cheerio";

/**
 * Smart product-image extraction for brand sites that put logos in og:image
 * (Tecno, Infinix, etc.) while real phone shots live in lazy data-src / config.js.
 */

const JUNK_IMAGE_RE =
  /favicon|tecno_icon|logo\.svg|logo\.png|logo_|_logo|logo-square|brand[-_]?mark|sprite|icon\.svg|apple-touch-icon|payment|badge|watermark|placeholder|blank\.|spacer|1x1|pixel\.|tracking|headerlogo|social[-_]?share|og[-_]?default|site[-_]?icon|\/icons?\/|\/flags?\/|galaxy_ai\.png|letter\.png|ksp-logo|kv-logo|nits-logo|logo-text|oxygenos|oxygen-os|powered[-_]?by|design-[lbr]-line|images-ksp-cursor|open[_-]?graph.*logo|wechat|qrcode|qr-code|whatsapp/i;

const STRONG_PRODUCT_RE =
  /\/phones?\/|\/products?\/|product[-_]?image|product[-_]?img|product_color_|pdp|sku|finish|variant|800\s*[x×*]\s*800|800x800|\/media\/|cdn\.shopify\.com\/.*\/files\/|images-kv-product|images-pack|\/nav\/op|phone-(?:left|right)|color[-_]?swatch|images\.samsung\.com.*gallery|rukminim|flixcart\.com\/image/i;

const WEAK_PRODUCT_RE =
  /\.(?:png|jpe?g|webp)(?:$|\?)/i;

export function isJunkBrandImage(url: string | null | undefined): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  if (!/^https?:\/\//i.test(url) && !url.startsWith("//")) return true;
  if (JUNK_IMAGE_RE.test(u)) return true;
  // Tiny SVG brand marks
  if (/\.svg($|\?)/i.test(u) && /icon|logo|favicon|x_new/i.test(u)) return true;
  if (/\/x_new\//i.test(u) && /\.(ico|svg)($|\?)/i.test(u)) return true;
  return false;
}

export function absImageUrl(src: string, pageUrl: string): string {
  let s = src.trim().replace(/\\u002F/g, "/").replace(/\\\//g, "/").replace(/&amp;/g, "&");
  if (s.startsWith("//")) s = `https:${s}`;
  try {
    return new URL(s, pageUrl).href;
  } catch {
    return s;
  }
}

function scoreImage(url: string, modelTokens: string[]): number {
  if (isJunkBrandImage(url)) return -1000;
  const u = url.toLowerCase();
  let score = 0;

  if (STRONG_PRODUCT_RE.test(u)) score += 40;
  if (WEAK_PRODUCT_RE.test(u)) score += 10;
  if (/\.svg($|\?)/i.test(u)) score -= 30;
  if (/slogan|kv-logo|ksp-logo|nits-logo|banner|hero-bg|background|lifestyle|ui-|frame-|design-[lbr]-line/i.test(u))
    score -= 40;
  if (/images-pack|\/nav\/op\d|product-station.*pack/i.test(u)) score += 45;
  if (/product|phone|device|handset/i.test(u)) score += 20;
  if (/800x800|1000x1000|1200x1200|832\/832|wid=\d{3,}/i.test(u)) score += 15;

  // Boost if URL path shares model slug tokens (pova, 8, pro)
  const hits = modelTokens.filter((t) => t.length >= 2 && u.includes(t));
  score += hits.length * 12;
  if (hits.length >= 2) score += 20;

  // Prefer opaque product PNGs over marketing JPG banners when tokens match
  if (hits.length && /\.png/i.test(u)) score += 8;

  return score;
}

function tokensFromModel(modelName?: string, pageUrl?: string): string[] {
  const bits: string[] = [];
  const push = (s: string) => {
    s.toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !/^(the|and|for|best|phones?|mobile|official|buy|shop)$/i.test(t))
      .forEach((t) => bits.push(t));
  };
  if (modelName) push(modelName);
  if (pageUrl) {
    try {
      const path = new URL(pageUrl).pathname;
      push(path.split("/").filter(Boolean).pop() || "");
    } catch {
      /* ignore */
    }
  }
  return [...new Set(bits)];
}

function collectRawUrls($: CheerioAPI, html: string, pageUrl: string): string[] {
  const out: string[] = [];
  const add = (raw?: string | null) => {
    if (!raw) return;
    // srcset: "url 1x, url2 2x"
    const parts = raw.split(",").map((p) => p.trim().split(/\s+/)[0]);
    for (const p of parts) {
      if (!p || p.startsWith("data:")) continue;
      if (!/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(p) && !/cdn\.|cloudfront|shopify|image/i.test(p))
        continue;
      out.push(absImageUrl(p, pageUrl));
    }
  };

  add($('meta[property="og:image"]').attr("content"));
  add($('meta[property="og:image:secure_url"]').attr("content"));
  add($('meta[name="twitter:image"]').attr("content"));
  add($('link[rel="image_src"]').attr("href"));

  $("img").each((_, el) => {
    const $el = $(el);
    add($el.attr("src"));
    add($el.attr("data-src"));
    add($el.attr("data-original"));
    add($el.attr("data-lazy-src"));
    add($el.attr("data-zoom-image"));
    add($el.attr("data-large_image"));
    add($el.attr("data-srcset"));
    add($el.attr("srcset"));
  });

  $("source").each((_, el) => {
    add($(el).attr("srcset"));
    add($(el).attr("data-srcset"));
    add($(el).attr("src"));
  });

  // JSON-LD images
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "");
      const nodes = Array.isArray(data) ? data : [data];
      const walk = (n: any) => {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n.image) {
          if (typeof n.image === "string") add(n.image);
          else if (Array.isArray(n.image)) n.image.forEach((i: any) => add(typeof i === "string" ? i : i?.url));
          else if (n.image.url) add(n.image.url);
        }
        if (n["@graph"]) walk(n["@graph"]);
      };
      nodes.forEach(walk);
    } catch {
      /* ignore */
    }
  });

  // Inline config / JS blobs (Tecno znConfigSource, etc.)
  const urlRe =
    /https?:\/\/[^"'\\\s>]+\.(?:png|jpe?g|webp)(?:\?[^"'\\\s>]*)?/gi;
  const fromHtml = html.match(urlRe) || [];
  fromHtml.forEach((u) => out.push(absImageUrl(u, pageUrl)));

  // Protocol-relative CDN urls in HTML
  const protoRe =
    /\/\/(?:cdn\.|d\d+|img\.)[^"'\\\s>]+\.(?:png|jpe?g|webp)(?:\?[^"'\\\s>]*)?/gi;
  (html.match(protoRe) || []).forEach((u) => out.push(absImageUrl(u, pageUrl)));

  // OnePlus / AEM relative DAM paths (not absolute in page HTML)
  const damRe =
    /\/content\/dam\/[^"'\\\s>]+\.(?:png|jpe?g|webp)(?:\?[^"'\\\s>]*)?/gi;
  (html.match(damRe) || []).forEach((u) => out.push(absImageUrl(u, pageUrl)));

  return out;
}

export type ExtractedImages = {
  main: string;
  gallery: string[];
};

/**
 * Pick best product photos from a brand page. Never returns logo/favicon as main
 * when a better candidate exists.
 */
export function extractProductImages(
  $: CheerioAPI,
  html: string,
  pageUrl: string,
  modelName?: string,
  maxGallery = 5
): ExtractedImages {
  const tokens = tokensFromModel(modelName, pageUrl);
  const scored = new Map<string, number>();

  for (const url of collectRawUrls($, html, pageUrl)) {
    const s = scoreImage(url, tokens);
    if (s < 0) continue;
    const prev = scored.get(url) ?? -Infinity;
    if (s > prev) scored.set(url, s);
  }

  const ranked = [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url);

  // Prefer single-device product shots over unrelated nav phones when tokens exist
  let filtered = ranked;
  if (tokens.length >= 2) {
    const matched = ranked.filter((u) => {
      const lower = u.toLowerCase();
      const hits = tokens.filter((t) => lower.includes(t)).length;
      return hits >= 1;
    });
    if (matched.length) filtered = matched;
  }

  const gallery = filtered
    .filter((u) => !isJunkBrandImage(u))
    .slice(0, maxGallery);

  return {
    main: gallery[0] || "",
    gallery,
  };
}

/** Clean SEO junk / slug noise from scraped titles */
export function cleanScrapedModelName(raw: string, brandName?: string): string {
  let name = String(raw || "")
    .replace(/\u00A0/g, " ")
    // Slug / CMS leftovers: iQOO_NEO_10R, _NEO_10R
    .replace(/[_]+/g, " ")
    .replace(/\s*[|–—-]\s*(best phones?|official.*|buy online.*|price.*|in india.*)?$/i, "")
    .replace(/\b(best phones?|official website|buy online|online store|in india)\b/gi, "")
    .replace(/\s*[|–—]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (brandName) {
    const brandEsc = brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    name = name.replace(new RegExp(`^(${brandEsc}|tecno mobile)\\s+`, "i"), "").trim();
    // Brand glued to model: iQOONeo → Neo
    name = name.replace(new RegExp(`^${brandEsc}(?=[A-Za-z0-9])`, "i"), "").trim();
  }
  // Deduplicate brand repetition "TECNO TECNO POVA" / "iQOO iQOO Neo"
  name = name.replace(/^([A-Za-z0-9]+)\s+\1\b/i, "$1");

  // Humanize common series tokens from noisy titles / slugs
  name = name
    .replace(/\bneo\s*(\d+)\s*([rR])?\b/gi, (_m, n, r) => `Neo ${n}${r ? String(r).toUpperCase() : ""}`)
    .replace(/\bz\s*(\d+)\s*([a-zA-Z]+)?\b/gi, (_m, n, suf) => `Z${n}${suf || ""}`)
    .replace(/\b5\s*g\b/gi, "5G")
    .replace(/\b4\s*g\b/gi, "4G")
    .replace(/\s+/g, " ")
    .trim();

  if (name.length > 70) name = name.slice(0, 70).trim();
  return name || String(raw || "").replace(/_/g, " ").trim();
}

/**
 * Full storefront label: brand + cleaned model (no double brand, no underscores).
 * e.g. brand=iQOO, model="iQOO _NEO_10R" → "iQOO Neo 10R"
 */
export function formatStoreProductName(
  modelName: string,
  brandName?: string | null
): string {
  const brand = String(brandName || "").trim();
  const model = cleanScrapedModelName(modelName, brand || undefined);
  if (!model) return brand || String(modelName || "").replace(/_/g, " ").trim();
  if (!brand) return model;
  const brandRe = new RegExp(
    `^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i"
  );
  if (brandRe.test(model)) {
    return model.replace(/\biqoo\b/gi, "iQOO").replace(/\s+/g, " ").trim();
  }
  return `${brand} ${model}`
    .replace(/\biqoo\b/gi, "iQOO")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True only for clear accessories — phones must NOT match.
 * Avoid loose words like "speaker", "case" inside phone marketing copy.
 */
export function detectIsAccessory(modelName: string, description = "", url = ""): boolean {
  const blob = `${modelName} ${description} ${url}`.toLowerCase();

  // Explicit phone signals win
  if (
    /\b(iphone|smartphone|mobile phone|5g phone|android phone|galaxy|pixel|pova|camon|spark|redmi|realme|iqoo|nothing phone|motorola|oneplus)\b/i.test(
      blob
    ) ||
    /\b\d+\s*g\b.*\b(phone|smartphone|mobile)\b/i.test(blob) ||
    /\/phones?\/|\/mobile\/|product-detail/i.test(url)
  ) {
    return false;
  }

  return /\b(power\s*banks?|chargers?|charging cables?|earbuds?|earphones?|neckbands?|tws|phone cases?|back covers?|tempered glass|screen guards?|car chargers?|vacuum cleaners?|trimmers?|smart watches?|bluetooth speakers?|mouse|keyboards?)\b/i.test(
    blob
  );
}
