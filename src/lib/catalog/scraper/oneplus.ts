/**
 * OnePlus India scraper — prefer official store buy pages which embed
 * `#data-device` (SKU × colour × RAM/storage) and `#data-page` (imageLibrary).
 *
 * Marketing PDPs (`/15`) are JS-heavy and pollute galleries with nav/logo assets;
 * we resolve them to store URLs (`/oneplus-15`) whenever possible.
 *
 * Gallery is capped at 2–3 hero product shots. Each colour gets one accurate
 * packshot from imageLibrary (not nav / buds / pad chrome).
 */

import * as cheerio from "cheerio";
import { isJunkBrandImage } from "./extractProductImages";

export type OnePlusVariant = {
  color: string;
  ram: string;
  storage: string;
  mrp: number;
  sellingPrice: number;
  image: string;
  title: string;
  sourceUrl?: string;
  skuCode?: string;
};

export type OnePlusProduct = {
  modelName: string;
  brandName: string;
  description: string;
  gallery: string[];
  colorImages: Record<string, string>;
  variants: OnePlusVariant[];
  startingMrp: number;
  startingPrice: number;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MAX_GALLERY = 3;

const COLOR_ALIASES: Record<string, string> = {
  sand: "Sand Storm",
  sandy: "Sand Storm",
  sandstone: "Sand Storm",
  sandstorm: "Sand Storm",
  softsand: "Sand Storm",
  black: "Infinite Black",
  infiniteblack: "Infinite Black",
  infinite: "Infinite Black",
  ultraviolet: "Ultra Violet",
  violet: "Ultra Violet",
  purple: "Ultra Violet",
  green: "Green Silk",
  greensilk: "Green Silk",
  pink: "Pink Satin",
  pinksatin: "Pink Satin",
  blackvelvet: "Black Velvet",
  mint: "Mint Breeze",
  mintbreeze: "Mint Breeze",
  breeze: "Mint Breeze",
};

/** Marketing slug → store urlKey */
const STORE_URLKEY: Record<string, string> = {
  "15": "oneplus-15",
  "15r": "oneplus-15r",
  "13s": "oneplus-13s",
  "13r": "oneplus-13r",
  "13": "oneplus-13",
  "nord-6": "oneplus-nord-6",
  "nord-ce-6": "oneplus-nord-ce-6",
  "nord-ce-6-lite": "oneplus-nord-ce-6-lite",
  n6: "oneplus-n6",
  n6x: "oneplus-n6x",
};

export function isOnePlusHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.includes("oneplus.in") || h.includes("oneplus.com");
  } catch {
    return false;
  }
}

export function isOnePlusProductUrl(url: string): boolean {
  if (!isOnePlusHost(url)) return false;
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "") return false;
    if (
      /\/(store|cart|account|support|community|blog|oxygenos|press)\b/i.test(
        path
      )
    ) {
      return false;
    }
    // /15, /oneplus-15, /nord-6, /oneplus-nord-6
    return /^\/[a-z0-9][a-z0-9-]{1,60}$/i.test(path);
  } catch {
    return false;
  }
}

function normalizeColor(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const key = t.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (COLOR_ALIASES[key]) return COLOR_ALIASES[key];
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

function pathSlug(url: string): string {
  try {
    return (new URL(url).pathname.split("/").filter(Boolean).pop() || "")
      .toLowerCase()
      .replace(/\/+$/, "");
  } catch {
    return "";
  }
}

/** Prefer official store buy URL that embeds data-device. */
export function resolveOnePlusStoreUrl(url: string): string {
  try {
    const u = new URL(url);
    const slug = pathSlug(url);
    if (!slug) return url;
    if (slug.startsWith("oneplus-")) {
      return `${u.protocol}//${u.host}/${slug}`;
    }
    const key = STORE_URLKEY[slug] || `oneplus-${slug}`;
    return `${u.protocol}//${u.host}/${key}`;
  } catch {
    return url;
  }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-IN,en;q=0.9",
      Accept: "text/html",
    },
    cache: "no-store",
  });
  if (!res.ok) return "";
  return res.text();
}

type StoreSku = {
  skuCode: string;
  skuName: string;
  skuStatus?: number;
};

type StoreDevice = {
  code?: string;
  name: string;
  urlKey?: string;
  skus: StoreSku[];
};

