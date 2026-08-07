import * as cheerio from "cheerio";

export interface ScrapedCategoryItem {
  name: string;
  url: string;
  kind?: "product" | "category";
  /** Best-effort listing thumbnail when discovery exposes one */
  image?: string;
}

function absPageAsset(raw: string | undefined, pageUrl: string): string {
  if (!raw) return "";
  const first = raw.split(",")[0]?.trim().split(/\s+/)[0] || "";
  if (!first || first.startsWith("data:")) return "";
  try {
    return new URL(first, pageUrl).href;
  } catch {
    return "";
  }
}

function nearbyProductImage(
  $: cheerio.CheerioAPI,
  el: any,
  pageUrl: string
): string | undefined {
  const junk = /logo|icon|sprite|1x1|pixel|favicon|badge|placeholder|spacer/i;
  const $roots = [
    $(el),
    $(el).closest("li, article, .product, .product-item, .card, .grid__item"),
  ];
  for (const $root of $roots) {
    if (!$root.length) continue;
    const $img = $root.find("img").first();
    if (!$img.length) continue;
    const url =
      absPageAsset($img.attr("src"), pageUrl) ||
      absPageAsset($img.attr("data-src"), pageUrl) ||
      absPageAsset($img.attr("data-original"), pageUrl) ||
      absPageAsset($img.attr("srcset"), pageUrl) ||
      absPageAsset($img.attr("data-srcset"), pageUrl);
    if (url && !junk.test(url)) return url;
  }
  return undefined;
}

const GENERIC_LINK_TEXT = new Set([
  "buy",
  "learn more",
  "shop",
  "shop iphone",
  "shop now",
  "support",
  "compare",
  "compare all models",
  "switch",
  "accessories",
  "ios preview",
  "ios",
  "see all",
  "explore",
  "trade in",
  "apple trade in",
  "ways to buy",
  "personal setup",
  "delivery and pickup",
  "guided shopping",
  "apple store app",
  "watch the film",
  "store",
  "mac",
  "ipad",
  "watch",
  "airpods",
  "tv & home",
  "entertainment",
]);

const NON_PRODUCT_PATH_BITS = [
  "/shop/",
  "/goto/",
  "/buy-",
  "/compare",
  "/accessories",
  "/ios",
  "/support",
  "/trade-in",
  "/apple-pay",
  "/search",
  "/legal",
  "/today",
];

