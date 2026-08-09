import type { MasterDevice } from "./CatalogProvider";
import { autoFetchProvider } from "./providers/AutoFetchProvider";
import { webScraperProvider } from "./providers/WebScraperProvider";

const PLACEHOLDER =
  /^(see specs|n\/a|unknown|see official website|—|-)$/i;

const COMMERCIAL_KEYS = new Set([
  "mrp",
  "selling_price",
  "currency",
  "price_source",
  "source_url",
  "condition_source",
  "available_grades",
  "gallery_images",
  "color_images",
  "main_image_url",
  "colors",
  "storages",
  "variant_pricing",
  "product_type",
]);

export function shouldEnrichPhoneSpecs(fetchedData: Partial<MasterDevice> | null | undefined): boolean {
  if (!fetchedData?.model_name) return false;
  const source = String((fetchedData as { source_provider?: string }).source_provider || "");
  const productType = String(
    (fetchedData.specifications as { product_type?: string } | undefined)?.product_type || ""
  );
  if (productType === "accessory" || productType === "laptop") return false;
  if (
    (fetchedData.specifications as { device_form?: string } | undefined)?.device_form ===
    "laptop"
  ) {
    return false;
  }
  if (/power\s*bank|charger|cable|earbuds|speaker|vacuum|mouse|neckband|laptop|macbook|galaxy\s*book/i.test(fetchedData.model_name)) {
    return false;
  }
  // Official brand scrapes often already have rich sections
  if (source.includes("samsung") || source.includes("nothing") || source.includes("apple.com")) {
    const sections = (fetchedData.specifications as { spec_sections?: unknown[] } | undefined)
      ?.spec_sections;
    if (Array.isArray(sections) && sections.length > 0) return false;
  }
  return true;
}

function isWeakSpecs(specs: Record<string, unknown> | undefined): boolean {
  if (!specs) return true;
  if (Array.isArray(specs.spec_sections) && specs.spec_sections.length > 0) return false;
  if (specs.tech_specs && typeof specs.tech_specs === "object" && Object.keys(specs.tech_specs as object).length > 0) {
    return false;
  }
  const keys = ["processor", "display", "camera", "battery", "os"] as const;
  return keys.every((k) => {
    const v = String(specs[k] ?? "").trim();
    return !v || PLACEHOLDER.test(v);
  });
}

/**
 * Merge GSMArena / MobileAPI tech specs under scrape commercial fields
 * (prices, images, grades). Does not overwrite real commercial values.
 */
export function mergeEnrichedSpecs(
  scraped: Record<string, unknown> | undefined,
  enriched: Record<string, unknown> | undefined
): Record<string, unknown> {
  const base = { ...(scraped || {}) };
  if (!enriched) return base;

  for (const [key, value] of Object.entries(enriched)) {
    if (COMMERCIAL_KEYS.has(key)) continue;
    if (key === "description") continue;
    if (value == null || value === "") continue;

    const current = base[key];
    if (current == null || current === "" || PLACEHOLDER.test(String(current))) {
      base[key] = value;
    }
  }

  if (Array.isArray(enriched.spec_sections) && enriched.spec_sections.length > 0) {
    base.spec_sections = enriched.spec_sections;
  }
  if (enriched.tech_specs && typeof enriched.tech_specs === "object") {
    base.tech_specs = enriched.tech_specs;
  }

  const scrapedDesc = String(base.description || "").trim();
  const enrichedDesc = String(enriched.description || "").trim();
  if (enrichedDesc && (!scrapedDesc || scrapedDesc.length < 60)) {
    base.description = enrichedDesc;
  }

  // Never show scrape provenance on the storefront
  delete base.source_url;
  delete base.condition_source;

  base.specs_enriched_from =
    enriched.specs_source || enriched.source_provider || "gsmarena";

  return base;
}

/**
 * Fetch GSMArena-style phone specs.
 * Tries direct GSMArena HTML first; falls back to MobileAPI (same data model)
 * when Cloudflare blocks scraping.
 */
export async function fetchGsmArenaStyleSpecs(
  modelName: string,
  brandName?: string
): Promise<Record<string, unknown> | null> {
  const cleanedModel = String(modelName || "")
    .replace(/\b(5g|refurbished|pre[-\s]?owned|renewed|very good|superb|good)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cleanedBrand = String(brandName || "").trim();
  const brandAlreadyInModel =
    cleanedBrand &&
    cleanedModel.toLowerCase().startsWith(cleanedBrand.toLowerCase());
  const query = (brandAlreadyInModel
    ? cleanedModel
    : [cleanedBrand, cleanedModel].filter(Boolean).join(" ")
  )
    .replace(/\s+/g, " ")
    .trim();

  // 1. Direct GSMArena (often blocked by Cloudflare Turnstile)
  try {
    if (!/^https?:\/\//i.test(query)) {
      const gsm = await webScraperProvider.fetchFromExternalWebAPI(query);
      const specs = gsm?.specifications as Record<string, unknown> | undefined;
      if (specs && !isWeakSpecs(specs)) {
        return {
          ...specs,
          specs_source: "gsmarena",
          source_provider: "gsmarena",
        };
      }
    }
  } catch (e) {
    console.warn("GSMArena scrape failed:", e);
  }

  // 2. MobileAPI — structured GSMArena catalog via API
  try {
    const api = await autoFetchProvider.fetchFromExternalWebAPI(query, {
      allowFallback: false,
    });
    const specs = api?.specifications as Record<string, unknown> | undefined;
    if (specs && api && !isWeakSpecs(specs)) {
      return {
        ...specs,
        specs_source: "gsmarena_via_mobileapi",
        source_provider: api.source_provider || "mobileapi.dev",
      };
    }
  } catch (e) {
    console.warn("MobileAPI specs enrich failed:", e);
  }

  return null;
}

export async function enrichFetchedDeviceWithGsmArenaSpecs<
  T extends Partial<MasterDevice> & { brand_name?: string },
>(fetchedData: T): Promise<T> {
  if (!shouldEnrichPhoneSpecs(fetchedData)) return fetchedData;
  if (!isWeakSpecs(fetchedData.specifications as Record<string, unknown>)) {
    // Still strip scrape provenance from customer-facing specs
    const cleaned = { ...(fetchedData.specifications as Record<string, unknown>) };
    delete cleaned.source_url;
    delete cleaned.condition_source;
    return { ...fetchedData, specifications: cleaned as T["specifications"] };
  }

  const enriched = await fetchGsmArenaStyleSpecs(
    fetchedData.model_name || "",
    (fetchedData as { brand_name?: string }).brand_name
  );
  if (!enriched) {
    const cleaned = { ...(fetchedData.specifications as Record<string, unknown>) };
    delete cleaned.source_url;
    delete cleaned.condition_source;
    return { ...fetchedData, specifications: cleaned as T["specifications"] };
  }

  return {
    ...fetchedData,
    specifications: mergeEnrichedSpecs(
      fetchedData.specifications as Record<string, unknown>,
      enriched
    ) as T["specifications"],
  };
}