type ImageLibEntry = {
  skuCode: string;
  images?: string[];
  skuImages?: { mediaType?: string; mediaUrl?: string; mediaAlt?: string }[];
};

function parseStoreDevice(html: string): StoreDevice | null {
  const $ = cheerio.load(html);
  const raw = $("#data-device").html()?.trim();
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data?.name || !Array.isArray(data.skus) || !data.skus.length) return null;
    return data as StoreDevice;
  } catch {
    return null;
  }
}

function parseImageLibrary(html: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const $ = cheerio.load(html);
  const raw = $("#data-page").html()?.trim();
  if (!raw) return map;
  try {
    const data = JSON.parse(raw);
    const libs: ImageLibEntry[] = data?.imageLibrary || [];
    for (const lib of libs) {
      const urls = (lib.images || [])
        .map((u) => String(u || "").trim())
        .filter((u) => /^https?:\/\//i.test(u) && !isJunkBrandImage(u));
      // Prefer first 3 official packshots only
      if (lib.skuCode && urls.length) map.set(lib.skuCode, urls.slice(0, 3));
    }
    // SPU hero as fallback key
    const spu = (data?.spuImageList || [])
      .map((u: string) => String(u || "").trim())
      .filter((u: string) => /^https?:\/\//i.test(u));
    if (spu.length) map.set("__spu__", spu.slice(0, 1));
  } catch {
    /* ignore */
  }
  return map;
}

/** "OnePlus 15 CPH2745 India 12 GB RAM 256 GB ROM Sand Storm IN" */
function parseSkuName(skuName: string): {
  color: string;
  ram: string;
  storage: string;
} | null {
  const t = skuName.replace(/\s+/g, " ").trim();
  const ramM = t.match(/(\d+)\s*GB\s*RAM/i);
  const storM = t.match(/(\d+)\s*GB\s*ROM/i) || t.match(/(\d+)\s*GB(?!\s*RAM)/i);
  if (!ramM || !storM) return null;

  // Colour is the phrase after ROM / before trailing country code
  let colorRaw = "";
  const afterRom = t.match(
    /\d+\s*GB\s*ROM\s+(.+?)(?:\s+IN\b|\s+India\b|$)/i
  );
  if (afterRom?.[1]) {
    colorRaw = afterRom[1]
      .replace(/\b(CPH\d+|IN|India|5G)\b/gi, "")
      .trim();
  }
  if (!colorRaw) {
    // Fallback: known multi-word colours at end
    const known =
      t.match(
        /\b(Sand Storm|Infinite Black|Ultra Violet|Black Velvet|Green Silk|Pink Satin|Mint Breeze|Nebula Noir|Astral Trail|Marble Sands|Phantom Grey)\b/i
      )?.[1] || "";
    colorRaw = known;
  }
  const color = normalizeColor(colorRaw);
  if (!color) return null;
  return {
    color,
    ram: `${ramM[1]}GB`,
    storage: `${storM[1]}GB`,
  };
}

function buildFromStorePage(
  html: string,
  pageUrl: string
): OnePlusProduct | null {
  const device = parseStoreDevice(html);
  if (!device) return null;

  const imageLib = parseImageLibrary(html);
  const $ = cheerio.load(html);
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    `${device.name} from OnePlus India`;

  const colorImages: Record<string, string> = {};
  const variants: OnePlusVariant[] = [];
  const seen = new Set<string>();

  for (const sku of device.skus) {
    const parsed = parseSkuName(sku.skuName);
    if (!parsed) continue;
    const key = `${parsed.color}|${parsed.storage}|${parsed.ram}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const imgs = imageLib.get(sku.skuCode) || [];
    const image = imgs[0] || "";
    if (image && !colorImages[parsed.color]) {
      colorImages[parsed.color] = image;
    }

    variants.push({
      color: parsed.color,
      ram: parsed.ram,
      storage: parsed.storage,
      mrp: 0,
      sellingPrice: 0,
      image,
      title: sku.skuName,
      skuCode: sku.skuCode,
      sourceUrl: pageUrl,
    });
  }

  if (!variants.length) return null;

  // Ensure every colour has an image (copy from any variant)
  for (const v of variants) {
    if (!colorImages[v.color] && v.image) colorImages[v.color] = v.image;
    if (!v.image && colorImages[v.color]) v.image = colorImages[v.color];
  }

  // Gallery: max 2–3 heroes — one per colour in order, then SPU if needed
  const gallery: string[] = [];
  for (const color of Object.keys(colorImages)) {
    const u = colorImages[color];
    if (u && !gallery.includes(u)) gallery.push(u);
    if (gallery.length >= MAX_GALLERY) break;
  }
  const spu = imageLib.get("__spu__")?.[0];
  if (spu && gallery.length < MAX_GALLERY && !gallery.includes(spu)) {
    gallery.push(spu);
  }

  return {
    modelName: device.name,
    brandName: "OnePlus",
    description: description.slice(0, 500),
    gallery,
    colorImages,
    variants,
    startingMrp: 0,
    startingPrice: 0,
  };
}

function hiResFlipkartImage(url: string): string {
  if (!url) return "";
  return url.replace(/\/image\/\d+\/\d+\//, "/image/832/832/");
}

function hiResAmazonImage(url: string): string {
  if (!url) return "";
  return url.replace(/\._AC_[A-Z0-9]+_\./i, "._AC_SL1000_.");
}

function parseInrTokens(text: string): number[] {
  const out: number[] = [];
  const re = /₹\s*([\d,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Math.round(parseFloat(m[1].replace(/,/g, "")));
    if (Number.isFinite(n) && n >= 9999 && n <= 200000) out.push(n);
  }
  return [...new Set(out)];
}

function modelTokens(modelName: string): string[] {
  return modelName
    .toLowerCase()
    .replace(/oneplus/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 1);
}

function isExactOnePlusModel(modelName: string, title: string): boolean {
  const t = title.toLowerCase().replace(/\s+/g, " ");
  if (!/oneplus/i.test(t)) return false;
  if (/case|cover|tempered|glass|charger|cable|buds|earbud|battery for/i.test(t))
    return false;
  if (!/\bnord\b/i.test(modelName) && /\bnord\b/i.test(t)) return false;
  if (!/\bce\b/i.test(modelName) && /\bce\s*\d/i.test(t)) return false;

  const tokens = modelTokens(modelName);
  const compactModel = tokens.join("");
  const compactTitle = t.replace(/[^a-z0-9]/g, "");

  for (const tok of tokens) {
    if (/^\d+[a-z]?$/i.test(tok)) {
      const explicit = new RegExp(`oneplus\\s*${tok}(?![a-z0-9])`, "i");
      if (!explicit.test(t) && !compactTitle.includes(`oneplus${tok}`)) {
        return false;
      }
      if (
        tok === "15" &&
        /oneplus\s*15\s*r\b|oneplus\s*15r\b|oneplus15r/i.test(t)
      ) {
        return false;
      }
    } else if (!t.includes(tok) && !compactTitle.includes(tok)) {
      return false;
    }
  }

  if (/^\d+[a-z]?$/.test(compactModel)) {
    if (!compactTitle.includes(`oneplus${compactModel}`)) return false;
  }
  return true;
}

/** Fill MRP/images from Flipkart when store page has no prices. */
async function lookupMarketplacePrices(
  modelName: string,
  variants: OnePlusVariant[]
): Promise<OnePlusVariant[]> {
  const q = /oneplus/i.test(modelName)
    ? `${modelName} 5G`
    : `OnePlus ${modelName} 5G`;

  const priceByKey = new Map<string, { mrp: number; sell: number; image: string }>();

  // Flipkart
  try {
    const url = `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const $ = cheerio.load(await res.text());
      $("a[href*='/p/']").each((_, el) => {
        const block = $(el).closest("div").text().replace(/\s+/g, " ").trim();
        const titleMatch = block.match(
          /(OnePlus[\w\s+.\-]{2,50}?)(?:\(|Add to|₹|Ratings|Currently)/i
        );
        const title = (titleMatch?.[1] || block).trim().slice(0, 100);
        if (!isExactOnePlusModel(modelName, title) && !isExactOnePlusModel(modelName, block.slice(0, 120))) {
          return;
        }
        const colorM = block.match(/\(([^,()]+),\s*(\d+)\s*GB\)/i);
        const ramM = block.match(/(\d+)\s*GB\s*RAM/i);
        if (!colorM) return;
        const color = normalizeColor(colorM[1]);
        const storage = `${colorM[2]}GB`;
        const ram = ramM ? `${ramM[1]}GB` : "";
        const prices = parseInrTokens(block);
        if (!prices.length) return;
        prices.sort((a, b) => a - b);
        const sell = prices[0];
        let mrp = prices.length > 1 ? prices[prices.length - 1] : sell;
        if (mrp > sell * 3.5) mrp = sell;
        const imgRaw =
          $(el).find("img").attr("src") ||
          $(el).closest("div").find("img").first().attr("src") ||
          "";
        const image = hiResFlipkartImage(
          imgRaw.startsWith("http") ? imgRaw : ""
        );
        const key = `${color}|${storage}|${ram}`.toLowerCase();
        const key2 = `${color}|${storage}|`.toLowerCase();
        priceByKey.set(key, { mrp, sell, image });
        if (!priceByKey.has(key2)) priceByKey.set(key2, { mrp, sell, image });
      });
    }
  } catch {
    /* ignore */
  }

  // Amazon (title: OnePlus15 | 12GB+256GB | Sand Storm | …)
  try {
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(modelName.replace(/\s+/g, ""))}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const html = await res.text();
      if (!/captcha/i.test(html.slice(0, 2000))) {
        const $ = cheerio.load(html);
        $('[data-component-type="s-search-result"]').each((_, el) => {
          const title = (
            $(el).find("h2 a span").first().text() ||
            $(el).find("h2 span").first().text() ||
            $(el).find("h2").text()
          )
            .replace(/\s+/g, " ")
            .trim();
          if (!title || !isExactOnePlusModel(modelName, title)) return;
          const ramStor = title.match(/(\d+)\s*GB\s*\+\s*(\d+)\s*GB/i);
          if (!ramStor) return;
          let color = "";
          for (const phrase of [
            "Sand Storm",
            "Infinite Black",
            "Ultra Violet",
            "Black Velvet",
            "Green Silk",
            "Pink Satin",
            "Mint Breeze",
          ]) {
            if (new RegExp(phrase.replace(/\s+/g, "\\s+"), "i").test(title)) {
              color = phrase;
              break;
            }
          }
          if (!color) {
            const parts = title.split("|").map((p) => p.trim());
            if (parts[2] && !/\d+\s*GB/i.test(parts[2])) {
              color = normalizeColor(parts[2].split(/India|Snapdragon/i)[0]);
            }
          }
          if (!color) return;
          const off =
            $(el).find(".a-price .a-offscreen").first().text() ||
            $(el).find(".a-price-whole").first().text();
          const sell =
            Math.round(parseFloat(String(off).replace(/[^\d.]/g, ""))) || 0;
          if (sell < 15000) return;
          const listRaw =
            $(el).find(".a-text-price .a-offscreen").first().text() || "";
          const list =
            Math.round(parseFloat(String(listRaw).replace(/[^\d.]/g, ""))) ||
            sell;
          const imgRaw = $(el).find("img.s-image").attr("src") || "";
          const image = hiResAmazonImage(
            imgRaw.startsWith("http") ? imgRaw : ""
          );
          const ram = `${ramStor[1]}GB`;
          const storage = `${ramStor[2]}GB`;
          const key = `${normalizeColor(color)}|${storage}|${ram}`.toLowerCase();
          if (!priceByKey.has(key)) {
            priceByKey.set(key, {
              mrp: Math.max(list, sell),
              sell,
              image,
            });
          }
        });
      }
    }
  } catch {
    /* ignore */
  }

  if (!priceByKey.size) return variants;

  return variants.map((v) => {
    const hit =
      priceByKey.get(`${v.color}|${v.storage}|${v.ram}`.toLowerCase()) ||
      priceByKey.get(`${v.color}|${v.storage}|`.toLowerCase());
    if (!hit) return v;
    return {
      ...v,
      mrp: v.mrp > 0 ? v.mrp : hit.mrp,
      sellingPrice: v.sellingPrice > 0 ? v.sellingPrice : hit.sell,
      // Keep official store image; only fill if missing
      image: v.image || hit.image,
    };
  });
}

