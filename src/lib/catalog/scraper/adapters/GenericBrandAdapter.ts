import * as cheerio from "cheerio";
import { MasterDevice } from "../../CatalogProvider";
import { ScraperAdapter } from "../ScraperEngine";
import { extractIndianPrice } from "../extractPrice";
import {
  cleanScrapedModelName,
  detectIsAccessory,
  extractProductImages,
  isJunkBrandImage,
} from "../extractProductImages";
import {
  absShopifyImage,
  fetchShopifyProductJs,
  isShopifyHtml,
  isShopifyProductUrl,
} from "../shopify";

/**
 * Catch-all adapter for any brand / accessory store (Shopify, WooCommerce, etc.).
 * Specific adapters (Apple/Amazon/Flipkart) are tried first in ScraperEngine.
 */
export class GenericBrandAdapter implements ScraperAdapter {
  private knownDomains: Record<string, string> = {
    "store.google.com": "Google",
    "vivo.com": "Vivo",
    "oppo.com": "Oppo",
    "iqoo.com": "iQOO",
    "shop.iqoo.com": "iQOO",
    "realme.com": "Realme",
    "mi.com": "Xiaomi",
    "po.co": "Poco",
    "poco.in": "Poco",
    "motorola.in": "Motorola",
    "motorola.com": "Motorola",
    "samsung.com": "Samsung",
    "oneplus.in": "OnePlus",
    "oneplus.com": "OnePlus",
    "nothing.tech": "Nothing",
    "inspireonline.in": "Apple",
    "ambraneindia.com": "Ambrane",
    "boat-lifestyle.com": "boAt",
    "noise.tech": "Noise",
    "gonoise.com": "Noise",
    "tecno-mobile.com": "Tecno",
    "tecno-mobile.in": "Tecno",
    "infinixmobility.com": "Infinix",
    "itel-india.com": "itel",
    "lava.com": "Lava",
  };

  /** Catch-all — must be last in ScraperEngine adapter list */
  match(_url: string): boolean {
    return true;
  }

  async scrape(url: string, html: string): Promise<Partial<MasterDevice> | null> {
    // Never treat brand hubs / category pages as a single device
    if (await this.shouldRefuseAsHub(url)) return null;

    // Samsung buy pages: ProductGroup JSON-LD (colors × storage × prices)
    if (/samsung\.com/i.test(url)) {
      const samsung = await this.scrapeSamsung(url, html);
      if (samsung) return samsung;
      const { isSamsungProductUrl, extractSamsungModelCodeFromUrl } =
        await import("../samsung");
      if (isSamsungProductUrl(url) || extractSamsungModelCodeFromUrl(url)) {
        return null;
      }
    }

    // Nothing India — Storefront GraphQL (colours × capacity × INR)
    if (/nothing\.tech/i.test(url)) {
      const nothing = await this.scrapeNothing(url);
      if (nothing) return nothing;
      const { isNothingProductUrl } = await import("../nothing");
      if (isNothingProductUrl(url)) return null;
    }

    // OnePlus India — store #data-device SKUs + packshots
    if (/oneplus\.(in|com)/i.test(url)) {
      const oneplus = await this.scrapeOnePlus(url, html);
      if (oneplus) return oneplus;
      const { isOnePlusProductUrl } = await import("../oneplus");
      if (isOnePlusProductUrl(url)) return null;
    }

    // Google Pixel Store India
    if (/store\.google\.com/i.test(url)) {
      const pixel = await this.scrapeGooglePixel(url);
      if (pixel) return pixel;
      return null;
    }

    // Motorola India (VTEX)
    if (/motorola\.(in|com)/i.test(url)) {
      const moto = await this.scrapeMotorola(url, html);
      if (moto) return moto;
      const { isMotorolaProductUrl } = await import("../motorola");
      if (isMotorolaProductUrl(url)) return null;
    }

    // Prefer Shopify JSON for accurate prices / variants / images
    if (isShopifyProductUrl(url) || isShopifyHtml(html)) {
      const fromShopify = await this.scrapeShopify(url, html);
      if (fromShopify) {
        return (await this.maybeRebuildFromMarketplace(url, fromShopify)) as any;
      }
    }

    // Enrich Tecno-style pages that load assets from config.js
    html = await this.enrichWithConfigScripts(url, html);

    const scraped = await this.scrapeHtml(url, html);
    return (await this.maybeRebuildFromMarketplace(url, scraped)) as any;
  }