/** Hub / category pages (not a specific model) */
export function isCategoryUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = (u.pathname.replace(/\/+$/, "") || "/").toLowerCase();
    const host = u.hostname.replace(/^www\./, "");

    if (host.includes("apple.com")) {
      const parts = path.split("/").filter(Boolean);
      // /iphone or /in/iphone
      if (
        parts.length <= 2 &&
        ["iphone", "ipad", "mac", "watch", "airpods"].includes(parts[parts.length - 1] || "")
      ) {
        return true;
      }
    }

    if (host.includes("samsung.com")) {
      if (path === "/" || /^\/[a-z]{2}$/i.test(path)) return true;
      if (/\/all-smartphones$|\/all-tablets$|\/all-watches$/i.test(path)) return true;
      if (/\/smartphones$|\/mobile$/i.test(path)) return true;
      if (/\/smartphones\/galaxy-[a-z]$/i.test(path)) return true;
      return false; // don't treat Samsung PDPs as hubs
    }

    // Brand marketing hubs (JS-heavy — expand via curated catalogs)
    if (host.includes("oneplus.in") || host.includes("oneplus.com")) {
      return path === "/" || path === "" || /\/phones|\/store/i.test(path);
    }
    if (host.includes("store.google.com")) {
      return (
        path === "/" ||
        path === "/in" ||
        /\/category\//i.test(path) ||
        /\/collection\//i.test(path)
      );
    }
    if (host.includes("vivo.com")) {
      // Only the listing hub — not /products/x300 PDPs
      if (path === "/in" || path === "/" || /\/products\/?$/i.test(path)) return true;
    }
    if (host.includes("oppo.com")) {
      if (
        path === "/in" ||
        path === "/" ||
        /\/(smartphones|accessories)\/?$/i.test(path)
      )
        return true;
    }
    if (
      (host.includes("mi.com") || host.includes("xiaomi.com")) &&
      (path === "/" ||
        path === "/in" ||
        /\/(phone|tablet|watch-audio|tv-smart-home|store)(\/|$)/i.test(path))
    )
      return true;
    if (host.includes("poco.in") || host.includes("po.co")) {
      return path === "/" || path === "" || /\/phone/i.test(path);
    }
    if (host.includes("realme.com")) {
      // Search is JS-rendered (SSR is empty) — treat as hub and expand live
      return (
        path === "/" ||
        path === "/in" ||
        /\/search/i.test(path) ||
        /\/(phones?|realme-phones|store)(\/|$)/i.test(path)
      );
    }
    if (host.includes("iqoo.com") && (path === "/" || /\/in\/?$/.test(path))) return true;
    if (host.includes("shop.iqoo.com") && /\/products\/phone/i.test(path)) return true;
    if ((host.includes("motorola.in") || host.includes("motorola.com")) && (path === "/" || /\/phones|\/all-phones|\/smartphones$/i.test(path)))
      return true;
    if (host.includes("lavamobiles.com") || host.includes("lava.com")) {
      return path === "/" || /\/smartphones/i.test(path);
    }
    if (host.includes("hmd.com")) {
      return (
        path === "/" ||
        /\/en_in\/?$/i.test(path) ||
        /\/(smartphones|all-phones|feature-phones|tablets|accessories)(\/|$)/i.test(
          path
        )
      );
    }
    if (host.includes("nothing.tech")) {
      return (
        path === "/" ||
        path === "" ||
        /\/collections(\/|$)/i.test(path) ||
        /\/collections\/(phones|all|smartphones)/i.test(path)
      );
    }

    if (/\/all-smartphones$/i.test(path) || /\/smartphones$/i.test(path)) {
      return true;
    }

    // Shopify / ecommerce store listing pages
    if (path === "/" || path === "") return true;
    if (path.startsWith("/collections")) return true;
    if (path.startsWith("/catalog") || path === "/shop" || path.startsWith("/shop/")) return true;
    if (/\/collections\/[^/]+$/i.test(path)) return true;
    if (path === "/products" || path === "/all") return true;
    // Locale-only roots: /in, /us
    if (/^\/[a-z]{2}$/i.test(path)) return true;

    return false;
  } catch {
    return false;
  }
}

/** True for single-product PDPs — never treat these as multi-item expand hubs */
export function isLikelyProductUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/\/products?\/[^/]+/i.test(path)) return true;
    if (/\/product-detail\//i.test(path)) return true;
    if (/\/shop\/buy-/i.test(path)) return true;
    if (/\/buy\/?$/i.test(path)) return true;
    if (/\/item\/|\/dp\/|\/p\/[^/]+/i.test(path)) return true;
    // Samsung model pages
    if (
      /samsung\.com/i.test(url) &&
      /\/smartphones\/galaxy-[a-z0-9-]+/i.test(path) &&
      !/\/smartphones\/galaxy-[a-z]\/?$/i.test(path) &&
      !/all-smartphones/i.test(path)
    ) {
      return true;
    }
    // Apple model pages
    if (/apple\.com/i.test(url) && /\/iphone-\d|\/iphone-air|\/iphone-se/i.test(path)) {
      return true;
    }
    // Google Store product
    if (/store\.google\.com/i.test(url) && /\/product\//i.test(path)) return true;
    // Nothing product pages
    if (/nothing\.tech/i.test(url) && /\/products\/[^/]+/i.test(path)) return true;
    // OnePlus / realme / mi product-ish deep links
    if (
      /(oneplus\.|realme\.|mi\.com|vivo\.com|oppo\.com|iqoo\.|motorola\.|poco\.|lavamobiles)/i.test(
        url
      ) &&
      path.split("/").filter(Boolean).length >= 1 &&
      !isCategoryUrl(url) &&
      /\/(nord|pixel|reno|find|galaxy|iphone|redmi|poco|moto|edge|razr|f\d|x\d|v\d|y\d|t\d|gt-|narzo|c\d)/i.test(
        path
      )
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function cleanName(raw: string): string {
  return raw
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(buy|shop|explore)\s+/i, "")
    .replace(/\s+(buy|price|learn more)$/i, "")
    .trim();
}

function looksLikeIphoneModel(name: string): boolean {
  const n = name.toLowerCase();
  // Exact family label only → category, not a model
  if (n === "iphone" || n === "ipad" || n === "mac" || n === "watch" || n === "airpods") {
    return false;
  }
  // iPhone 17 Pro, iPhone Air, iPhone 16e, iPhone SE, etc.
  return (
    /^iphone\s+(\d+|air|se|mini|plus|pro|x|xs|xr|11|12|13|14|15|16|17)/i.test(name) ||
    /^iphone\s+\d+/i.test(name) ||
    /^iphone\s+air$/i.test(name) ||
    /^iphone\s+se/i.test(name)
  );
}

function appleModelSlug(name: string): string | null {
  if (!looksLikeIphoneModel(name)) return null;
  return name
    .toLowerCase()
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isNonProductPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return NON_PRODUCT_PATH_BITS.some((bit) => p.includes(bit));
}

function isAppleProductPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "").toLowerCase();
  // /in/iphone-17-pro or /iphone-16
  return /\/(iphone|ipad|macbook|imac|airpods|apple-watch)[-a-z0-9]*$/i.test(p) &&
    !/\/(iphone|ipad|mac|watch|airpods)$/i.test(p);
}

