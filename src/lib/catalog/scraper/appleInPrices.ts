/**
 * India Apple iPhone catalogs: colors, storage MRPs, and single-device finish image hints.
 * Prices are official-style starting MRPs (₹, tax-inclusive) for base configs.
 */

export type AppleStoragePrices = Record<string, number>;

export type AppleModelCatalog = {
  colors: string[];
  storage: AppleStoragePrices;
  ram: string;
  /** Preferred CDN finish slug → color display name */
  finishSlugs?: Record<string, string>;
};

const CATALOG: Record<string, AppleModelCatalog> = {
  "iphone 17": {
    ram: "8GB",
    colors: ["Black", "White", "Mist Blue", "Sage", "Lavender"],
    storage: { "256GB": 82900, "512GB": 102900 },
    finishSlugs: {
      black: "Black",
      white: "White",
      mistblue: "Mist Blue",
      "mist-blue": "Mist Blue",
      sage: "Sage",
      lavender: "Lavender",
    },
  },
  "iphone 17 pro": {
    ram: "12GB",
    colors: ["Cosmic Orange", "Deep Blue", "Silver"],
    storage: { "256GB": 134900, "512GB": 154900, "1TB": 174900 },
    finishSlugs: {
      cosmicorange: "Cosmic Orange",
      "cosmic-orange": "Cosmic Orange",
      deepblue: "Deep Blue",
      "deep-blue": "Deep Blue",
      silver: "Silver",
    },
  },
  "iphone 17 pro max": {
    ram: "12GB",
    colors: ["Cosmic Orange", "Deep Blue", "Silver"],
    storage: { "256GB": 154900, "512GB": 174900, "1TB": 194900 },
  },
  "iphone air": {
    ram: "8GB",
    colors: ["Sky Blue", "Light Gold", "Cloud White", "Space Black"],
    storage: { "256GB": 99900, "512GB": 119900, "1TB": 139900 },
  },
  "iphone 17e": {
    ram: "8GB",
    colors: ["Soft Pink", "White", "Black"],
    storage: { "128GB": 59900, "256GB": 69900, "512GB": 89900 },
  },
  "iphone 16": {
    ram: "8GB",
    colors: ["Black", "White", "Pink", "Teal", "Ultramarine"],
    storage: { "128GB": 79900, "256GB": 89900, "512GB": 109900 },
  },
  "iphone 16 plus": {
    ram: "8GB",
    colors: ["Black", "White", "Pink", "Teal", "Ultramarine"],
    storage: { "128GB": 89900, "256GB": 99900, "512GB": 119900 },
  },
  "iphone 16 pro": {
    ram: "8GB",
    colors: ["Black Titanium", "White Titanium", "Natural Titanium", "Desert Titanium"],
    storage: { "128GB": 119900, "256GB": 129900, "512GB": 149900, "1TB": 169900 },
  },
  "iphone 16 pro max": {
    ram: "8GB",
    colors: ["Black Titanium", "White Titanium", "Natural Titanium", "Desert Titanium"],
    storage: { "256GB": 144900, "512GB": 164900, "1TB": 184900 },
  },
  "iphone 16e": {
    ram: "8GB",
    colors: ["Black", "White"],
    storage: { "128GB": 59900, "256GB": 69900, "512GB": 89900 },
  },
  "iphone 15": {
    ram: "6GB",
    colors: ["Black", "Blue", "Green", "Yellow", "Pink"],
    storage: { "128GB": 69900, "256GB": 79900, "512GB": 99900 },
  },
  "iphone 15 plus": {
    ram: "6GB",
    colors: ["Black", "Blue", "Green", "Yellow", "Pink"],
    storage: { "128GB": 79900, "256GB": 89900, "512GB": 109900 },
  },
  "iphone 15 pro": {
    ram: "8GB",
    colors: ["Black Titanium", "White Titanium", "Blue Titanium", "Natural Titanium"],
    storage: { "128GB": 134900, "256GB": 144900, "512GB": 164900, "1TB": 184900 },
  },
  "iphone 15 pro max": {
    ram: "8GB",
    colors: ["Black Titanium", "White Titanium", "Blue Titanium", "Natural Titanium"],
    storage: { "256GB": 159900, "512GB": 179900, "1TB": 199900 },
  },
};

function normalizeModelKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\u00A0/g, " ")
    .replace(/apple\s+/g, "")
    .replace(/buy\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getAppleModelCatalog(modelName: string): AppleModelCatalog | null {
  const key = normalizeModelKey(modelName);
  if (CATALOG[key]) return CATALOG[key];
  let best: { key: string; cat: AppleModelCatalog; len: number } | null = null;
  for (const [k, cat] of Object.entries(CATALOG)) {
    if (key.includes(k) || k.includes(key)) {
      if (!best || k.length > best.len) best = { key: k, cat, len: k.length };
    }
  }
  return best?.cat ?? null;
}

/** Starting (lowest storage) MRP */
export function lookupAppleIndiaMrp(modelName: string): number | null {
  const cat = getAppleModelCatalog(modelName);
  if (!cat) return null;
  const prices = Object.values(cat.storage);
  return prices.length ? Math.min(...prices) : null;
}

export function lookupAppleVariantMrp(
  modelName: string,
  storage: string
): number | null {
  const cat = getAppleModelCatalog(modelName);
  if (!cat) return null;
  const norm = storage.replace(/\s+/g, "").toUpperCase();
  for (const [k, v] of Object.entries(cat.storage)) {
    if (k.replace(/\s+/g, "").toUpperCase() === norm) return v;
  }
  return null;
}

export function appleBuyUrlFromProductUrl(url: string, modelName?: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("apple.com")) return null;
    const locale = u.pathname.match(/^\/([a-z]{2})\//i)?.[1] || "in";

    let slug =
      u.pathname
        .split("/")
        .filter(Boolean)
        .pop()
        ?.replace(/\/$/, "") || "";

    if (!slug || slug === "iphone" || slug === "buy-iphone") {
      slug = (modelName || "")
        .toLowerCase()
        .replace(/apple\s+/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    // /shop/buy-iphone/iphone-17 already
    if (u.pathname.includes("/shop/buy-iphone/")) {
      return `${u.protocol}//${u.host}${u.pathname.replace(/\/$/, "")}`;
    }

    if (!slug.startsWith("iphone")) return null;
    return `${u.protocol}//${u.host}/${locale}/shop/buy-iphone/${slug}`;
  } catch {
    return null;
  }
}

export function parseAppleShopPrices(html: string): {
  mrp: number | null;
  sellingPrice: number | null;
} {
  const amounts: number[] = [];
  const patterns = [
    /"fullPrice"\s*:\s*(\d+(?:\.\d+)?)/gi,
    /"price"\s*:\s*(\d+(?:\.\d+)?)/gi,
    /"currentPrice"\s*:\s*(\d+(?:\.\d+)?)/gi,
    /₹\s*([0-9,]+)/g,
    /From\s*₹\s*([0-9,]+)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const n = Math.round(parseFloat(m[1].replace(/,/g, "")));
      if (Number.isFinite(n) && n >= 40000 && n <= 300000) amounts.push(n);
    }
  }
  if (!amounts.length) return { mrp: null, sellingPrice: null };
  const unique = [...new Set(amounts)].sort((a, b) => a - b);
  return { sellingPrice: unique[0], mrp: unique[unique.length - 1] };
}

/** True if URL looks like a multi-phone collage / family hero */
export function isCollageImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  return /family|hero-startframe|multi|all-colors|colors-hero|lifestyle|camera-closeup|camera_endframe|screen|display-zoom|ios-|trade-in|compare|accessory|mag-safe|case-/.test(
    u
  );
}

/** Prefer single-device finish / product studio shots */
export function isSingleDeviceImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (isCollageImageUrl(u)) return false;
  return (
    /finish-select|finish_select|product-stage|product_image|unretina|iphone-\d+|iphoneair|iphone-air/.test(
      u
    ) || /storeimages\.cdn-apple\.com/.test(u)
  );
}

/** Alternate angles (_AV2…) — ok for gallery, not ideal as primary color hero */
export function isAlternateAngleUrl(url: string): boolean {
  return /_AV\d+/i.test(url);
}

/**
 * Apple CDN signs images with `.v=…` tied to exact transform params.
 * Changing wid/hei while keeping `.v` → 404. Rebuild as unsigned clean URL.
 */