  private async shouldRefuseAsHub(url: string): Promise<boolean> {
    try {
      const { isCategoryUrl } = await import("../CategoryScraper");
      if (isCategoryUrl(url)) {
        // Exception: some "product" paths are also category-like — only refuse
        // clear hubs (home, listing) without a model slug
        const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
        if (
          path === "/" ||
          path === "/in" ||
          /\/(products|smartphones|phones|phone|store)\/?$/i.test(path) ||
          /store\.google\.com.*\/category\//i.test(url) ||
          /shop\.iqoo\.com.*\/products\/phone/i.test(url)
        ) {
          return true;
        }
      }
      // Bare brand home pages
      const host = new URL(url).hostname.toLowerCase();
      const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
      if (
        path === "/" &&
        /(poco\.in|vivo\.com|oppo\.com|mi\.com|realme\.com|motorola\.in|iqoo\.com)/i.test(
          host
        )
      ) {
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  private async scrapeGooglePixel(url: string): Promise<Partial<MasterDevice> | null> {
    const { fetchGooglePixelProduct, isGooglePixelProductUrl, isGooglePixelHubUrl } =
      await import("../googlePixel");
    if (isGooglePixelHubUrl(url)) return null;
    if (!isGooglePixelProductUrl(url)) return null;
    return fetchGooglePixelProduct(url);
  }

  private async scrapeMotorola(
    url: string,
    html: string
  ): Promise<Partial<MasterDevice> | null> {
    const { fetchMotorolaProduct, isMotorolaHubUrl } = await import("../motorola");
    if (isMotorolaHubUrl(url)) return null;
    return fetchMotorolaProduct(url, html || undefined);
  }

  /**
   * When brand HTML scrape collapses to Standard/8/128 + junk image / bad title,
   * rebuild colour × storage × MRP from Flipkart.
   */
  private async maybeRebuildFromMarketplace(
    url: string,
    scraped: Partial<MasterDevice> | null
  ): Promise<Partial<MasterDevice> | null> {
    const {
      isWeakPhoneScrape,
      buildMarketplaceDevice,
      marketplaceDeviceToPartial,
    } = await import("../marketplaceVariants");
    const { brandHintFromUrl, modelNameFromProductUrl } = await import(
      "../enrichMarketplace"
    );

    const brandHint =
      (scraped as any)?.brand_name ||
      this.brandFromUrl(url) ||
      this.brandFromHostname(url) ||
      brandHintFromUrl(url);

    // No scrape + known phone brand PDP → marketplace-only device
    if (!scraped?.model_name) {
      if (!brandHint) return scraped;
      const guess = modelNameFromProductUrl(url);
      if (!guess || guess.length < 3) return scraped;
      const built = await buildMarketplaceDevice(guess, brandHint);
      return built
        ? marketplaceDeviceToPartial(built, `scraper_${brandHint.toLowerCase()}`)
        : scraped;
    }

    if (!isWeakPhoneScrape(scraped as any)) return scraped;

    let model =
      (scraped as any).model_name || modelNameFromProductUrl(url) || "";
    // Prefer URL slug over SEO titles for Google-like junk titles
    const fromUrl = modelNameFromProductUrl(url);
    if (
      fromUrl &&
      fromUrl.length >= 3 &&
      (/&|india|official|store pixel|ultra clarity|explore|global|wechat/i.test(
        model
      ) ||
        model.length > 40 ||
        /^[\d\s]+/i.test(model) || // "15 iQOO Global"
        /iqoo\d/i.test(fromUrl.replace(/\s/g, "")) ||
        /pixel_/i.test(url))
    ) {
      model = fromUrl;
    }

    // iQOO slugs: iqoo15 → iQOO 15
    if (/iqoo\.com/i.test(url)) {
      model = model
        .replace(/^iqoo\s*/i, "")
        .replace(/^(\d)/, "iQOO $1")
        .replace(/\biqoo(\d)/i, "iQOO $1")
        .trim();
      if (!/^iqoo/i.test(model)) model = `iQOO ${model}`.replace(/\s+/g, " ");
      model = model
        .replace(/iqoo\s*iqoo/i, "iQOO")
        .replace(/\bIqoo\b/g, "iQOO");
    }

    const brand = brandHint || "Phone";
    const built = await buildMarketplaceDevice(model, brand);
    if (!built || !built.variants.length) return scraped;

    const rebuilt = marketplaceDeviceToPartial(
      built,
      `scraper_${String(brand).toLowerCase().replace(/\s+/g, "")}`
    );
    // Preserve cleaner brand when we had one
    if ((scraped as any).brand_name && !(rebuilt as any).brand_name) {
      (rebuilt as any).brand_name = (scraped as any).brand_name;
    }
    return rebuilt;
  }

  private async scrapeOnePlus(
    url: string,
    html: string
  ): Promise<Partial<MasterDevice> | null> {
    const { fetchOnePlusProduct, isOnePlusHost, isOnePlusProductUrl } =
      await import("../oneplus");
    if (!isOnePlusHost(url)) return null;
    // Homepage / hubs: let CategoryScraper expand; don't invent a product
    if (!isOnePlusProductUrl(url) && !html) return null;
    if (!isOnePlusProductUrl(url)) {
      // Thin HTML hubs still shouldn't become a single device
      try {
        const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
        if (path === "/" || /\/(store|phones|smartphones)?$/i.test(path)) {
          return null;
        }
      } catch {
        return null;
      }
    }

    const product = await fetchOnePlusProduct(url, html || undefined);
    if (!product) return null;
    // Need at least a real image or Flipkart variants
    if (
      !product.variants.length &&
      !product.gallery.some((u) => u && !isJunkBrandImage(u))
    ) {
      return null;
    }

    const modelName = cleanScrapedModelName(product.modelName, "OnePlus");
    const gallery = product.gallery
      .filter((u) => u && !isJunkBrandImage(u))
      .slice(0, 3);
    const mainImageUrl =
      gallery[0] ||
      Object.values(product.colorImages).find((u) => u && !isJunkBrandImage(u)) ||
      "";

    const colorImages: Record<string, string> = {};
    for (const [c, img] of Object.entries(product.colorImages)) {
      if (img && !isJunkBrandImage(img)) colorImages[c] = img;
    }

    const variants = product.variants.map((v) => ({
      id: "",
      master_device_id: "",
      ram: v.ram || "",
      storage: v.storage || "",
      color: v.color,
      reference_image_url:
        (v.image && !isJunkBrandImage(v.image) ? v.image : "") ||
        colorImages[v.color] ||
        mainImageUrl,
      mrp: v.mrp || v.sellingPrice || undefined,
      selling_price: v.sellingPrice || v.mrp || undefined,
    }));

    const starting =
      product.startingMrp ||
      product.startingPrice ||
      variants.map((v) => Number(v.mrp)).find((p) => p > 0) ||
      0;

    return {
      brand_id: "",
      brand_name: "OnePlus",
      model_name: modelName,
      slug: `oneplus-${modelName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      release_year: new Date().getFullYear(),
      source_provider: "scraper_oneplus",
      specifications: {
        processor: "—",
        display: "—",
        camera: "—",
        battery: "—",
        os: "OxygenOS",
        dimensions: "—",
        weight: "—",
        description: product.description,
        gallery_images: gallery,
        color_images: colorImages,
        mrp: starting || undefined,
        selling_price: product.startingPrice || starting || undefined,
        currency: "INR",
        price_source: starting > 0 ? "oneplus_pricing" : "oneplus_store",
        product_type: "mobile",
      },
      main_image_url: mainImageUrl,
      variants: variants.length
        ? variants
        : [
            {
              id: "",
              master_device_id: "",
              ram: "12GB",
              storage: "256GB",
              color: "Standard",
              reference_image_url: mainImageUrl,
              mrp: starting || undefined,
              selling_price: starting || undefined,
            },
          ],
    };
  }

  private async scrapeNothing(
    url: string
  ): Promise<Partial<MasterDevice> | null> {
    const { fetchNothingProduct, isNothingProductUrl } = await import(
      "../nothing"
    );
    if (!isNothingProductUrl(url)) return null;

    const product = await fetchNothingProduct(url);
    if (!product || !product.variants.length) return null;

    const { isJunkBrandImage, cleanScrapedModelName } = await import(
      "../extractProductImages"
    );

    const gallery = product.gallery.filter((u) => u && !isJunkBrandImage(u));
    const mainImageUrl = gallery[0] || Object.values(product.colorImages)[0] || "";
    const colorImages: Record<string, string> = {};
    for (const [c, img] of Object.entries(product.colorImages)) {
      if (img && !isJunkBrandImage(img)) colorImages[c] = img;
    }

    const variants = product.variants.map((v) => ({
      id: "",
      master_device_id: "",
      ram: v.ram || "",
      storage: v.storage || "",
      color: v.color,
      reference_image_url: v.image || colorImages[v.color] || mainImageUrl,
      mrp: v.mrp || v.price,
      selling_price: v.price || v.mrp,
    }));

    const starting =
      product.startingMrp ||
      product.startingPrice ||
      variants.map((v) => v.mrp).filter((p) => p > 0)[0] ||
      0;

    const modelName = cleanScrapedModelName(product.modelName, "Nothing");

    return {
      brand_id: "",
      brand_name: "Nothing",
      model_name: modelName,
      slug: `nothing-${product.handle}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      release_year: new Date().getFullYear(),
      source_provider: "scraper_nothing",
      specifications: {
        processor: "—",
        display: "—",
        camera: "—",
        battery: "—",
        os: "Nothing OS",
        dimensions: "—",
        weight: "—",
        description: product.description,
        gallery_images: gallery.slice(0, 12),
        color_images: colorImages,
        mrp: starting || undefined,
        selling_price: product.startingPrice || starting || undefined,
        currency: "INR",
        price_source: "nothing_storefront_graphql",
        product_type: "mobile",
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
    } as any;
  }

  private async scrapeSamsung(
    url: string,
    html: string
  ): Promise<Partial<MasterDevice> | null> {
    const {
      parseSamsungProductGroup,
      isSamsungProductUrl,
      fetchSamsungFullSpecs,
      extractSamsungModelCodeFromUrl,
      fetchSamsungDeviceByModelCode,
      resolveSamsungModelCodeFromUrl,
    } = await import("../samsung");
    const modelFromUrl = extractSamsungModelCodeFromUrl(url);
    if (!isSamsungProductUrl(url) && !/\/buy\/?/i.test(url) && !modelFromUrl) {
      return null;
    }

    const siteCode =
      url.match(/samsung\.com\/([a-z]{2})\b/i)?.[1]?.toLowerCase() || "in";

    let group = html ? parseSamsungProductGroup(html) : null;
    // Family pages without ProductGroup: try /buy/ (skip SKU deep-links — they use API fallback)
    if (!group && !/\/buy\/?/i.test(url) && !modelFromUrl) {
      try {
        const buyUrl = url.replace(/\/?$/, "/buy/");
        const res = await fetch(buyUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-IN,en;q=0.9",
          },
          cache: "no-store",
        });
        if (res.ok) {
          html = await res.text();
          group = parseSamsungProductGroup(html);
          if (group) url = buyUrl;
        }
      } catch {
        /* ignore */
      }
    }

    // API fallback for SKU pages / blocked HTML / broken family /buy/ URLs
    if (!group || !group.variants.length) {
      const resolved =
        modelFromUrl ||
        (await resolveSamsungModelCodeFromUrl(url, siteCode));
      const apiDevice = resolved
        ? await fetchSamsungDeviceByModelCode(resolved, siteCode)
        : null;
      if (!apiDevice) return null;

      const gallery = apiDevice.gallery.filter((u) => !isJunkBrandImage(u));
      const mainImageUrl = gallery[0] || "";
      const colorImages: Record<string, string> = {};
      for (const v of apiDevice.variants) {
        if (v.color && v.image && !isJunkBrandImage(v.image)) {
          colorImages[v.color] = v.image;
        }
      }
      const variants = apiDevice.variants.map((v) => ({
        id: "",
        master_device_id: "",
        ram: v.ram || "",
        storage: v.storage || "",
        color: v.color,
        reference_image_url: v.image || mainImageUrl,
        mrp: v.price,
        selling_price: v.price,
      }));
      const starting =
        apiDevice.startingPrice ||
        variants.map((v) => v.selling_price).filter((p) => p > 0)[0] ||
        0;
      const fullSpecs = apiDevice.specs;

      return {
        brand_id: "",
        brand_name: "Samsung",
        model_name: cleanScrapedModelName(apiDevice.modelName, "Samsung"),
        slug: `samsung-${apiDevice.modelName}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-"),
        release_year: new Date().getFullYear(),
        source_provider: "scraper_samsung",
        specifications: {
          processor: fullSpecs?.processor || "—",
          display: fullSpecs?.display || "—",
          camera: fullSpecs?.camera || "—",
          battery: fullSpecs?.battery || "—",
          os: fullSpecs?.os || "Android",
          dimensions: fullSpecs?.dimensions || "—",
          weight: fullSpecs?.weight || "—",
          description: apiDevice.description,
          gallery_images: gallery.slice(0, 10),
          color_images: colorImages,
          mrp: starting || undefined,
          selling_price: starting || undefined,
          currency: "INR",
          price_source: "samsung_card_api",
          product_type: "mobile",
          model_sku: apiDevice.modelSku,
          tech_specs: fullSpecs?.tech_specs || {},
          spec_sections: fullSpecs?.spec_sections || [],
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
      } as any;
    }

    const gallery = group.gallery.filter((u) => !isJunkBrandImage(u));
    const mainImageUrl = gallery[0] || "";
    const colorImages: Record<string, string> = {};
    for (const v of group.variants) {
      if (v.color && v.image && !isJunkBrandImage(v.image)) {
        colorImages[v.color] = v.image;
      }
    }

    const variants = group.variants.map((v) => ({
      id: "",
      master_device_id: "",
      ram: v.ram || "",
      storage: v.storage || "",
      color: v.color,
      reference_image_url: v.image || mainImageUrl,
      mrp: v.price,
      selling_price: v.price,
    }));

    const starting = group.startingPrice || variants[0]?.selling_price || 0;

    const modelSku =
      group.variants.find((v) => v.sku)?.sku ||
      group.variants[0]?.sku ||
      modelFromUrl ||
      "";
    const fullSpecs = modelSku
      ? await fetchSamsungFullSpecs(modelSku, siteCode)
      : null;

    return {
      brand_id: "",
      brand_name: "Samsung",
      model_name: cleanScrapedModelName(group.modelName, "Samsung"),
      slug: `samsung-${group.modelName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      release_year: new Date().getFullYear(),
      source_provider: "scraper_samsung",
      specifications: {
        processor: fullSpecs?.processor || "—",
        display: fullSpecs?.display || "—",
        camera: fullSpecs?.camera || "—",
        battery: fullSpecs?.battery || "—",
        os: fullSpecs?.os || "Android",
        dimensions: fullSpecs?.dimensions || "—",
        weight: fullSpecs?.weight || "—",
        description: group.description,
        gallery_images: gallery.slice(0, 10),
        color_images: colorImages,
        mrp: starting || undefined,
        selling_price: starting || undefined,
        currency: "INR",
        price_source: "samsung_product_group",
        product_type: "mobile",
        model_sku: modelSku,
        tech_specs: fullSpecs?.tech_specs || {},
        spec_sections: fullSpecs?.spec_sections || [],
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
    } as any;
  }

  /** Fetch linked config.js blobs (Tecno product pages) so image URLs are in HTML */
  private async enrichWithConfigScripts(pageUrl: string, html: string): Promise<string> {
    const configHrefs = [
      ...html.matchAll(
        /(?:src|href)=["']([^"']*(?:config\.js|znConfig|product[^"']*\.js)[^"']*)["']/gi
      ),
    ]
      .map((m) => m[1])
      .filter(Boolean)
      .slice(0, 3);

    if (!configHrefs.length) return html;

    let extra = "";
    for (const href of configHrefs) {
      try {
        const abs = new URL(href, pageUrl).href;
        const res = await fetch(abs, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Accept: "*/*",
          },
          cache: "no-store",
        });
        if (res.ok) extra += "\n" + (await res.text());
      } catch {
        /* ignore */
      }
    }
    return html + extra;
  }

  private async scrapeShopify(
    url: string,
    html: string
  ): Promise<Partial<MasterDevice> | null> {
    if (!isShopifyProductUrl(url)) return null;

    const product = await fetchShopifyProductJs(url);
    if (!product?.title) return null;

    const brandName =
      this.brandFromUrl(url) ||
      product.vendor ||
      this.brandFromHostname(url) ||
      "Unknown";

    const modelName =
      cleanScrapedModelName(product.title, brandName) || product.title;

    const images = (product.images || [])
      .map((i) => absShopifyImage(i.src))
      .filter((u) => u && !isJunkBrandImage(u));
    const mainImageUrl = images[0] || "";

    const colorOption = (product.options || []).find((o) =>
      /color|colour|finish/i.test(o.name)
    );
    const colors = colorOption?.values?.length
      ? colorOption.values
      : ["Standard"];

    const variants = (product.variants || []).map((v) => {
      const price = Math.round(parseFloat(v.price) || 0);
      const mrp = Math.round(parseFloat(v.compare_at_price || "") || price);
      const color =
        (colorOption
          ? [v.option1, v.option2, v.option3].find((o) =>
              colors.some((c) => c.toLowerCase() === String(o || "").toLowerCase())
            )
          : null) ||
        (v.title && v.title !== "Default Title" ? v.title : colors[0]) ||
        "Standard";

      const vImg = absShopifyImage(v.featured_image?.src);
      return {
        id: "",
        master_device_id: "",
        ram: "",
        storage: "",
        color: String(color),
        reference_image_url:
          (vImg && !isJunkBrandImage(vImg) ? vImg : "") || mainImageUrl,
        mrp: mrp || price,
        selling_price: price,
      };
    });

    const finalVariants =
      variants.length > 0
        ? variants
        : [
            {
              id: "",
              master_device_id: "",
              ram: "",
              storage: "",
              color: "Standard",
              reference_image_url: mainImageUrl,
              mrp: 0,
              selling_price: 0,
            },
          ];

    const prices = finalVariants
      .map((v) => v.selling_price)
      .filter((p) => p > 0);
    const mrps = finalVariants.map((v) => v.mrp).filter((p) => p > 0);
    const starting = prices.length ? Math.min(...prices) : undefined;
    const startingMrp = mrps.length ? Math.min(...mrps) : starting;

    const description =
      (product.body_html || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500) ||
      cheerio.load(html)('meta[property="og:description"]').attr("content") ||
      "";

    const isAccessory = detectIsAccessory(
      modelName,
      description,
      url + " " + (product.product_type || "")
    );

    return {
      brand_id: "",
      brand_name: brandName.replace(/\s+India$/i, "").trim() || brandName,
      model_name: modelName,
      slug: `${brandName}-${modelName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      release_year: new Date().getFullYear(),
      source_provider: "scraper_shopify",
      specifications: {
        processor: isAccessory ? product.product_type || "Accessory" : "See Official Website",
        display: isAccessory ? "N/A" : "See Official Website",
        camera: isAccessory ? "N/A" : "See Official Website",
        battery: /power|bank|mah/i.test(modelName + description)
          ? "See product details"
          : isAccessory
            ? "N/A"
            : "See Official Website",
        os: isAccessory ? "N/A" : "See Official Website",
        dimensions: "See Official Website",
        weight: "See Official Website",
        description,
        gallery_images: images.slice(0, 8),
        color_images: Object.fromEntries(
          finalVariants
            .filter((v) => v.color && v.reference_image_url)
            .map((v) => [v.color, v.reference_image_url])
        ),
        mrp: startingMrp,
        selling_price: starting,
        currency: "INR",
        price_source: "shopify_product_js",
        product_type: isAccessory ? "accessory" : "mobile",
        tags: product.tags || [],
        variant_pricing: finalVariants.map((v) => ({
          color: v.color,
          storage: v.storage,
          ram: v.ram,
          mrp: v.mrp,
          selling_price: v.selling_price,
          image: v.reference_image_url,
        })),
      },
      main_image_url: mainImageUrl,
      variants: finalVariants as any,
    } as any;
  }

  private scrapeHtml(url: string, html: string): Partial<MasterDevice> | null {
    const $ = cheerio.load(html);

    const path = (() => {
      try {
        return new URL(url).pathname.replace(/\/+$/, "") || "/";
      } catch {
        return "/";
      }
    })();
    const ogType = $('meta[property="og:type"]').attr("content") || "";
    if (
      (path === "/" || path === "") &&
      !/product/i.test(ogType) &&
      !isShopifyProductUrl(url)
    ) {
      console.warn(`GenericBrandAdapter: refusing store homepage ${url}`);
      return null;
    }

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="title"]').attr("content") ||
      $("title").text().trim();
    if (!title) {
      console.warn(`GenericBrandAdapter: No title found for ${url}`);
      return null;
    }

    let jsonLd: any = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (jsonLd) return;
      try {
        const raw = $(el).html() || "";
        const data = JSON.parse(raw);
        const nodes = Array.isArray(data) ? data : [data];
        for (const n of nodes) {
          if (n?.["@type"] === "Product" || n?.["@type"]?.includes?.("Product")) {
            jsonLd = n;
            break;
          }
          if (Array.isArray(n?.["@graph"])) {
            jsonLd =
              n["@graph"].find(
                (g: any) =>
                  g?.["@type"] === "Product" ||
                  String(g?.["@type"] || "").includes("Product")
              ) || null;
            if (jsonLd) break;
          }
        }
      } catch {
        /* ignore */
      }
    });

    const description =
      jsonLd?.description ||
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "Official Brand Data";

    let brandName =
      this.brandFromUrl(url) ||
      jsonLd?.brand?.name ||
      jsonLd?.brand ||
      this.brandFromHostname(url) ||
      "Unknown";
    if (typeof brandName !== "string") brandName = "Unknown";
    brandName = brandName.replace(/\s+Mobile$/i, "").trim() || brandName;

    let modelName = cleanScrapedModelName(
      (jsonLd?.name as string) || title,
      brandName
    );
    if (!modelName) modelName = title;

    // Smart images: skip logos/favicons (Tecno og:image is often favicon)
    const imgs = extractProductImages($, html, url, modelName, 10);
    let mainImageUrl = imgs.main;
    const gallery_images = imgs.gallery;

    if (!mainImageUrl && jsonLd?.image) {
      const ldImg =
        typeof jsonLd.image === "string"
          ? jsonLd.image
          : Array.isArray(jsonLd.image)
            ? jsonLd.image[0]
            : jsonLd.image?.url;
      if (ldImg && !isJunkBrandImage(ldImg)) mainImageUrl = ldImg;
    }

    const isAccessory = detectIsAccessory(modelName, String(description), url);

    const { mrp, sellingPrice } = extractIndianPrice($, html);
    let ldPrice = 0;
    let ldMrp = 0;
    const offers = jsonLd?.offers;
    if (offers) {
      const o = Array.isArray(offers) ? offers[0] : offers;
      ldPrice = Math.round(parseFloat(o?.price || o?.lowPrice || "0")) || 0;
      ldMrp =
        Math.round(parseFloat(o?.highPrice || o?.price || "0")) || ldPrice;
    }

    const price = sellingPrice || ldPrice || 0;
    const finalMrp = mrp || ldMrp || price;

    const fallbackVariants = isAccessory
      ? [
          {
            id: "",
            master_device_id: "",
            ram: "",
            storage: "",
            color: "Standard",
            reference_image_url: mainImageUrl || "",
            mrp: finalMrp,
            selling_price: price || finalMrp,
          },
        ]
      : [
          {
            id: "",
            master_device_id: "",
            ram: "8GB",
            storage: "128GB",
            color: "Standard",
            reference_image_url: mainImageUrl || "",
            mrp: finalMrp,
            selling_price: price || finalMrp,
          },
        ];

    return {
      brand_id: "",
      brand_name: brandName,
      model_name: modelName,
      slug: `${brandName}-${modelName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      release_year: new Date().getFullYear(),
      source_provider: "scraper_generic",
      specifications: {
        processor: isAccessory ? "Accessory" : "See Official Website",
        display: isAccessory ? "N/A" : "See Official Website",
        camera: isAccessory ? "N/A" : "See Official Website",
        battery: "See Official Website",
        os: isAccessory ? "N/A" : "See Official Website",
        dimensions: "See Official Website",
        weight: "See Official Website",
        description: String(description).substring(0, 500),
        gallery_images,
        mrp: finalMrp || undefined,
        selling_price: price || finalMrp || undefined,
        currency: "INR",
        product_type: isAccessory ? "accessory" : "mobile",
      },
      main_image_url: mainImageUrl || gallery_images[0] || "",
      variants: fallbackVariants as any,
    } as any;
  }

  private brandFromUrl(url: string): string | null {
    const lower = url.toLowerCase();
    for (const [domain, brand] of Object.entries(this.knownDomains)) {
      if (lower.includes(domain)) return brand;
    }
    return null;
  }

  private brandFromHostname(url: string): string {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      const raw = hostname.split(".")[0];
      return raw
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    } catch {
      return "Unknown";
    }
  }
}