/**
 * India tier MRP fallback when Flipkart/Amazon HTML is blocked.
 * Sources: Reliance Digital / launch pricing (MRP) + street selling.
 * Keyed by model + storage (colour-agnostic).
 */
const CURATED_INDIA_TIERS: Record<
  string,
  Record<string, { mrp: number; sell: number }>
> = {
  "oneplus 15": {
    "256GB": { mrp: 89999, sell: 72999 },
    "512GB": { mrp: 99999, sell: 79999 },
  },
  "oneplus 15r": {
    "256GB": { mrp: 44999, sell: 39999 },
    "512GB": { mrp: 49999, sell: 44999 },
  },
  "oneplus 13s": {
    "256GB": { mrp: 54999, sell: 39950 },
    "512GB": { mrp: 62999, sell: 44250 },
  },
};

function applyCuratedIndiaPrices(
  modelName: string,
  variants: OnePlusVariant[]
): OnePlusVariant[] {
  const key = modelName.toLowerCase().replace(/\s+/g, " ").trim();
  const tiers =
    CURATED_INDIA_TIERS[key] ||
    CURATED_INDIA_TIERS[key.replace(/^oneplus\s+/, "oneplus ")];
  if (!tiers) return variants;

  return variants.map((v) => {
    if (v.mrp > 0 || v.sellingPrice > 0) return v;
    const tier = tiers[v.storage];
    if (!tier) return v;
    return { ...v, mrp: tier.mrp, sellingPrice: tier.sell };
  });
}