export function upgradeAppleImageUrl(url: string, size = 1200): string {
  try {
    // Fix common scrape artifacts
    let raw = url
      .replace(/\\u002F/g, "/")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&")
      .trim();

    const u = new URL(raw);
    if (!/cdn-apple\.com|apple\.com/i.test(u.hostname)) return raw;

    const assetMatch = u.pathname.match(/\/is\/([^/?#]+)/i);
    if (assetMatch) {
      let assetId = decodeURIComponent(assetMatch[1]);
      // Keep path structure Apple expects
      const basePath = u.pathname.slice(0, u.pathname.toLowerCase().indexOf("/is/") + 4);
      u.pathname = `${basePath}${assetId}`;
    }

    // Drop signature + extras that invalidate when size changes
    u.search = "";
    u.searchParams.set("wid", String(size));
    u.searchParams.set("hei", String(size));
    u.searchParams.set("fmt", "jpeg");
    u.searchParams.set("qlt", "90");
    return u.toString();
  } catch {
    return url;
  }
}

/** Prefer full-phone finish shot (strip _AV2 alternate angles) */
export function toPrimaryFinishImageUrl(url: string, size = 1200): string {
  try {
    const cleaned = upgradeAppleImageUrl(url, size);
    const u = new URL(cleaned);
    u.pathname = u.pathname.replace(/_AV\d+$/i, "");
    return u.toString();
  } catch {
    return upgradeAppleImageUrl(url, size);
  }
}

/** Runtime fix for already-saved broken signed URLs */
export function sanitizeAppleImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!/cdn-apple\.com/i.test(url)) return url;
  // Prefer full-phone finish (not camera-crop _AV2) when possible
  if (/finish-select/i.test(url)) return toPrimaryFinishImageUrl(url);
  return upgradeAppleImageUrl(url);
}

const FINISH_YEAR_BY_SERIES: Record<string, string> = {
  "iphone 17": "202509",
  "iphone 17 pro": "202509",
  "iphone 17 pro max": "202509",
  "iphone air": "202509",
  "iphone 17e": "202602",
  "iphone 16": "202409",
  "iphone 16 plus": "202409",
  "iphone 16 pro": "202409",
  "iphone 16 pro max": "202409",
  "iphone 16e": "202502",
  "iphone 15": "202309",
  "iphone 15 plus": "202309",
  "iphone 15 pro": "202309",
  "iphone 15 pro max": "202309",
};

function modelAssetSlug(modelName: string): string {
  return normalizeModelKey(modelName).replace(/\s+/g, "-");
}

/** Known-good unsigned finish images when HTML scrape is sparse */
export function curatedAppleFinishImages(modelName: string): Record<string, string> {
  const cat = getAppleModelCatalog(modelName);
  if (!cat) return {};
  const key = normalizeModelKey(modelName);
  const year =
    FINISH_YEAR_BY_SERIES[key] ||
    Object.entries(FINISH_YEAR_BY_SERIES).find(([k]) => key.includes(k))?.[1] ||
    "202509";
  const slug = modelAssetSlug(modelName);
  const out: Record<string, string> = {};

  const slugEntries = cat.finishSlugs
    ? Object.entries(cat.finishSlugs).filter(([s]) => !s.includes("-"))
    : cat.colors.map((c) => [c.toLowerCase().replace(/\s+/g, ""), c] as const);

  for (const [finishSlug, colorName] of slugEntries) {
    const asset = `${slug}-finish-select-${finishSlug}-${year}`;
    out[colorName] = `https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/${asset}?wid=1200&hei=1200&fmt=jpeg&qlt=90`;
  }
  return out;
}

export function colorFromFinishUrl(url: string, finishSlugs?: Record<string, string>): string | null {
  const u = url.toLowerCase();
  // ...-black? or /black_ or finish-select-...-black
  const m =
    u.match(/finish-select-(?:[a-z0-9]+-)*?([a-z]+(?:-[a-z]+)?)-\d{6}(?:_av\d+)?/i) ||
    u.match(/finish-select-[a-z0-9-]*?([a-z]+(?:-[a-z]+)?)\?/i) ||
    u.match(/finish-select-[a-z0-9-]*-([a-z]+(?:-[a-z]+)?)$/i) ||
    u.match(/[-_/](cosmic-?orange|deep-?blue|sky-?blue|light-?gold|cloud-?white|space-?black|soft-?pink|mist-?blue|ultramarine|natural-?titanium|black-?titanium|white-?titanium|desert-?titanium|lavender|sage|black|white|blue|green|yellow|pink|teal|silver)(?:_|\.|\?|$)/i);
  if (!m) return null;
  const slug = m[1].replace(/_/g, "-").toLowerCase();
  if (finishSlugs?.[slug]) return finishSlugs[slug];
  if (finishSlugs?.[slug.replace(/-/g, "")]) return finishSlugs[slug.replace(/-/g, "")];
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Extract color → best single-device image from Apple HTML.
 */
export function extractAppleColorImages(
  html: string,
  knownColors: string[],
  finishSlugs?: Record<string, string>,
  modelName?: string
): Record<string, string> {
  const byColor: Record<string, string> = {};
  const modelSlug = modelName ? modelAssetSlug(modelName) : "";
  const urlRe =
    /https?:\/\/[^"'\\\s]+storeimages\.cdn-apple\.com[^"'\\\s]+/gi;
  const urls = [...new Set(html.match(urlRe) || [])]
    .map((u) => u.replace(/\\u002F/g, "/").replace(/\\\//g, "/"))
    .filter((u) => !isCollageImageUrl(u))
    .filter((u) => {
      if (!modelSlug) return true;
      // Keep same model family; drop Pro Max assets when scraping Pro, etc.
      const path = u.toLowerCase();
      if (modelSlug.endsWith("-pro") && !modelSlug.includes("max")) {
        if (path.includes("pro-max") || path.includes("promax")) return false;
      }
      if (modelSlug.includes("pro-max")) {
        if (!path.includes("pro-max") && !path.includes("promax")) {
          // allow generic only if it has finish-select for this model
          if (!path.includes(modelSlug.replace(/-/g, ""))) {
            return path.includes("pro-max") || path.includes(modelSlug);
          }
        }
      }
      return path.includes(modelSlug) || path.includes(modelSlug.replace(/-/g, ""));
    });

  // Prefer primary finish-select (no _AV2) first
  const ranked = [
    ...urls.filter((u) => /finish-select/i.test(u) && !isAlternateAngleUrl(u)),
    ...urls.filter((u) => /finish-select/i.test(u) && isAlternateAngleUrl(u)),
    ...urls.filter((u) => !/finish-select/i.test(u) && isSingleDeviceImageUrl(u)),
  ];

  for (const url of ranked) {
    const color = colorFromFinishUrl(url, finishSlugs);
    if (!color) continue;
    const matchKnown =
      knownColors.find((c) => c.toLowerCase() === color.toLowerCase()) ||
      knownColors.find(
        (c) =>
          c.toLowerCase().includes(color.toLowerCase()) ||
          color.toLowerCase().includes(c.toLowerCase())
      );
    const key = matchKnown || color;
    const next = toPrimaryFinishImageUrl(url);
    const prev = byColor[key];
    if (!prev) {
      byColor[key] = next;
    } else if (isAlternateAngleUrl(prev) && !isAlternateAngleUrl(url)) {
      byColor[key] = next;
    }
  }

  // Fill any missing colors from curated unsigned CDN assets
  if (modelName) {
    const curated = curatedAppleFinishImages(modelName);
    for (const [color, img] of Object.entries(curated)) {
      if (!byColor[color]) byColor[color] = img;
    }
  }

  return byColor;
}

export function extractStoragesFromHtml(html: string): string[] {
  const found = new Set<string>();
  const re = /\b(128|256|512)\s*GB\b|\b1\s*TB\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[0].toUpperCase().replace(/\s+/g, "");
    if (raw.includes("TB")) found.add("1TB");
    else if (raw.includes("128")) found.add("128GB");
    else if (raw.includes("256")) found.add("256GB");
    else if (raw.includes("512")) found.add("512GB");
  }
  return [...found];
}

export function extractColorsFromHtml(html: string, fallback: string[]): string[] {
  const colors = new Set<string>();
  // aria-label="Black" finish buttons etc.
  const aria = /aria-label="([^"]+)"[^>]*(?:finish|color)|(?:finish|color)[^>]*aria-label="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = aria.exec(html)) !== null) {
    const label = (m[1] || m[2] || "").trim();
    if (label && label.length < 40 && !/select|choose|storage|gb/i.test(label)) {
      colors.add(label);
    }
  }
  if (colors.size >= 2) return [...colors];
  return fallback;
}

