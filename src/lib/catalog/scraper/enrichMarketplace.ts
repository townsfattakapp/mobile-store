import {
  applyMarketplaceOffer,
  lookupMarketplaceMrp,
} from "./marketplaceMrp";
import { isJunkBrandImage } from "./extractProductImages";

/**
 * Fill missing MRP / image from Flipkart → Amazon after a brand scrape.
 * Also synthesizes a minimal device when scrape returned nothing but we have a name.
 */
export async function enrichWithMarketplacePricing<
  T extends {
    model_name?: string;
    brand_name?: string;
    main_image_url?: string;
    source_provider?: string;
    slug?: string;
    release_year?: number;
    specifications?: any;
    variants?: any[];
  }
>(fetched: T | null, opts?: { brandHint?: string; nameHint?: string }): Promise<T | null> {
  const brand =
    opts?.brandHint ||
    (fetched as any)?.brand_name ||
    "";
  let name =
    fetched?.model_name ||
    opts?.nameHint ||
    "";

  // "15" → "OnePlus 15" for marketplace search quality
  if (
    brand &&
    name &&
    !new RegExp(`^${brand}\\b`, "i").test(name)
  ) {
    name = `${brand} ${name}`.replace(/\s+/g, " ").trim();
  }

  if (!name && !fetched) return null;

  const needsMrp =
    !fetched ||
    !Number((fetched.specifications as any)?.mrp) ||
    Number((fetched.specifications as any)?.mrp) <= 0 ||
    ((fetched.variants || []).length > 0 &&
      (fetched.variants || []).every((v: any) => !Number(v.mrp) && !Number(v.selling_price)));

  const needsImage =
    !fetched?.main_image_url ||
    isJunkBrandImage(fetched.main_image_url || "");

  if (!needsMrp && !needsImage && fetched) return fetched;

  const offer = await lookupMarketplaceMrp(name || String(opts?.nameHint), brand);
  if (!offer) {
    // Still return a synthetic shell if scrape failed entirely
    if (!fetched && name) {
      return {
        brand_name: brand || name.split(" ")[0],
        model_name: name,
        slug: `${brand || "phone"}-${name}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-"),
        release_year: new Date().getFullYear(),
        source_provider: "marketplace_shell",
        specifications: {
          processor: "—",
          display: "—",
          camera: "—",
          battery: "—",
          os: "Android",
          dimensions: "—",
          weight: "—",
          description: `${name} (details from marketplace lookup pending)`,
          product_type: "mobile",
          currency: "INR",
        },
        main_image_url: "",
        variants: [
          {
            id: "",
            master_device_id: "",
            ram: "",
            storage: "",
            color: "Standard",
          },
        ],
      } as T;
    }
    return fetched;
  }

  if (!fetched) {
    return applyMarketplaceOffer(
      {
        brand_name: brand || offer.title.split(" ")[0],
        model_name: name || offer.title.split("(")[0].trim(),
        slug: (name || offer.title)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 80),
        release_year: new Date().getFullYear(),
        source_provider: `marketplace_${offer.source}`,
        specifications: {
          processor: "—",
          display: "—",
          camera: "—",
          battery: "—",
          os: "Android",
          dimensions: "—",
          weight: "—",
          description: `Pricing from ${offer.source}`,
          product_type: "mobile",
          currency: "INR",
        },
        main_image_url: offer.imageUrl || "",
        variants: [
          {
            id: "",
            master_device_id: "",
            ram: "",
            storage: "",
            color: "Standard",
            mrp: offer.mrp,
            selling_price: offer.sellingPrice,
            reference_image_url: offer.imageUrl || "",
          },
        ],
      } as any,
      offer,
      isJunkBrandImage
    ) as T;
  }

  return applyMarketplaceOffer(fetched as any, offer, isJunkBrandImage) as T;
}

/** Guess model name from a product URL slug */
export function modelNameFromProductUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    // Google Store: /product/pixel_10_pro
    const google = path.match(/\/product\/(pixel[^/]+)/i);
    if (google) {
      return google[1]
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bXl\b/g, "XL");
    }
    // OPPO: /product/oppo-find-x9-ultra.P.P1110142
    const oppo = path.match(/\/product\/([^/]+)/i);
    if (oppo && u.hostname.includes("oppo.com")) {
      return oppo[1]
        .replace(/\.P\..*$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\b5g\b/gi, "5G");
    }
    // iQOO: /products/iqoo15  /products/neo10r  (+ optional ?condition=refurbished)
    if (u.hostname.includes("iqoo.com")) {
      const last = path.split("/").filter(Boolean).pop() || "";
      let name = last.replace(/[-_]+/g, " ");
      if (/^iqoo\d/i.test(last)) {
        name = last
          .replace(/^iqoo/i, "iQOO ")
          .replace(/([a-z])(\d)/gi, "$1 $2")
          .replace(/(\d)\s*r$/i, "$1R");
      } else if (/^neo/i.test(last)) {
        name = `iQOO ${name}`
          .replace(/\bneo\b/gi, "Neo")
          .replace(/(\d)\s*r\b/i, "$1R");
      } else if (/^z\d/i.test(last)) {
        name = `iQOO ${name}`;
      }
      name = name
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\bIqoo\b/g, "iQOO")
        .replace(/\bNeo\b/g, "Neo")
        .replace(/\b5g\b/gi, "5G")
        .replace(/(\d)\s+R\b/g, "$1R")
        .replace(/\s+/g, " ")
        .trim();
      if (/condition=refurbished/i.test(u.search)) {
        name = `${name} Refurbished`.replace(/\s+/g, " ");
      }
      return name;
    }
    // Motorola: /smartphones-motorola-edge-70-max/p
    if (u.hostname.includes("motorola")) {
      const slug = path.replace(/\/p$/i, "").split("/").filter(Boolean).pop() || "";
      return slug
        .replace(/^smartphones-?/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    const last = path.split("/").filter(Boolean).pop() || "";
    return last
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\b5g\b/gi, "5G")
      .replace(/\b4g\b/gi, "4G")
      .trim();
  } catch {
    return "";
  }
}

export function brandHintFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("samsung")) return "Samsung";
    if (host.includes("oneplus")) return "OnePlus";
    if (host.includes("google")) return "Google";
    if (host.includes("vivo")) return "vivo";
    if (host.includes("oppo")) return "OPPO";
    if (host.includes("mi.com") || host.includes("xiaomi")) return "Xiaomi";
    if (host.includes("poco") || host.includes("po.co")) return "POCO";
    if (host.includes("realme")) return "realme";
    if (host.includes("iqoo")) return "iQOO";
    if (host.includes("motorola")) return "Motorola";
    if (host.includes("lava")) return "Lava";
    if (host.includes("hmd") || host.includes("nokia")) return "HMD";
    if (host.includes("nothing")) return "Nothing";
    if (host.includes("apple")) return "Apple";
    return "";
  } catch {
    return "";
  }
}
