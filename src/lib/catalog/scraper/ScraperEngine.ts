import { MasterDevice } from "../CatalogProvider";
import { AmazonAdapter } from "./adapters/AmazonAdapter";
import { FlipkartAdapter } from "./adapters/FlipkartAdapter";
import { AppleAdapter } from "./adapters/AppleAdapter";
import { GenericBrandAdapter } from "./adapters/GenericBrandAdapter";

export interface ScraperAdapter {
  match(url: string): boolean;
  scrape(url: string, html: string): Promise<Partial<MasterDevice> | null>;
}

export class ScraperEngine {
  private adapters: ScraperAdapter[] = [
    new AmazonAdapter(),
    new FlipkartAdapter(),
    new AppleAdapter(),
    new GenericBrandAdapter(), // Catch-all last
  ];

  public async fetchFromUrl(url: string): Promise<Partial<MasterDevice> | null> {
    const lowerUrl = url.toLowerCase();
    const adapter = this.adapters.find((a) => a.match(lowerUrl));

    if (!adapter) {
      console.warn(`No adapter found for URL: ${url}`);
      return null;
    }

    const isSamsung = lowerUrl.includes("samsung.com");
    const isNothing = lowerUrl.includes("nothing.tech");
    const isOnePlus =
      lowerUrl.includes("oneplus.in") || lowerUrl.includes("oneplus.com");
    const hasSamsungModelHint =
      isSamsung &&
      (/[?&]smc=/i.test(url) ||
        /[?&]modelcode=/i.test(url) ||
        /-(sm-?[a-z0-9]{6,})\b/i.test(lowerUrl));

    // Samsung SKU / ?smc= links: Search API first (HTML often 404 or useless)
    if (hasSamsungModelHint) {
      try {
        const apiOnly = await adapter.scrape(url, "");
        if (apiOnly?.model_name) return apiOnly;
      } catch (e) {
        console.warn("Samsung API-first scrape failed, falling back to HTML", e);
      }
    }

    // Nothing product pages: GraphQL only (HTML has no prices)
    if (isNothing && /\/products\//i.test(lowerUrl)) {
      try {
        const apiOnly = await adapter.scrape(url, "");
        if (apiOnly?.model_name) return apiOnly;
      } catch (e) {
        console.warn("Nothing GraphQL scrape failed", e);
      }
    }

    // Google Pixel + Motorola: dedicated parsers (skip marketing HTML)
    const isGoogle = lowerUrl.includes("store.google.com");
    const isMotorola = lowerUrl.includes("motorola.in");
    const motoPath = (() => {
      try {
        return new URL(url).pathname.replace(/\/+$/, "");
      } catch {
        return "";
      }
    })();
    if (
      (isGoogle && /\/product\//i.test(lowerUrl)) ||
      (isMotorola && (/\/p$/i.test(motoPath) || /[?&]skuid=/i.test(lowerUrl)))
    ) {
      try {
        const apiOnly = await adapter.scrape(url, "");
        if (apiOnly?.model_name) return apiOnly;
      } catch (e) {
        console.warn("Brand API-first scrape failed", e);
      }
    }

    // OnePlus: resolve store buy page (#data-device) — skip marketing HTML noise
    if (isOnePlus && /\/[a-z0-9][a-z0-9-]{1,60}\/?$/i.test(new URL(url).pathname)) {
      try {
        const apiOnly = await adapter.scrape(url, "");
        if (
          apiOnly?.model_name &&
          ((apiOnly as { main_image_url?: string }).main_image_url ||
            (apiOnly.variants || []).length >= 1)
        ) {
          return apiOnly;
        }
      } catch (e) {
        console.warn("OnePlus store scrape failed, falling back to HTML", e);
      }
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept-Language": "en-IN,en;q=0.9",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        console.error(`Failed to fetch ${url}. Status: ${response.status}`);
        if (lowerUrl.includes("/products/") || isSamsung || isNothing || isOnePlus) {
          return await adapter.scrape(url, "");
        }
        return null;
      }

      const html = await response.text();
      const scraped = await adapter.scrape(url, html);
      if (scraped?.model_name) return scraped;

      // Samsung family pages without ProductGroup: last-chance API resolve
      if (isSamsung || isNothing || isOnePlus) {
        return await adapter.scrape(url, "");
      }
      return scraped;
    } catch (error) {
      console.error(`ScraperEngine error on ${url}:`, error);
      if (lowerUrl.includes("/products/") || isSamsung || isNothing || isOnePlus) {
        try {
          return await adapter.scrape(url, "");
        } catch (e2) {
          console.error(`API-only scrape also failed for ${url}:`, e2);
        }
      }
      return null;
    }
  }
}