/**
 * Build full color × storage variant list with per-storage MRP and color image.
 */
export function buildAppleVariants(opts: {
  modelName: string;
  colorImages?: Record<string, string>;
  htmlStorages?: string[];
  htmlColors?: string[];
  mainImageFallback?: string;
}) {
  const cat = getAppleModelCatalog(opts.modelName);
  const colors =
    (opts.htmlColors && opts.htmlColors.length >= 2
      ? opts.htmlColors
      : cat?.colors) || ["Black", "White"];
  const storageKeys =
    (opts.htmlStorages && opts.htmlStorages.length
      ? opts.htmlStorages.filter((s) => (cat ? cat.storage[s] != null : true))
      : cat
        ? Object.keys(cat.storage)
        : ["256GB"]) || ["256GB"];

  // If filter emptied storages, use catalog
  const storages =
    storageKeys.length > 0
      ? storageKeys
      : cat
        ? Object.keys(cat.storage)
        : ["256GB"];

  const ram = cat?.ram || "8GB";
  const curated = curatedAppleFinishImages(opts.modelName);
  const variants: {
    ram: string;
    storage: string;
    color: string;
    mrp: number;
    reference_image_url: string;
  }[] = [];

  for (const color of colors) {
    const img =
      opts.colorImages?.[color] ||
      Object.entries(opts.colorImages || {}).find(
        ([k]) => k.toLowerCase() === color.toLowerCase()
      )?.[1] ||
      curated[color] ||
      Object.entries(curated).find(
        ([k]) => k.toLowerCase() === color.toLowerCase()
      )?.[1] ||
      (opts.mainImageFallback
        ? toPrimaryFinishImageUrl(opts.mainImageFallback)
        : "");

    for (const storage of storages) {
      const mrp =
        lookupAppleVariantMrp(opts.modelName, storage) ||
        lookupAppleIndiaMrp(opts.modelName) ||
        0;
      variants.push({
        ram,
        storage,
        color,
        mrp,
        reference_image_url: img ? sanitizeAppleImageUrl(img) : "",
      });
    }
  }

  return {
    colors,
    storages,
    ram,
    variants,
    startingMrp: variants.length
      ? Math.min(...variants.map((v) => v.mrp).filter(Boolean))
      : lookupAppleIndiaMrp(opts.modelName),
  };
}