/**
 * Pull Apple iPhone lineup from category HTML (chapternav + explore cards).
 */
function extractAppleLineup(
  $: cheerio.CheerioAPI,
  pageUrl: string
): ScrapedCategoryItem[] {
  const base = new URL(pageUrl);
  const localeMatch = base.pathname.match(/^\/([a-z]{2})\//i);
  const locale = localeMatch ? localeMatch[1] : "in";
  const origin = `${base.protocol}//${base.host}`;

  const byKey = new Map<string, ScrapedCategoryItem>();

  const addModel = (rawName: string, href?: string, image?: string) => {
    const name = cleanName(rawName);
    if (!looksLikeIphoneModel(name)) return;
    if (GENERIC_LINK_TEXT.has(name.toLowerCase())) return;

    let url = href || "";
    try {
      if (url) {
        url = new URL(url, pageUrl).href;
        const path = new URL(url).pathname;
        // If link points back to category hub, build product URL from name
        if (isCategoryUrl(url) || isNonProductPath(path)) {
          const slug = appleModelSlug(name);
          if (!slug) return;
          url = `${origin}/${locale}/${slug}/`;
        }
      } else {
        const slug = appleModelSlug(name);
        if (!slug) return;
        url = `${origin}/${locale}/${slug}/`;
      }
    } catch {
      const slug = appleModelSlug(name);
      if (!slug) return;
      url = `${origin}/${locale}/${slug}/`;
    }

    const key = name.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        name,
        url,
        kind: "product",
        ...(image ? { image } : {}),
      });
    } else if (image && !existing.image) {
      existing.image = image;
    }
  };

  // 1) Chapternav / ribbon model links (image + label)
  $(
    ".chapternav-items a, .chapternav a, nav[data-analytics-region='chapternav'] a, .rf-serp-product-gallery a"
  ).each((_, el) => {
    const $el = $(el);
    let label =
      $el.find(".chapternav-label, .chapternav-label-copy").first().text() ||
      $el.attr("aria-label") ||
      $el.text();
    label = cleanName(label);
    const href = $el.attr("href");
    addModel(label, href, nearbyProductImage($, el, pageUrl));
  });

  // 2) “Explore the line-up” cards — usually h3 + Learn more / Buy
  $("h3, h2").each((_, el) => {
    const heading = cleanName($(el).text());
    if (!looksLikeIphoneModel(heading)) return;

    // Prefer nearby Learn more / product link
    const $block = $(el).closest("div, section, li, article");
    let href =
      $block.find('a[href*="iphone-"]').filter((_, a) => {
        try {
          const path = new URL($(a).attr("href") || "", pageUrl).pathname;
          return isAppleProductPath(path);
        } catch {
          return false;
        }
      }).first().attr("href") ||
      $block.find("a").filter((_, a) => {
        const t = cleanName($(a).text()).toLowerCase();
        return t === "learn more" || t === "buy";
      }).first().attr("href");

    addModel(heading, href, nearbyProductImage($, el, pageUrl));
  });

  // 3) Any anchor whose text is a clear iPhone model name
  $("a").each((_, el) => {
    const name = cleanName($(el).text());
    if (!looksLikeIphoneModel(name)) return;
    if (name.length > 40) return;
    addModel(name, $(el).attr("href"), nearbyProductImage($, el, pageUrl));
  });

  // 4) Fallback: product paths in href even if text is messy
  $("a[href*='iphone-']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const full = new URL(href, pageUrl);
      if (!isAppleProductPath(full.pathname)) return;
      const slug = full.pathname.split("/").filter(Boolean).pop() || "";
      const name = slug
        .split("-")
        .map((w) => (w === "iphone" ? "iPhone" : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ")
        .replace(/Iphone/g, "iPhone");
      if (looksLikeIphoneModel(name)) {
        addModel(name, full.href, nearbyProductImage($, el, pageUrl));
      }
    } catch {
      /* ignore */
    }
  });

  // Sort: newest-looking first (higher number), Air near top after Pro gen
  return Array.from(byKey.values()).sort((a, b) => {
    const num = (n: string) => {
      const m = n.match(/iphone\s+(\d+)/i);
      return m ? parseInt(m[1], 10) : n.toLowerCase().includes("air") ? 16.5 : 0;
    };
    const diff = num(b.name) - num(a.name);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}

function extractGenericProducts(
  $: cheerio.CheerioAPI,
  pageUrl: string
): ScrapedCategoryItem[] {
  const results: ScrapedCategoryItem[] = [];
  const seen = new Set<string>();

  const keywords = [
    "iphone",
    "galaxy",
    "pixel",
    "oneplus",
    "nothing",
    "xiaomi",
    "redmi",
    "poco",
    "realme",
    "vivo",
    "oppo",
    "iqoo",
    "motorola",
    "moto",
    "ambrane",
    "powerbank",
    "power bank",
    "charger",
    "cable",
    "earbuds",
    "earphone",
    "speaker",
    "watch",
  ];

  // Prefer explicit product / PDP links (Shopify, WooCommerce, Magento-style)
  $("a[href*='/products/'], a[href*='/product/'], a[href*='/p/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const full = new URL(href, pageUrl);
      const path = full.pathname.toLowerCase();
      if (!/\/products?\/[^/]+/i.test(path) && !/\/p\/[^/]+/i.test(path)) return;
      if (isCategoryUrl(full.href)) return;

      let text = cleanName($(el).text()) || cleanName($(el).attr("title") || "");
      if (!text || text.length < 2) {
        const handle = path.split("/").filter(Boolean).pop() || "";
        text = handle
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
      if (text.length > 80) text = text.slice(0, 80).trim();
      const key = full.pathname.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      results.push({
        name: text,
        url: full.href,
        kind: "product",
        image: nearbyProductImage($, el, pageUrl),
      });
    } catch {
      /* ignore */
    }
  });

  if (results.length >= 3) return results;

  $("a").each((_, el) => {
    const text = cleanName($(el).text());
    const href = $(el).attr("href");
    if (!text || !href || text.length < 4 || text.length > 55) return;
    if (GENERIC_LINK_TEXT.has(text.toLowerCase())) return;

    const lower = text.toLowerCase();
    const hasKw = keywords.some((k) => lower.includes(k));
    if (!hasKw) return;
    // Prefer names that look like models (contain digit or known suffix)
    if (!/\d/.test(text) && !/air|pro|plus|ultra|max|fe|se|snap|charge|cable/i.test(text))
      return;

    try {
      const full = new URL(href, pageUrl).href;
      if (isCategoryUrl(full) || isNonProductPath(new URL(full).pathname)) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      results.push({
        name: text,
        url: full,
        kind: "product",
        image: nearbyProductImage($, el, pageUrl),
      });
    } catch {
      /* ignore */
    }
  });

  return results;
}

