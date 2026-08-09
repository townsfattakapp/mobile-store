import type { MasterDevice } from "../../CatalogProvider";
import type { ScraperAdapter } from "../ScraperEngine";
import {
  absShopifyImage,
  fetchShopifyProductJs,
  shopifyProductHandle,
  type ShopifyJsonProduct,
} from "../shopify";
import { isJunkBrandImage } from "../extractProductImages";

const REFIT_HOST = /refitglobal\.com/i;

/** Preferred refurbished grades (best first) when collapsing Refit variants. */
const GRADE_RANK = ["very good", "superb", "excellent", "good", "fair", "okay"];

function rankGrade(grade: string) {
  const g = grade.toLowerCase().trim();
  const idx = GRADE_RANK.findIndex((x) => g.includes(x) || x.includes(g));
  return idx === -1 ? 50 : idx;
}

function parseRamStorage(sizeRaw: string): { ram: string; storage: string } {
  const raw = String(sizeRaw || "").trim();
  // "4GB|128GB" or "8 GB / 256 GB"
  const pipe = raw.match(/(\d+)\s*GB\s*[|/]\s*(\d+)\s*GB/i);
  if (pipe) return { ram: `${pipe[1]}GB`, storage: `${pipe[2]}GB` };
  const storageOnly = raw.match(/(\d+)\s*(GB|TB)/i);
  if (storageOnly) {
    return {
      ram: "",
      storage: `${storageOnly[1]}${storageOnly[2].toUpperCase()}`,
    };
  }
  return { ram: "", storage: raw || "Standard" };
}

