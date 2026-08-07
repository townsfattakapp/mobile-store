/**
 * Motorola India (VTEX) — parse SKU matrix from PDP HTML __STATE__ / item blobs.
 * Fallback: Flipkart colour × storage via marketplaceVariants.
 */

import {
  buildMarketplaceDevice,
  marketplaceDeviceToPartial,
} from "./marketplaceVariants";

export function isMotorolaHost(url: string): boolean {
  try {
    return new URL(url).hostname.includes("motorola.in");
  } catch {
    return false;
  }
}

export function isMotorolaProductUrl(url: string): boolean {
  if (!isMotorolaHost(url)) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\/p\/?$/.test(path) || /\/p\?/.test(url) || /smartphones-.+\/p/i.test(path);
  } catch {
    return false;
  }
}

export function isMotorolaHubUrl(url: string): boolean {
  if (!isMotorolaHost(url)) return false;
  if (isMotorolaProductUrl(url)) return false;
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
    return path === "/" || path === "" || /\/(smartphones|phones)?$/i.test(path);
  } catch {
    return false;
  }
}

type MotoSku = {
  color: string;
  ram: string;
  storage: string;
  price: number;
  mrp: number;
  image: string;
  name: string;
};

/** "motorola edge 70 max 12+256GB PANTONE Dark Shadow" */
function parseMotoSkuName(name: string): {
  color: string;
  ram: string;
  storage: string;
} | null {
  const t = name.replace(/\s+/g, " ").trim();
  const mem = t.match(/(\d+)\s*\+\s*(\d+)\s*GB/i);
  if (!mem) return null;
  const ram = `${mem[1]}GB`;
  const storage = `${mem[2]}GB`;
  let color = "";
  const pantone = t.match(/PANTONE\s+(.+)$/i);
  if (pantone) color = pantone[1].trim();
  else {
    // trailing colour words after storage
    const after = t.split(/GB/i).pop() || "";
    color = after.replace(/^\s*[\d+]*\s*/, "").trim();
  }
  color = color
    .replace(/\bPANTONE\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!color || color.length < 2) color = "Standard";
  return { color, ram, storage };
}