/**
 * Build OnePlus master device — store page first, marketing URL resolved.
 */
export async function fetchOnePlusProduct(
  url: string,
  html?: string
): Promise<OnePlusProduct | null> {
  if (!isOnePlusHost(url)) return null;

  const storeUrl = resolveOnePlusStoreUrl(url);
  const tried = new Set<string>();

  const tryPage = async (pageUrl: string, pageHtml?: string) => {
    if (tried.has(pageUrl)) return null;
    tried.add(pageUrl);
    const h = pageHtml ?? (await fetchHtml(pageUrl));
    if (!h) return null;
    return buildFromStorePage(h, pageUrl);
  };

  // 1) If caller already gave HTML with data-device, use it
  let product: OnePlusProduct | null = null;
  if (html && parseStoreDevice(html)) {
    product = buildFromStorePage(html, url);
  }

  // 2) Fetch resolved store URL
  if (!product) {
    product = await tryPage(storeUrl);
  }

  // 3) Original URL (marketing) — rarely has data-device, but try
  if (!product && url !== storeUrl) {
    product = await tryPage(url, html);
  }

  // 4) Alternate urlKey from original slug
  if (!product) {
    const slug = pathSlug(url);
    if (slug && !slug.startsWith("oneplus-")) {
      product = await tryPage(
        `https://www.oneplus.in/oneplus-${slug.replace(/^oneplus-/, "")}`
      );
    }
  }

  if (!product || !product.variants.length) return null;

  // Fill MRP from marketplaces when store page has none
  const needsPrice = product.variants.every((v) => !v.mrp && !v.sellingPrice);
  if (needsPrice) {
    product.variants = await lookupMarketplacePrices(
      product.modelName,
      product.variants
    );
  }
  // Curated India MRP if marketplaces are empty/blocked
  if (product.variants.every((v) => !v.mrp && !v.sellingPrice)) {
    product.variants = applyCuratedIndiaPrices(
      product.modelName,
      product.variants
    );
  }

  for (const v of product.variants) {
    if (v.image && !product.colorImages[v.color]) {
      product.colorImages[v.color] = v.image;
    }
  }

  const prices = product.variants
    .map((v) => v.mrp || v.sellingPrice)
    .filter((p) => p > 0);
  const sells = product.variants
    .map((v) => v.sellingPrice || v.mrp)
    .filter((p) => p > 0);

  product.startingMrp = prices.length ? Math.min(...prices) : 0;
  product.startingPrice = sells.length ? Math.min(...sells) : 0;

  // Hard-cap gallery
  product.gallery = product.gallery
    .filter((u) => u && !isJunkBrandImage(u))
    .slice(0, MAX_GALLERY);

  return product;
}

/** @deprecated kept for callers that imported Flipkart helper */
export async function lookupOnePlusFlipkartVariants(
  modelName: string
): Promise<OnePlusVariant[]> {
  const shell: OnePlusVariant[] = [];
  return lookupMarketplacePrices(modelName, shell);
}

export async function lookupOnePlusAmazonVariants(
  modelName: string
): Promise<OnePlusVariant[]> {
  return lookupOnePlusFlipkartVariants(modelName);
}