function cleanRefitTitle(title: string, vendor?: string) {
  let name = String(title || "")
    .replace(/\b(refurbished|renewed|pre[-\s]?owned|certified)\b/gi, " ")
    .replace(/\b(4g|5g)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (vendor) {
    const v = vendor.trim();
    if (v && !new RegExp(`^${v}\\b`, "i").test(name)) {
      // keep vendor separate as brand; don't force into name
    }
  }
  return name || title;
}

function detectAccessory(title: string, tags: string[], productType: string) {
  const blob = `${title} ${tags.join(" ")} ${productType}`.toLowerCase();
  if (/phone|iphone|galaxy|pixel|reno|nord|redmi|realme|vivo|oppo|nothing|oneplus|motorola|iqoo/.test(blob)) {
    return false;
  }
  return /earbud|earphone|charger|cable|cover|case|power\s*bank|adapter|watch|band|glass|tempered|stand|holder/.test(
    blob
  );
}

/**
 * Dedicated Refit Global (Shopify) scraper.
 * Collapses Grade × Color × Size into Color × Storage variants with preferred grade pricing.
 */
export class RefitGlobalAdapter implements ScraperAdapter {
  match(url: string): boolean {
    try {
      return REFIT_HOST.test(new URL(url).hostname);
    } catch {
      return REFIT_HOST.test(url);
    }
  }

  async scrape(url: string, _html: string): Promise<Partial<MasterDevice> | null> {
    if (!shopifyProductHandle(url)) return null;
    const product = await fetchShopifyProductJs(url);
    if (!product?.title) return null;
    return this.fromProduct(product, url);
  }

  private fromProduct(
    product: ShopifyJsonProduct,
    url: string
  ): Partial<MasterDevice> {
    const brandName = (product.vendor || "Unknown").replace(/\s+India$/i, "").trim();
    const modelName = cleanRefitTitle(product.title, brandName);
    const isAccessory = detectAccessory(
      product.title,
      product.tags || [],
      product.product_type || ""
    );

    const options = product.options || [];
    const gradeOpt = options.find((o) => /grade|condition|quality/i.test(o.name));
    const colorOpt = options.find((o) => /color|colour|finish/i.test(o.name));
    const sizeOpt = options.find(
      (o) => /size|storage|memory|ram|variant/i.test(o.name) && o !== gradeOpt && o !== colorOpt
    );

    const images = (product.images || [])
      .map((i) => absShopifyImage(i.src))
      .filter((u) => u && !isJunkBrandImage(u));

    type Row = {
      grade: string;
      color: string;
      ram: string;
      storage: string;
      price: number;
      mrp: number;
      available: boolean;
      image: string;
    };

    const rows: Row[] = (product.variants || []).map((v) => {
      const opts = [v.option1, v.option2, v.option3].map((x) => String(x || "").trim());
      let grade = "Standard";
      let color = "Standard";
      let sizeRaw = "";

      if (gradeOpt) {
        const gi = options.indexOf(gradeOpt);
        grade = opts[gi] || grade;
      }
      if (colorOpt) {
        const ci = options.indexOf(colorOpt);
        color = opts[ci] || color;
      }
      if (sizeOpt) {
        const si = options.indexOf(sizeOpt);
        sizeRaw = opts[si] || "";
      } else {
        // Fallback parse from title "Very Good / Black / 4GB|128GB"
        const parts = String(v.title || "").split("/").map((p) => p.trim());
        if (parts.length >= 3) {
          grade = parts[0] || grade;
          color = parts[1] || color;
          sizeRaw = parts[2] || "";
        } else if (parts.length === 2) {
          color = parts[0];
          sizeRaw = parts[1];
        }
      }

      const { ram, storage } = parseRamStorage(sizeRaw);
      const price = Math.round(parseFloat(v.price) || 0);
      const mrp = Math.round(parseFloat(v.compare_at_price || "") || price);
      const vImg = absShopifyImage(v.featured_image?.src);

      return {
        grade,
        color: color || "Standard",
        ram,
        storage: storage || "Standard",
        price,
        mrp: mrp || price,
        available: Boolean(v.available),
        image: (vImg && !isJunkBrandImage(vImg) ? vImg : "") || images[0] || "",
      };
    });

    // Collapse grade into color×storage, preferring better grade + available stock
    const best = new Map<string, Row>();
    for (const row of rows) {
      if (!row.price && !row.mrp) continue;
      const key = `${row.color.toLowerCase()}::${row.ram}::${row.storage}`.toLowerCase();
      const prev = best.get(key);
      if (!prev) {
        best.set(key, row);
        continue;
      }
      const prevScore =
        (prev.available ? 1000 : 0) - rankGrade(prev.grade) * 10 - prev.price / 1e6;
      const nextScore =
        (row.available ? 1000 : 0) - rankGrade(row.grade) * 10 - row.price / 1e6;
      if (nextScore > prevScore) best.set(key, row);
    }

    const variants = [...best.values()].map((row) => ({
      id: "",
      master_device_id: "",
      ram: row.ram,
      storage: row.storage,
      color: row.grade && row.grade !== "Standard" ? `${row.color} (${row.grade})` : row.color,
      reference_image_url: row.image,
      mrp: row.mrp,
      selling_price: row.price,
    }));

    const colorImages: Record<string, string> = {};
    for (const v of variants) {
      const baseColor = String(v.color || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
      if (v.reference_image_url && baseColor && !colorImages[baseColor]) {
        colorImages[baseColor] = v.reference_image_url;
      }
    }

    const prices = variants.map((v) => Number(v.selling_price) || 0).filter((p) => p > 0);
    const mrps = variants.map((v) => Number(v.mrp) || 0).filter((p) => p > 0);
    const starting = prices.length ? Math.min(...prices) : 0;
    const startingMrp = mrps.length ? Math.min(...mrps) : starting;

    const grades = [...new Set(rows.map((r) => r.grade).filter(Boolean))];
    const description = (product.body_html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);

    const slug = `refit-${brandName}-${modelName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    return {
      brand_id: "",
      brand_name: brandName,
      model_name: modelName,
      slug,
      release_year: new Date().getFullYear(),
      source_provider: "scraper_refitglobal",
      main_image_url: images[0] || variants[0]?.reference_image_url || "",
      variants: variants.length
        ? (variants as any)
        : [
            {
              id: "",
              master_device_id: "",
              ram: "",
              storage: "Standard",
              color: "Standard",
              reference_image_url: images[0] || "",
              mrp: startingMrp,
              selling_price: starting,
            },
          ],
      specifications: {
        product_type: isAccessory ? "accessory" : "used_mobile",
        condition_source: "refitglobal",
        available_grades: grades,
        processor: isAccessory ? product.product_type || "Accessory" : "See specs",
        display: isAccessory ? "N/A" : "See specs",
        camera: isAccessory ? "N/A" : "See specs",
        battery: isAccessory ? "N/A" : "See specs",
        os: isAccessory ? "N/A" : "See specs",
        dimensions: "See Official Website",
        description:
          description ||
          `${modelName} — certified refurbished listing imported from Refit Global.`,
        mrp: startingMrp,
        selling_price: starting,
        currency: "INR",
        price_source: "refitglobal_shopify",
        source_url: url,
        gallery_images: images,
        color_images: colorImages,
        main_image_url: images[0] || "",
        colors: [...new Set(variants.map((v) => String(v.color).replace(/\s*\([^)]*\)\s*$/, "").trim()))],
        storages: [...new Set(variants.map((v) => v.storage).filter(Boolean))],
        variant_pricing: variants.map((v) => ({
          color: v.color,
          storage: v.storage,
          ram: v.ram,
          mrp: v.mrp,
          selling_price: v.selling_price,
          image: v.reference_image_url,
        })),
      },
    };
  }
}