function extractMotoSkus(html: string): {
  modelName: string;
  skus: MotoSku[];
} {
  const modelName =
    html.match(/"productName":"([^"]+)"/)?.[1] ||
    html.match(/property="og:title"\s+content="([^"|]+)/i)?.[1]?.split("|")[0]?.trim() ||
    "";

  const skus: MotoSku[] = [];
  const seen = new Set<string>();

  // item nameComplete blobs
  const re =
    /"itemId":"(\d+)","name":"([^"]+)","nameComplete":"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const full = m[3] || m[2];
    const parsed = parseMotoSkuName(full);
    if (!parsed) continue;
    const key = `${parsed.color}|${parsed.storage}|${parsed.ram}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skus.push({
      ...parsed,
      price: 0,
      mrp: 0,
      image: "",
      name: full,
    });
  }

  // prices from sellers
  const low = Number(html.match(/"lowPrice":([\d.]+)/)?.[1] || 0);
  const high = Number(html.match(/"highPrice":([\d.]+)/)?.[1] || 0);
  if (low > 0) {
    for (const s of skus) {
      if (!s.price) {
        s.price = low;
        s.mrp = high > low ? high : low;
      }
    }
  }

  // og:image as shared fallback
  const og =
    html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] || "";
  if (og) {
    for (const s of skus) {
      if (!s.image) s.image = og;
    }
  }

  // Per-image urls in vtex assets near color
  const imgRe =
    /https:\/\/motorolain\.vtexassets\.com\/arquivos\/ids\/\d+\/[^"'\\\s]+\.(?:png|jpe?g|webp)/gi;
  const imgs = [...new Set(html.match(imgRe) || [])].slice(0, 12);
  if (imgs.length && skus.length) {
    // assign first unique images round-robin to colours
    const byColor = new Map<string, string>();
    let i = 0;
    for (const s of skus) {
      if (!byColor.has(s.color) && imgs[i]) {
        byColor.set(s.color, imgs[i]);
        i++;
      }
    }
    for (const s of skus) {
      s.image = byColor.get(s.color) || s.image || og;
    }
  }

  return { modelName: modelName.replace(/\s+/g, " ").trim(), skus };
}

export async function fetchMotorolaProduct(
  url: string,
  html?: string
): Promise<any | null> {
  if (!isMotorolaHost(url)) return null;
  if (isMotorolaHubUrl(url)) return null;

  let page = html || "";
  if (!page) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept-Language": "en-IN,en;q=0.9",
        },
        cache: "no-store",
      });
      if (res.ok) page = await res.text();
    } catch {
      /* marketplace fallback */
    }
  }

  if (page) {
    const { modelName, skus } = extractMotoSkus(page);
    if (modelName && skus.length >= 1) {
      const colorImages: Record<string, string> = {};
      for (const s of skus) {
        if (s.image && !colorImages[s.color]) colorImages[s.color] = s.image;
      }
      const gallery = Object.values(colorImages).slice(0, 3);
      const prices = skus.map((s) => s.mrp || s.price).filter((p) => p > 0);
      const sells = skus.map((s) => s.price || s.mrp).filter((p) => p > 0);
      const main = gallery[0] || "";

      // Fill missing prices from Flipkart if needed
      let variants = skus.map((s) => ({
        id: "",
        master_device_id: "",
        ram: s.ram,
        storage: s.storage,
        color: s.color,
        reference_image_url: s.image || main,
        mrp: s.mrp || s.price || undefined,
        selling_price: s.price || s.mrp || undefined,
      }));

      if (variants.every((v) => !v.mrp)) {
        const fk = await buildMarketplaceDevice(modelName, "Motorola");
        if (fk?.variants.length) {
          // Prefer VTEX colours; stamp prices from FK by storage
          const priceByStorage = new Map<string, { mrp: number; sell: number; image: string }>();
          for (const v of fk.variants) {
            if (!priceByStorage.has(v.storage)) {
              priceByStorage.set(v.storage, {
                mrp: v.mrp,
                sell: v.sellingPrice,
                image: v.image,
              });
            }
            if (v.image && !colorImages[v.color]) colorImages[v.color] = v.image;
          }
          variants = variants.map((v) => {
            const p = priceByStorage.get(v.storage);
            return {
              ...v,
              mrp: v.mrp || p?.mrp,
              selling_price: v.selling_price || p?.sell,
              reference_image_url:
                v.reference_image_url || colorImages[v.color] || p?.image || main,
            };
          });
        }
      }

      const starting =
        prices.length ? Math.min(...prices) : sells.length ? Math.min(...sells) : Number(variants[0]?.mrp) || 0;

      return {
        brand_id: "",
        brand_name: "Motorola",
        model_name: modelName.replace(/^motorola\s+/i, "").trim() || modelName,
        slug: `motorola-${modelName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        release_year: new Date().getFullYear(),
        source_provider: "scraper_motorola",
        specifications: {
          processor: "—",
          display: "—",
          camera: "—",
          battery: "—",
          os: "Android",
          dimensions: "—",
          weight: "—",
          description: `${modelName} from Motorola India`,
          gallery_images: (gallery.length ? gallery : Object.values(colorImages)).slice(0, 3),
          color_images: colorImages,
          mrp: starting || undefined,
          selling_price: sells.length ? Math.min(...sells) : starting || undefined,
          currency: "INR",
          price_source: starting ? "motorola_vtex" : undefined,
          product_type: "mobile",
        },
        main_image_url: main || Object.values(colorImages)[0] || "",
        variants,
      };
    }
  }

  // URL slug → marketplace
  try {
    const slug = new URL(url).pathname
      .replace(/\/p\/?$/, "")
      .split("/")
      .filter(Boolean)
      .pop() || "";
    const model = slug
      .replace(/^smartphones-?/i, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (model) {
      const fk = await buildMarketplaceDevice(model, "Motorola");
      if (fk) return marketplaceDeviceToPartial(fk, "scraper_motorola");
    }
  } catch {
    /* ignore */
  }
  return null;
}