/** Collect gallery of unique single-device images (max n) */
export function collectSingleDeviceGallery(
  html: string,
  colorImages: Record<string, string>,
  main?: string,
  max = 8,
  modelName?: string
): string[] {
  const out: string[] = [];
  const modelSlug = modelName ? modelAssetSlug(modelName) : "";
  const add = (url?: string) => {
    if (!url || isCollageImageUrl(url)) return;
    const upgraded = toPrimaryFinishImageUrl(url);
    if (!out.includes(upgraded)) out.push(upgraded);
  };

  // Color primaries first (one per color — full phone)
  Object.values(colorImages).forEach(add);
  if (main) add(main);

  const urlRe =
    /https?:\/\/[^"'\\\s]+storeimages\.cdn-apple\.com[^"'\\\s]+/gi;
  for (const raw of html.match(urlRe) || []) {
    if (out.length >= max) break;
    const url = raw.replace(/\\u002F/g, "/").replace(/\\\//g, "/");
    if (modelSlug) {
      const p = url.toLowerCase();
      if (modelSlug.endsWith("-pro") && !modelSlug.includes("max")) {
        if (p.includes("pro-max")) continue;
      }
      if (!p.includes(modelSlug) && !p.includes("finish-select")) continue;
    }
    if (isSingleDeviceImageUrl(url) && /finish-select/i.test(url) && !isAlternateAngleUrl(url)) {
      add(url);
    }
  }

  return out.slice(0, max);
}
