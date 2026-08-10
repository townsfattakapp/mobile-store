/**
 * Flipkart multi-variant resolver for India phone brands.
 * Returns colour × RAM × storage × MRP × hi-res images when brand PDPs
 * are JS-heavy / incomplete (vivo, OPPO, Xiaomi, POCO, realme, Pixel, iQOO, Moto).
 */

import * as cheerio from "cheerio";

export type MarketplaceVariant = {
  color: string;
  ram: string;
  storage: string;
  mrp: number;
  sellingPrice: number;
  image: string;
  title: string;
  sourceUrl?: string;
};

export type MarketplaceDevice = {
  brandName: string;
  modelName: string;
  variants: MarketplaceVariant[];
  colorImages: Record<string, string>;
  gallery: string[];
  startingMrp: number;
  startingPrice: number;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MAX_GALLERY = 3;

function hiRes(url: string): string {
  if (!url) return "";
  return url.replace(/\/image\/\d+\/\d+\//, "/image/832/832/");
}

function parseInrTokens(text: string): number[] {
  const out: number[] = [];
  const re = /₹\s*([\d,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Math.round(parseFloat(m[1].replace(/,/g, "")));
    if (Number.isFinite(n) && n >= 4999 && n <= 350000) out.push(n);
  }
  return [...new Set(out)];
}

function normalizeColor(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function modelTokens(modelName: string, brandName: string): string[] {
  let s = modelName.toLowerCase();
  const brand = brandName.toLowerCase();
  if (brand) s = s.replace(new RegExp(`\\b${brand}\\b`, "gi"), " ");
  // Google store often says "Pixel" without Google
  s = s
    .replace(/\bgoogle\b/g, " ")
    .replace(/\bpixel\b/g, " pixel ")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
  return s
    .split(/\s+/)
    .filter(
      (t) =>
        t.length >= 1 &&
        !/^(the|and|for|5g|4g|mobile|phone|smartphone|india|official|buy|shop)$/i.test(
          t
        )
    );
}

/** Exact-ish match: Pixel 10 Pro must not match Pro XL / Fold unless queried. */
export function isExactPhoneTitle(
  brandName: string,
  modelName: string,
  title: string
): boolean {
  const t = title.toLowerCase().replace(/\s+/g, " ");
  if (/case|cover|tempered|glass|charger|cable|buds|earbud|strap|screen guard|back cover|spigen/i.test(t)) {
    return false;
  }

  const brand = brandName.toLowerCase();
  if (brand === "google" || brand === "pixel") {
    if (!/pixel/i.test(t)) return false;
  } else if (brand === "xiaomi") {
    if (!/xiaomi|redmi/i.test(t)) return false;
  } else if (brand && !t.includes(brand) && !(brand === "motorola" && /moto/i.test(t))) {
    return false;
  }

  const tokens = modelTokens(modelName, brandName);
  if (!tokens.length) return false;

  for (const tok of tokens) {
    if (/^\d+[a-z]?$/i.test(tok)) {
      const re = new RegExp(`(?:^|[^a-z0-9])${tok}(?:[^a-z0-9]|$)`, "i");
      if (!re.test(t)) return false;
    } else if (tok === "pro" || tok === "plus" || tok === "ultra" || tok === "lite" || tok === "fold" || tok === "xl") {
      // handled below as required extras
    } else if (!t.includes(tok)) {
      return false;
    }
  }

  // Required qualifier extras in query must appear
  for (const extra of ["pro", "plus", "ultra", "lite", "fold", "xl", "fe", "max", "neo", "note"]) {
    const inModel = new RegExp(`(?:^|\\s)${extra}(?:\\s|$)`, "i").test(
      modelName.toLowerCase()
    );
    const inTitle = new RegExp(`(?:^|\\s)${extra}(?:\\s|$)`, "i").test(t);
    if (inModel && !inTitle) return false;
    if (!inModel && inTitle && (extra === "xl" || extra === "fold" || extra === "fe")) {
      // Sibling: Pixel 10 Pro must not match Pro XL / Fold
      return false;
    }
    if (!inModel && inTitle && extra === "ultra" && !/find|x\d/i.test(modelName)) {
      return false;
    }
  }

  return true;
}

function parseFlipkartCard(block: string): {
  color: string;
  ram: string;
  storage: string;
} | null {
  const colorM = block.match(/\(([^,()]+),\s*(\d+)\s*GB\)/i);
  const ramM = block.match(/(\d+)\s*GB\s*RAM/i);
  if (!colorM) return null;
  return {
    color: normalizeColor(colorM[1]),
    storage: `${colorM[2]}GB`,
    ram: ramM ? `${ramM[1]}GB` : "",
  };
}

/**
 * Collect all Flipkart phone SKUs for a brand+model.
 */
export async function lookupFlipkartVariants(
  modelName: string,
  brandName: string
): Promise<MarketplaceVariant[]> {
  const brand = (brandName || "").trim();
  let q = modelName.trim();
  if (brand && !new RegExp(`^${brand}\\b`, "i").test(q)) {
    q = `${brand} ${q}`;
  }
  // Google
  if (/^pixel\b/i.test(q) && !/google/i.test(q)) q = `Google ${q}`;
  if (!/\b5g\b/i.test(q) && !/pixel|iphone/i.test(q)) q = `${q} 5G`;

  const url = `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);

    const seen = new Set<string>();
    const out: MarketplaceVariant[] = [];

    $("a[href*='/p/']").each((_, el) => {
      const href = $(el).attr("href") || "";
      const block = $(el).closest("div").text().replace(/\s+/g, " ").trim();
      const titleMatch = block.match(
        /((?:Samsung|Apple|OnePlus|Google|Pixel|vivo|OPPO|Xiaomi|Redmi|POCO|realme|iQOO|Motorola|Moto|Lava|Nokia|HMD|Nothing)[\w\s+.\-]{2,70}?)(?:\(|Add to|₹|Ratings|Currently)/i
      );
      const title = (titleMatch?.[1] || block).trim().slice(0, 100);
      if (!isExactPhoneTitle(brand || "phone", modelName, title) &&
          !isExactPhoneTitle(brand || "phone", modelName, block.slice(0, 140))) {
        return;
      }

      const parsed = parseFlipkartCard(block) || parseFlipkartCard(title);
      if (!parsed) return;
      if (/photographer kit|bundle|combo|with earbuds|refurbish/i.test(parsed.color)) {
        return;
      }

      const prices = parseInrTokens(block);
      if (!prices.length) return;
      prices.sort((a, b) => a - b);
      const sellingPrice = prices[0];
      let mrp = prices.length > 1 ? prices[prices.length - 1] : sellingPrice;
      if (mrp > sellingPrice * 3.5) mrp = sellingPrice;

      const imgRaw =
        $(el).find("img").attr("src") ||
        $(el).closest("div").find("img").first().attr("src") ||
        "";
      const image = hiRes(imgRaw.startsWith("http") ? imgRaw : "");

      const key = `${parsed.color}|${parsed.storage}|${parsed.ram}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      out.push({
        color: parsed.color,
        ram: parsed.ram || "8GB",
        storage: parsed.storage,
        mrp,
        sellingPrice,
        image,
        title: title.slice(0, 90),
        sourceUrl: href.startsWith("http")
          ? href
          : `https://www.flipkart.com${href}`,
      });
    });

    return out;
  } catch {
    return [];
  }
}

export async function buildMarketplaceDevice(
  modelName: string,
  brandName: string
): Promise<MarketplaceDevice | null> {
  const variants = await lookupFlipkartVariants(modelName, brandName);
  if (!variants.length) return null;

  const colorImages: Record<string, string> = {};
  for (const v of variants) {
    if (v.image && !colorImages[v.color]) colorImages[v.color] = v.image;
  }

  const gallery: string[] = [];
  for (const img of Object.values(colorImages)) {
    if (img && !gallery.includes(img)) gallery.push(img);
    if (gallery.length >= MAX_GALLERY) break;
  }

  const prices = variants.map((v) => v.mrp || v.sellingPrice).filter((p) => p > 0);
  const sells = variants.map((v) => v.sellingPrice || v.mrp).filter((p) => p > 0);

  // Clean model name: strip brand prefix duplication
  let cleanModel = modelName
    .replace(/\s*[|&].*$/, "")
    .replace(/\b(buy|official|india|store).*$/i, "")
    .trim();
  if (!cleanModel) cleanModel = modelName;

  return {
    brandName: brandName || variants[0].title.split(/\s+/)[0],
    modelName: cleanModel,
    variants,
    colorImages,
    gallery,
    startingMrp: prices.length ? Math.min(...prices) : 0,
    startingPrice: sells.length ? Math.min(...sells) : 0,
  };
}

/** Heuristic: scrape result is too weak to publish as-is. */
export function isWeakPhoneScrape(device: {
  model_name?: string;
  main_image_url?: string;
  variants?: any[];
  specifications?: any;
  source_provider?: string;
}): boolean {
  const name = String(device.model_name || "");
  if (!name || name.length < 2) return true;
  // Hub / SEO pollution
  if (
    /\bIndia\b$/i.test(name) ||
    /official site|explore|smartphones with|store pixel|pro\s*&\s*pixel/i.test(
      name
    ) ||
    /200MP Ultra Clarity|realme India$/i.test(name)
  ) {
    return true;
  }
  if (/&/.test(name) && /pixel|pro/i.test(name)) return true;

  const variants = device.variants || [];
  if (!variants.length) return true;

  const onlyFake =
    variants.length === 1 &&
    /^standard$/i.test(String(variants[0].color || "")) &&
    (/^8\s*GB$/i.test(String(variants[0].ram || "")) ||
      !variants[0].ram) &&
    (/^128\s*GB$/i.test(String(variants[0].storage || "")) ||
      !variants[0].storage);

  const noMrp =
    !Number((device.specifications as any)?.mrp) &&
    variants.every((v: any) => !Number(v.mrp) && !Number(v.selling_price));

  const badImage =
    !device.main_image_url ||
    /logo|icon|favicon|placeholder|shield/i.test(device.main_image_url);

  if (onlyFake) return true;
  // Official vivo e-store Nuxt scrape is authoritative — don't Flipkart-rewrite
  if (/scraper_vivo_shop/i.test(String(device.source_provider || ""))) return false;
  if (onlyFake || (noMrp && badImage)) return true;
  if (variants.every((v: any) => /^standard$/i.test(String(v.color || ""))) &&
      variants.length <= 2) {
    return true;
  }
  return false;
}

/** Map Flipkart device onto MasterDevice-shaped partial. */
export function marketplaceDeviceToPartial(
  device: MarketplaceDevice,
  sourceProvider = "scraper_marketplace"
): any {
  const main =
    device.gallery[0] ||
    Object.values(device.colorImages)[0] ||
    "";
  return {
    brand_id: "",
    brand_name: device.brandName,
    model_name: device.modelName
      .replace(new RegExp(`^${device.brandName}\\s+`, "i"), "")
      .trim() || device.modelName,
    slug: `${device.brandName}-${device.modelName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 80),
    release_year: new Date().getFullYear(),
    source_provider: sourceProvider,
    specifications: {
      processor: "—",
      display: "—",
      camera: "—",
      battery: "—",
      os: "Android",
      dimensions: "—",
      weight: "—",
      description: `${device.brandName} ${device.modelName}`,
      gallery_images: device.gallery,
      color_images: device.colorImages,
      mrp: device.startingMrp || undefined,
      selling_price: device.startingPrice || undefined,
      currency: "INR",
      price_source: "marketplace_flipkart",
      product_type: "mobile",
    },
    main_image_url: main,
    variants: device.variants.map((v) => ({
      id: "",
      master_device_id: "",
      ram: v.ram,
      storage: v.storage,
      color: v.color,
      reference_image_url: v.image || device.colorImages[v.color] || main,
      mrp: v.mrp || undefined,
      selling_price: v.sellingPrice || undefined,
    })),
  };
}
