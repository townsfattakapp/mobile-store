import * as cheerio from "cheerio";
import { MasterDevice } from "../../CatalogProvider";
import { ScraperAdapter } from "../ScraperEngine";
import { extractIndianPrice } from "../extractPrice";
import {
  appleBuyUrlFromProductUrl,
  buildAppleVariants,
  collectSingleDeviceGallery,
  extractAppleColorImages,
  extractColorsFromHtml,
  extractStoragesFromHtml,
  getAppleModelCatalog,
  isCollageImageUrl,
  lookupAppleIndiaMrp,
  parseAppleShopPrices,
  toPrimaryFinishImageUrl,
} from "../appleInPrices";

export class AppleAdapter implements ScraperAdapter {
  match(url: string): boolean {
    return url.includes("apple.com");
  }

  async scrape(url: string, html: string): Promise<Partial<MasterDevice> | null> {
    const { isCategoryUrl } = await import("../CategoryScraper");
    if (isCategoryUrl(url)) {
      console.warn(`AppleAdapter: refusing category URL ${url}`);
      return null;
    }

    const $ = cheerio.load(html);
    const title =
      $('meta[property="og:title"]').attr("content") || $("title").text().trim();
    if (!title) return null;

    let modelName = title
      .replace(/^Buy\s+/i, "")
      .replace(/\s*-\s*Apple.*$/i, "")
      .trim();
    modelName = modelName.replace(/\u00A0/g, " ").replace(/\s+/g, " ");
    if (/ and /i.test(modelName)) modelName = modelName.split(/ and /i)[0].trim();
    if (/ & /i.test(modelName)) modelName = modelName.split(/ & /i)[0].trim();

    let mainImageUrl = $('meta[property="og:image"]').attr("content") || "";
    if (mainImageUrl && isCollageImageUrl(mainImageUrl)) {
      // Don't use multi-phone hero as main — wait for finish images
      mainImageUrl = "";
    }

    // Prefer shop buy page for colors / finish images / accurate config data
    let buyHtml = html;
    const buyUrl = appleBuyUrlFromProductUrl(url, modelName);
    if (buyUrl && !url.includes("/shop/buy-iphone/")) {
      try {
        const buyRes = await fetch(buyUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-IN,en;q=0.9",
            Accept: "text/html,application/xhtml+xml",
          },
          cache: "no-store",
        });
        if (buyRes.ok) buyHtml = await buyRes.text();
      } catch (e) {
        console.warn("AppleAdapter: buy page fetch failed", e);
      }
    }

    const catalog = getAppleModelCatalog(modelName);
    const htmlColors = extractColorsFromHtml(buyHtml, catalog?.colors || []);
    const htmlStorages = extractStoragesFromHtml(buyHtml);
    const colorImages = extractAppleColorImages(
      buyHtml + "\n" + html,
      catalog?.colors || htmlColors,
      catalog?.finishSlugs,
      modelName
    );

    // Fallback main = first color image (single phone), else non-collage OG
    const firstColorImg = Object.values(colorImages)[0];
    if (!mainImageUrl && firstColorImg) mainImageUrl = firstColorImg;
    if (mainImageUrl) mainImageUrl = toPrimaryFinishImageUrl(mainImageUrl);

    const built = buildAppleVariants({
      modelName,
      colorImages,
      htmlStorages,
      htmlColors: htmlColors.length >= 2 ? htmlColors : catalog?.colors,
      mainImageFallback: mainImageUrl,
    });

    // Starting price from shop / curated
    let starting =
      built.startingMrp ||
      parseAppleShopPrices(buyHtml).sellingPrice ||
      extractIndianPrice(cheerio.load(buyHtml), buyHtml).sellingPrice ||
      lookupAppleIndiaMrp(modelName);

    const gallery = collectSingleDeviceGallery(
      buyHtml + "\n" + html,
      colorImages,
      mainImageUrl,
      10,
      modelName
    );

    const variants = built.variants.map((v) => ({
      id: "",
      master_device_id: "",
      ram: v.ram,
      storage: v.storage,
      color: v.color,
      reference_image_url: v.reference_image_url || mainImageUrl || "",
      // carried through save via specifications.variant_pricing
      mrp: v.mrp,
      selling_price: v.mrp,
    }));

    return {
      brand_id: "",
      brand_name: "Apple",
      model_name: modelName,
      slug: modelName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      release_year: new Date().getFullYear(),
      source_provider: "scraper_apple",
      specifications: {
        processor: "Apple Silicon (Refer to official specs)",
        display: "Super Retina XDR",
        camera: "Pro Camera System",
        battery: "All-day battery life",
        os: "iOS",
        dimensions: "Unknown",
        weight: "Unknown",
        description:
          $('meta[name="Description"]').attr("content") || "Apple Official Website",
        gallery_images: gallery,
        color_images: colorImages,
        colors: built.colors,
        storages: built.storages,
        mrp: starting ?? undefined,
        selling_price: starting ?? undefined,
        currency: "INR",
        price_source: "apple_in_variant_matrix",
        variant_pricing: built.variants.map((v) => ({
          color: v.color,
          storage: v.storage,
          ram: v.ram,
          mrp: v.mrp,
          selling_price: v.mrp,
          image: v.reference_image_url,
        })),
      },
      main_image_url: mainImageUrl || firstColorImg || "",
      variants: variants as any,
    } as any;
  }
}