export class CategoryScraper {
  public async fetchCategoryLinks(url: string): Promise<ScrapedCategoryItem[]> {
    try {
      // Samsung India: public finder API (JS listing page has almost no PDP links)
      if (/samsung\.com/i.test(url)) {
        const { fetchSamsungSmartphoneCatalog, isSamsungListingUrl, isSamsungProductUrl } =
          await import("./samsung");
        if (isSamsungListingUrl(url) || /\/smartphones|\/mobile|\/in\/?$/i.test(url)) {
          const samsungItems = await fetchSamsungSmartphoneCatalog(url);
          if (samsungItems.length > 0) {
            return samsungItems.map((i) => ({
              name: i.name,
              url: i.url,
              kind: "product" as const,
              ...(i.image ? { image: i.image } : {}),
            }));
          }
        }
        // Single Samsung PDP should not expand via HTML related links
        if (isSamsungProductUrl(url)) return [];
      }

      // Nothing India — Storefront GraphQL (Oxygen; no products.json)
      if (/nothing\.tech/i.test(url)) {
        const {
          fetchNothingPhoneCatalog,
          isNothingListingUrl,
          isNothingProductUrl,
        } = await import("./nothing");
        if (isNothingListingUrl(url) || !isNothingProductUrl(url)) {
          const items = await fetchNothingPhoneCatalog(url);
          if (items.length) {
            return items.map((i) => ({
              name: i.name,
              url: i.url,
              kind: "product" as const,
              ...(i.image ? { image: i.image } : {}),
            }));
          }
        }
        if (isNothingProductUrl(url)) return [];
      }

      // Live brand hubs (sitemap + nav) — vivo / OPPO / OnePlus / Google / POCO /
      // Motorola / Lava / HMD / realme / Xiaomi / iQOO
      {
        const { fetchLiveBrandCatalog } = await import("./brandLiveCatalog");
        const live = await fetchLiveBrandCatalog(url);
        if (live && live.length >= 6) {
          return live.map((i) => ({
            name: i.name,
            url: i.url,
            kind: "product" as const,
          }));
        }
        // Smaller but non-empty live lists still beat curated stubs
        if (live && live.length > 0) {
          const { getCuratedBrandCatalog } = await import("./brandCatalogs");
          const curated = getCuratedBrandCatalog(url) || [];
          const merged = new Map<string, { name: string; url: string; kind: "product" }>();
          for (const i of [...live, ...curated]) {
            const key = i.url.split("?")[0].replace(/\/+$/, "").toLowerCase();
            if (!merged.has(key)) {
              merged.set(key, {
                name: i.name,
                url: i.url,
                kind: "product",
              });
            }
          }
          if (merged.size >= 4) return [...merged.values()];
        }
      }

      // Live iQOO shop listing (new + refurbished cards on the page)
      // (also covered by fetchLiveBrandCatalog — kept as dedicated fallback)
      {
        const { fetchIqooShopCatalog, isIqooShopListingUrl } = await import(
          "./liveBrandCatalogs"
        );
        if (isIqooShopListingUrl(url) || /shop\.iqoo\.com/i.test(url)) {
          const live = await fetchIqooShopCatalog(
            /shop\.iqoo\.com/i.test(url)
              ? url
              : "https://shop.iqoo.com/in/products/phone"
          );
          if (live.length >= 6) {
            return live.map((i) => ({
              name: i.name,
              url: i.url,
              kind: "product" as const,
            }));
          }
        }
        // www.iqoo.com hub → still use shop live list
        if (/iqoo\.com/i.test(url) && isCategoryUrl(url)) {
          const live = await fetchIqooShopCatalog();
          if (live.length >= 6) {
            return live.map((i) => ({
              name: i.name,
              url: i.url,
              kind: "product" as const,
            }));
          }
        }
      }

      // Live Xiaomi India category pages (phone / tablet / watch-audio / TV / store)
      {
        const {
          fetchXiaomiCategoryCatalog,
          isXiaomiCategoryListingUrl,
        } = await import("./liveBrandCatalogs");
        if (
          isXiaomiCategoryListingUrl(url) ||
          /mi\.com\/in\/?$/i.test(url) ||
          /xiaomi\.com\/in\/?$/i.test(url)
        ) {
          const live = await fetchXiaomiCategoryCatalog(url);
          if (live.length >= 4) {
            return live.map((i) => ({
              name: i.name,
              url: i.url,
              kind: "product" as const,
            }));
          }
        }
      }

      // Live realme India (search/home/phones) — SSR search is empty
      {
        const { fetchRealmeCatalog, isRealmeListingUrl } = await import(
          "./liveBrandCatalogs"
        );
        if (isRealmeListingUrl(url)) {
          const live = await fetchRealmeCatalog(url);
          if (live.length >= 6) {
            return live.map((i) => ({
              name: i.name,
              url: i.url,
              kind: "product" as const,
            }));
          }
        }
      }

      // Curated catalogs ONLY as fallback when live discovery produced nothing
      {
        const { getCuratedBrandCatalog } = await import("./brandCatalogs");
        const curated = getCuratedBrandCatalog(url);
        if (curated && curated.length > 0 && isCategoryUrl(url)) {
          return curated.map((i) => ({
            name: i.name,
            url: i.url,
            kind: "product" as const,
          }));
        }
      }

      // Shopify stores: prefer public products.json catalog (Ambrane, etc.)
      {
        const {
          fetchShopifyCatalog,
          extractShopifyProductLinksFromHtml,
          isShopifyHtml,
        } = await import("./shopify");

        const shopifyItems = await fetchShopifyCatalog(url);
        if (shopifyItems.length > 0) {
          return shopifyItems.map((i) => ({ ...i, kind: "product" as const }));
        }

        // Fall through to HTML if products.json blocked / empty
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-IN,en;q=0.9",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          console.error(`CategoryScraper failed to fetch ${url}. Status: ${response.status}`);
          if (url.includes("apple.com") && url.includes("iphone")) {
            return this.appleIphoneFallback(url);
          }
          return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        let items: ScrapedCategoryItem[] = [];

        if (url.includes("apple.com") && /iphone/i.test(url)) {
          items = extractAppleLineup($, url);
          if (items.length < 3) {
            const fallback = this.appleIphoneFallback(url);
            const keys = new Set(items.map((i) => i.name.toLowerCase()));
            for (const f of fallback) {
              if (!keys.has(f.name.toLowerCase())) items.push(f);
            }
          }
        } else if (isShopifyHtml(html)) {
          const fromHtml = extractShopifyProductLinksFromHtml(html, url);
          items = fromHtml.map((i) => ({ ...i, kind: "product" as const }));
          if (items.length < 3) {
            items = [...items, ...extractGenericProducts($, url)];
          }
        } else {
          items = extractGenericProducts($, url);
        }

        // Dedupe by URL path
        const dedup = new Map<string, ScrapedCategoryItem>();
        for (const i of items) {
          try {
            const key = new URL(i.url).pathname.toLowerCase();
            if (!dedup.has(key)) dedup.set(key, i);
          } catch {
            dedup.set(i.url, i);
          }
        }
        items = Array.from(dedup.values());

        items = items.filter((i) => {
          try {
            const p = new URL(i.url).pathname.toLowerCase();
            // Keep product PDPs; drop pure category hubs
            if (/\/products\/[^/]+/i.test(p) || /\/product\/[^/]+/i.test(p)) return true;
            if (/\/buy\/?$/i.test(p)) return true;
            if (isCategoryUrl(i.url) && i.kind === "category") return false;
            if (isCategoryUrl(i.url) && !/\/products?\//i.test(p) && !/\/buy\/?$/i.test(p))
              return false;
            // Drop Samsung "all-*" hubs mislabeled as products
            if (/\/all-(smartphones|tablets|watches|mobile-accessories)/i.test(p)) return false;
            return i.kind !== "category";
          } catch {
            return true;
          }
        });

        return items;
      }
    } catch (error) {
      console.error(`CategoryScraper error on ${url}:`, error);
      if (url.includes("apple.com") && url.includes("iphone")) {
        return this.appleIphoneFallback(url);
      }
      return [];
    }
  }

  /**
   * When Apple HTML is heavily JS-rendered / blocked, still return the current lineup.
   * URLs follow Apple IN product-page conventions.
   */
  private appleIphoneFallback(pageUrl: string): ScrapedCategoryItem[] {
    let origin = "https://www.apple.com";
    let locale = "in";
    try {
      const u = new URL(pageUrl);
      origin = `${u.protocol}//${u.host}`;
      const m = u.pathname.match(/^\/([a-z]{2})\//i);
      if (m) locale = m[1];
    } catch {
      /* keep defaults */
    }

    const models = [
      "iPhone 17 Pro",
      "iPhone Air",
      "iPhone 17",
      "iPhone 17e",
      "iPhone 16",
    ];

    return models.map((name) => {
      const slug = appleModelSlug(name)!;
      return {
        name,
        url: `${origin}/${locale}/${slug}/`,
        kind: "product" as const,
      };
    });
  }
}
