/**
 * vivo Official E-Store (shop.vivo.com) — Nuxt SSR `__NUXT__` product payloads.
 * Listing: https://shop.vivo.com/in/products/phone
 * PDP:     https://shop.vivo.com/in/product/{spuId}?skuId={skuId}
 */

import type { BrandCatalogItem } from "./brandCatalogs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const IMG_CDN = "https://exstatic-in.vivo.com/";

export type VivoShopCatalogItem = BrandCatalogItem & {
  image?: string;
  spuId?: number;
  skuId?: number;
};

function item(
  brand: string,
  name: string,
  url: string,
  extra?: { image?: string; spuId?: number; skuId?: number }
): VivoShopCatalogItem {
  return { brand, name, url, ...extra };
}

export function isVivoShopHost(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes("shop.vivo.com");
  } catch {
    return false;
  }
}

export function isVivoShopListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "/";
    if (host.includes("shop.vivo.com") && /\/products\/phone$/i.test(path)) {
      return true;
    }
    if (
      host.includes("vivo.com") &&
      !host.includes("shop.") &&
      (path === "/" || path === "/in" || /\/products\/?$/i.test(path))
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isVivoShopProductUrl(url: string): boolean {
  if (!isVivoShopHost(url)) return false;
  try {
    return /\/product\/\d+/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function absVivoImage(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;
  return `${IMG_CDN}${s.replace(/^\//, "")}`;
}

function parseNuxtPayload(html: string): any | null {
  const m = html.match(/window\.__NUXT__\s*=([\s\S]*?);\s*<\/script>/i);
  if (!m?.[1]) return null;
  try {
    // Nuxt SSR payload is a JS object literal (not strict JSON)
    // eslint-disable-next-line no-new-func
    return new Function(`return (${m[1]})`)();
  } catch {
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
}

function prettyVivoModelName(raw: string): string {
  let n = String(raw || "")
    .replace(/[_]+/g, " ")
    .replace(/photographer\s*kit/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return "";
  if (/^iqoo\b/i.test(n)) return ""; // leave iQOO to iQOO scraper
  if (!/^vivo\b/i.test(n)) n = `vivo ${n}`;
  return n
    .replace(/^vivo\b/i, "vivo")
    .replace(/\b5g\b/gi, "5G")
    .replace(/\bfe\b/gi, "FE")
    .replace(/\bpro\b/gi, "Pro")
    .replace(/\bultra\b/gi, "Ultra")
    .replace(/\belite\b/gi, "Elite")
    .replace(/\slite\b/gi, " Lite")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyVivo(name: string, spuId: number): string {
  const base =
    name
      .toLowerCase()
      .replace(/^vivo\s+/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `model`;
  return `vivo-${base}-${spuId}`.replace(/-+/g, "-");
}

function collectImagePaths(sku: any): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (!v) return;
    if (typeof v === "string" && v.length > 8) {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) push(typeof x === "string" ? x : (x as any)?.url || (x as any)?.src);
    }
  };
  push(sku?.defaultImage);
  push(sku?.imageUrls);
  push(sku?.picBarrierFreeList);
  return [...new Set(out.map((p) => absVivoImage(p)).filter(Boolean))];
}

/**
 * Phone listing from Nuxt SSR `data[0].productList`.
 * Product URLs point at real e-store PDPs (not www.vivo.com marketing pages).
 */
export async function fetchVivoShopCatalog(
  pageUrl = "https://shop.vivo.com/in/products/phone"
): Promise<VivoShopCatalogItem[]> {
  try {
    const listingUrl = isVivoShopHost(pageUrl)
      ? pageUrl.includes("/products/phone")
        ? pageUrl
        : "https://shop.vivo.com/in/products/phone"
      : "https://shop.vivo.com/in/products/phone";

    const res = await fetch(listingUrl, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const html = await res.text();
    const nuxt = parseNuxtPayload(html);
    const productList: any[] =
      nuxt?.data?.[0]?.productList ||
      nuxt?.state?.productList ||
      [];

    const out: VivoShopCatalogItem[] = [];
    const seen = new Set<string>();

    for (const p of productList) {
      const spuId = Number(p?.spuId);
      if (!Number.isFinite(spuId) || spuId <= 0) continue;
      const titleRaw = String(p?.titleName || p?.shortName || p?.name || "").trim();
      const name = prettyVivoModelName(titleRaw);
      if (!name) continue; // skips iQOO + empty

      const skuId = Number(p?.defaultSkuId || p?.skuId) || undefined;
      const url = skuId
        ? `https://shop.vivo.com/in/product/${spuId}?skuId=${skuId}`
        : `https://shop.vivo.com/in/product/${spuId}`;
      const key = `spu:${spuId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const imgPath =
        p?.defaultImage ||
        (typeof p?.imageUrls === "string" ? p.imageUrls : p?.imageUrls?.[0]) ||
        "";
      out.push(
        item("vivo", name, url, {
          image: absVivoImage(imgPath) || undefined,
          spuId,
          skuId,
        })
      );
    }

    return out;
  } catch {
    return [];
  }
}

/**
 * Full SKU matrix (colour × RAM × storage + official MRP / promo prices + images).
 */
export async function fetchVivoShopProduct(url: string): Promise<any | null> {
  if (!isVivoShopProductUrl(url)) return null;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const nuxt = parseNuxtPayload(html);
    const detail = nuxt?.state?.productDetail;
    const spu = detail?.spuInfo;
    if (!spu?.spuId) return null;

    const titleRaw = String(spu.titleName || spu.shortName || "").trim();
    const modelName = prettyVivoModelName(titleRaw);
    if (!modelName) return null;

    const skuList: any[] = Array.isArray(spu.skuList)
      ? spu.skuList
      : Array.isArray(detail?.skuList)
        ? detail.skuList
        : [];

    const colorImages: Record<string, string> = {};
    const gallery: string[] = [];
    const variants = skuList
      .map((sku) => {
        const color = String(sku.colorName || "Standard").trim() || "Standard";
        const ram = String(sku.ramName || "").trim();
        const storage = String(sku.romName || "").trim();
        const mrp = Number(sku.salePrice) || 0;
        const selling =
          Number(sku.proPrice) ||
          Number(sku.skuPromotion?.promotionPrice) ||
          mrp ||
          0;
        const imgs = collectImagePaths(sku);
        const main = imgs[0] || "";
        if (main && !colorImages[color]) colorImages[color] = main;
        for (const img of imgs.slice(0, 4)) {
          if (img && !gallery.includes(img)) gallery.push(img);
        }
        return {
          id: "",
          master_device_id: "",
          ram,
          storage,
          color,
          reference_image_url: main,
          mrp,
          selling_price: selling,
        };
      })
      .filter((v) => v.color || v.storage || v.ram);

    if (!variants.length) return null;

    const startingMrp =
      variants.map((v) => v.mrp).filter((n) => n > 0).sort((a, b) => a - b)[0] ||
      Number(spu.salePrice) ||
      0;
    const startingSell =
      variants
        .map((v) => v.selling_price)
        .filter((n) => n > 0)
        .sort((a, b) => a - b)[0] ||
      Number(spu.promotionPrice) ||
      startingMrp;

    const brief = String(
      skuList[0]?.brief || skuList[0]?.shortBrief || spu.brief || ""
    )
      .replace(/\s*\|\s*/g, ". ")
      .replace(/\s+/g, " ")
      .trim();

    const mainImageUrl =
      gallery[0] ||
      colorImages[Object.keys(colorImages)[0]] ||
      absVivoImage(skuList[0]?.defaultImage);

    return {
      brand_id: "",
      brand_name: "Vivo",
      model_name: modelName.replace(/^vivo\s+/i, "").trim() || modelName,
      slug: slugifyVivo(modelName, Number(spu.spuId)),
      release_year: new Date().getFullYear(),
      source_provider: "scraper_vivo_shop",
      source_external_id: String(spu.spuId),
      specifications: {
        processor: "—",
        display: "—",
        camera: "—",
        battery: "—",
        os: "OriginOS",
        dimensions: "—",
        weight: "—",
        description: brief || `${modelName} — vivo Official E-Store`,
        gallery_images: gallery.slice(0, 16),
        color_images: colorImages,
        mrp: startingMrp || undefined,
        selling_price: startingSell || undefined,
        currency: "INR",
        price_source: "vivo_shop_nuxt",
        product_type: "mobile",
        source_url: `https://shop.vivo.com/in/product/${spu.spuId}`,
        variant_pricing: variants.map((v) => ({
          color: v.color,
          storage: v.storage,
          ram: v.ram,
          mrp: v.mrp,
          selling_price: v.selling_price,
          image: v.reference_image_url,
        })),
      },
      main_image_url: mainImageUrl,
      variants: variants as any,
    };
  } catch {
    return null;
  }
}
