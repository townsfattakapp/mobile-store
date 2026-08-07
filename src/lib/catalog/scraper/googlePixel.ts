/**
 * Google Store India — Pixel phones.
 * Marketing PDPs often combine Pro + Pro XL in og:title and bury SKUs in AF blobs.
 * Prefer URL slug for model identity + Flipkart colour × storage matrix.
 */

import { buildMarketplaceDevice, marketplaceDeviceToPartial } from "./marketplaceVariants";

export function isGoogleStoreHost(url: string): boolean {
  try {
    return new URL(url).hostname.includes("store.google.com");
  } catch {
    return false;
  }
}

export function isGooglePixelProductUrl(url: string): boolean {
  if (!isGoogleStoreHost(url)) return false;
  try {
    return /\/product\/[^/?#]+/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function isGooglePixelHubUrl(url: string): boolean {
  if (!isGoogleStoreHost(url)) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/\/product\//i.test(path)) return false;
    return (
      path.includes("/category/") ||
      path.includes("/collection/") ||
      /\/(phones|pixel)\/?$/i.test(path) ||
      path === "/in" ||
      path === "/in/"
    );
  } catch {
    return false;
  }
}

/** pixel_10_pro → Pixel 10 Pro */
export function pixelModelFromUrl(url: string): string {
  try {
    const m = new URL(url).pathname.match(/\/product\/([^/?#]+)/i);
    if (!m) return "";
    const slug = decodeURIComponent(m[1]);
    return slug
      .replace(/^pixel_?/i, "Pixel ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bXl\b/g, "XL")
      .replace(/\b5g\b/gi, "5G")
      .trim();
  } catch {
    return "";
  }
}

export async function fetchGooglePixelProduct(url: string): Promise<any | null> {
  if (!isGooglePixelProductUrl(url)) return null;
  const model = pixelModelFromUrl(url);
  if (!model) return null;

  const built = await buildMarketplaceDevice(model, "Google");
  if (!built) {
    // Minimal shell with correct model name (avoid Pro & XL og:title)
    return {
      brand_id: "",
      brand_name: "Google",
      model_name: model.replace(/^Google\s+/i, "").replace(/^Pixel\s+/i, "Pixel "),
      slug: model.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      release_year: new Date().getFullYear(),
      source_provider: "scraper_google",
      specifications: {
        processor: "Google Tensor",
        display: "—",
        camera: "—",
        battery: "—",
        os: "Android",
        dimensions: "—",
        weight: "—",
        description: `${model} from Google Store India`,
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
          reference_image_url: "",
        },
      ],
    };
  }

  // Normalize model to Pixel …
  let modelName = built.modelName;
  if (!/^pixel\b/i.test(modelName)) modelName = model;
  if (!/^pixel\b/i.test(modelName)) modelName = `Pixel ${modelName}`;

  const partial = marketplaceDeviceToPartial(
    { ...built, brandName: "Google", modelName },
    "scraper_google"
  );
  partial.model_name = modelName.replace(/^Google\s+/i, "").trim();
  return partial;
}
