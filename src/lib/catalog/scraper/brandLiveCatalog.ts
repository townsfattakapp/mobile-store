/**
 * Live brand-hub catalogs (sitemap + nav HTML).
 * Prefer these over short curated lists so admin expand stays current.
 */

import * as cheerio from "cheerio";
import type { BrandCatalogItem } from "./brandCatalogs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function item(brand: string, name: string, url: string): BrandCatalogItem {
  return { brand, name, url };
}

function prettySlug(slug: string, brand: string): string {
  const spaced = slug
    .replace(/\.P\..*$/i, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const titled = spaced
    .replace(/\b5g\b/gi, "5G")
    .replace(/\b4g\b/gi, "4G")
    .replace(/\bplus\b/gi, "+")
    .replace(/\bpro\b/gi, "Pro")
    .replace(/\bultra\b/gi, "Ultra")
    .replace(/\bfe\b/gi, "FE")
    .replace(/\btws\b/gi, "TWS")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b5G\b/g, "5G")
    .replace(/\b4G\b/g, "4G")
    .replace(/\bFe\b/g, "FE")
    .replace(/\bTws\b/g, "TWS")
    .replace(/\bOneplus\b/g, "OnePlus")
    .replace(/\bHmd\b/g, "HMD");

  if (new RegExp(`^${brand}\\b`, "i").test(titled)) return titled;
  if (brand.toLowerCase() === "realme") return titled.replace(/^Realme\b/i, "realme");
  if (brand.toLowerCase() === "vivo") return titled.replace(/^Vivo\b/i, "vivo");
  return `${brand} ${titled}`.replace(/\s+/g, " ").trim();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-IN,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) return "";
  return res.text();
}

async function fetchSitemapLocs(sitemapUrl: string): Promise<string[]> {
  try {
    const xml = await fetchText(sitemapUrl);
    if (!xml || !/<loc/i.test(xml)) return [];
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) =>
      m[1].trim().replace(/\/+$/, "")
    );
  } catch {
    return [];
  }
}

function mergeItems(...lists: BrandCatalogItem[][]): BrandCatalogItem[] {
  const seen = new Set<string>();
  const out: BrandCatalogItem[] = [];
  for (const list of lists) {
    for (const i of list) {
      const key = i.url.split("?")[0].replace(/\/+$/, "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(i);
    }
  }
  return out;
}

function itemsFromHtmlPaths(
  html: string,
  baseUrl: string,
  brand: string,
  acceptPath: (pathname: string) => { url: string; slug: string } | null
): BrandCatalogItem[] {
  const $ = cheerio.load(html);
  const out: BrandCatalogItem[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    let abs: URL;
    try {
      abs = new URL(href, baseUrl);
    } catch {
      return;
    }
    const hit = acceptPath(abs.pathname);
    if (!hit) return;
    if (seen.has(hit.url)) return;
    seen.add(hit.url);
    const text = $(el).text().replace(/\s+/g, " ").trim();
    // Prefer link text only when it looks like a real product name
    const useText =
      text &&
      text.length >= 3 &&
      text.length < 70 &&
      !/browser does not support|video tag|learn more|buy now|shop|loading/i.test(
        text
      ) &&
      /[a-z]/i.test(text);
    const name = useText
      ? text
          .replace(/^(NEW|New)\s*/i, "")
          .replace(/\s*New$/i, "")
          .trim()
      : prettySlug(hit.slug, brand);
    out.push(item(brand, name, hit.url));
  });

  return out;
}

/* ─── vivo ─────────────────────────────────────────────────────────────── */

export async function fetchVivoCatalog(): Promise<BrandCatalogItem[]> {
  const locs = await fetchSitemapLocs("https://www.vivo.com/in/sitemap.xml");
  const fromSitemap: BrandCatalogItem[] = [];
  const seen = new Set<string>();
  for (const loc of locs) {
    let u: URL;
    try {
      u = new URL(loc);
    } catch {
      continue;
    }
    if (!u.hostname.includes("vivo.com")) continue;
    const m = u.pathname.match(/^\/in\/products\/([^/]+)\/?$/i);
    if (!m) continue;
    const slug = m[1].toLowerCase();
    if (/^(phone|accessories|param)$/i.test(slug)) continue;
    const url = `https://www.vivo.com/in/products/${slug}`;
    if (seen.has(url)) continue;
    seen.add(url);
    fromSitemap.push(item("vivo", prettySlug(slug, "vivo"), url));
  }

  const html = await fetchText("https://www.vivo.com/in/products");
  const fromNav = itemsFromHtmlPaths(
    html,
    "https://www.vivo.com/in/products",
    "vivo",
    (pathname) => {
      const m = pathname.match(/^\/in\/products\/([^/]+)\/?$/i);
      if (!m) return null;
      const slug = m[1].toLowerCase();
      if (/^(phone|accessories|param)$/i.test(slug)) return null;
      return { slug, url: `https://www.vivo.com/in/products/${slug}` };
    }
  );

  // Prefer sitemap order but ensure vivo-prefixed names
  return mergeItems(fromSitemap, fromNav).map((i) => ({
    ...i,
    name: /^vivo\b/i.test(i.name) ? i.name : `vivo ${i.name}`.replace(/\s+/g, " "),
  }));
}

/* ─── OPPO ─────────────────────────────────────────────────────────────── */

export async function fetchOppoCatalog(): Promise<BrandCatalogItem[]> {
  const sitemap = await fetchSitemapLocs("https://www.oppo.com/in/sitemap.xml");
  const fromSitemap: BrandCatalogItem[] = [];
  const seen = new Set<string>();

  for (const loc of sitemap) {
    let u: URL;
    try {
      u = new URL(loc);
    } catch {
      continue;
    }
    if (!u.hostname.includes("oppo.com")) continue;
    const path = u.pathname.replace(/\/+$/, "");
    if (/\/specs/i.test(path)) continue;

    let slug = "";
    let url = "";
    const buy = path.match(/^\/in\/product\/([^/]+)$/i);
    const phone = path.match(/^\/in\/smartphones\/series-[^/]+\/([^/]+)$/i);
    const acc = path.match(/^\/in\/accessories\/([^/]+)$/i);
    if (buy) {
      slug = buy[1];
      url = `https://www.oppo.com/in/product/${slug}`;
    } else if (phone) {
      slug = phone[1];
      url = `https://www.oppo.com${path}`;
    } else if (acc) {
      slug = acc[1];
      url = `https://www.oppo.com${path}/`;
    } else continue;

    if (seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    fromSitemap.push(item("OPPO", prettySlug(slug, "OPPO"), url));
  }

  const pages = [
    "https://www.oppo.com/in/",
    "https://www.oppo.com/in/smartphones/",
  ];
  const fromNav: BrandCatalogItem[] = [];
  for (const page of pages) {
    const html = await fetchText(page);
    fromNav.push(
      ...itemsFromHtmlPaths(html, page, "OPPO", (pathname) => {
        const path = pathname.replace(/\/+$/, "");
        if (/\/specs/i.test(path)) return null;
        const buy = path.match(/^\/in\/product\/([^/]+)$/i);
        if (buy) {
          return {
            slug: buy[1],
            url: `https://www.oppo.com/in/product/${buy[1]}`,
          };
        }
        const phone = path.match(/^\/in\/smartphones\/series-[^/]+\/([^/]+)$/i);
        if (phone) {
          return { slug: phone[1], url: `https://www.oppo.com${path}/` };
        }
        const acc = path.match(/^\/in\/accessories\/([^/]+)$/i);
        if (acc) {
          return {
            slug: acc[1],
            url: `https://www.oppo.com/in/accessories/${acc[1]}/`,
          };
        }
        return null;
      })
    );
  }

  // Prefer /product/ buy PDPs: put nav buy URLs first
  return mergeItems(fromNav, fromSitemap);
}

/* ─── OnePlus ──────────────────────────────────────────────────────────── */

const ONEPLUS_SKIP =
  /oxygenos|featuring|ecosystem|easy-upgrade|specs|support|store|phones|login|cart|compare|trade|community|brand|service/i;

export async function fetchOnePlusCatalog(): Promise<BrandCatalogItem[]> {
  const sitemap = await fetchSitemapLocs("https://www.oneplus.in/sitemap.xml");
  const fromSitemap: BrandCatalogItem[] = [];
  const seen = new Set<string>();

  for (const loc of sitemap) {
    let u: URL;
    try {
      u = new URL(loc);
    } catch {
      continue;
    }
    if (!u.hostname.includes("oneplus.in")) continue;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) continue;
    const slug = parts[0].toLowerCase();
    if (ONEPLUS_SKIP.test(slug)) continue;
    if (
      !/^(oneplus|nord|buds|pad|watch|bullet)/i.test(slug) &&
      !/^\d{1,2}[a-z]?$/i.test(slug)
    )
      continue;
    // Prefer canonical oneplus-* URLs later; keep raw for now
    const url = `https://www.oneplus.in/${slug}`;
    if (seen.has(url)) continue;
    seen.add(url);
    fromSitemap.push(item("OnePlus", prettySlug(slug, "OnePlus"), url));
  }

  const pages = [
    "https://www.oneplus.in/",
    "https://www.oneplus.in/store",
  ];
  const fromNav: BrandCatalogItem[] = [];
  for (const page of pages) {
    const html = await fetchText(page);
    fromNav.push(
      ...itemsFromHtmlPaths(html, page, "OnePlus", (pathname) => {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length !== 1) return null;
        const slug = parts[0].toLowerCase();
        if (ONEPLUS_SKIP.test(slug)) return null;
        if (
          !/^(oneplus|nord|buds|pad|watch|bullet)/i.test(slug) &&
          !/^\d{1,2}[a-z]?$/i.test(slug)
        )
          return null;
        // Prefer oneplus-* form
        const canon =
          /^\d{1,2}/.test(slug) && !slug.startsWith("oneplus")
            ? `oneplus-${slug}`
            : slug.startsWith("nord-") && !slug.startsWith("oneplus")
              ? `oneplus-${slug}`
              : slug.startsWith("pad-") && !slug.startsWith("oneplus")
                ? `oneplus-${slug}`
                : slug;
        return { slug: canon, url: `https://www.oneplus.in/${canon}` };
      })
    );
  }

  // Drop short forms if oneplus-* exists
  const merged = mergeItems(fromNav, fromSitemap);
  const has = new Set(merged.map((i) => i.url.toLowerCase()));
  return merged.filter((i) => {
    const slug = i.url.split("/").pop() || "";
    if (/^\d{1,2}[a-z]?$/i.test(slug) && has.has(`https://www.oneplus.in/oneplus-${slug}`))
      return false;
    if (
      /^(nord|pad)-/i.test(slug) &&
      has.has(`https://www.oneplus.in/oneplus-${slug}`)
    )
      return false;
    return true;
  });
}

/* ─── Google Store India ───────────────────────────────────────────────── */

export async function fetchGoogleStoreCatalog(): Promise<BrandCatalogItem[]> {
  const locs = await fetchSitemapLocs(
    "https://store.google.com/sitemap/sitemap_in.xml"
  );
  const out: BrandCatalogItem[] = [];
  const seen = new Set<string>();
  for (const loc of locs) {
    let u: URL;
    try {
      u = new URL(loc);
    } catch {
      continue;
    }
    if (!u.hostname.includes("store.google.com")) continue;
    const m = u.pathname.match(/^\/in\/product\/([^/]+)\/?$/i);
    if (!m) continue;
    const slug = m[1].toLowerCase();
    const url = `https://store.google.com/in/product/${slug}?hl=en-IN`;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(item("Google", prettySlug(slug, "Google"), url));
  }

  // Merge category page HTML for anything sitemap missed
  const html = await fetchText(
    "https://store.google.com/in/category/phones?hl=en-IN"
  );
  const fromNav = itemsFromHtmlPaths(
    html,
    "https://store.google.com/in/",
    "Google",
    (pathname) => {
      const m = pathname.match(/^\/in\/product\/([^/]+)\/?$/i);
      if (!m) return null;
      const slug = m[1].toLowerCase();
      return {
        slug,
        url: `https://store.google.com/in/product/${slug}?hl=en-IN`,
      };
    }
  );

  return mergeItems(out, fromNav);
}

/* ─── POCO (poco.in is empty JS; use po.co/global) ─────────────────────── */

export async function fetchPocoCatalog(): Promise<BrandCatalogItem[]> {
  const html = await fetchText("https://www.po.co/global/");
  const fromGlobal = itemsFromHtmlPaths(
    html,
    "https://www.po.co/global/",
    "POCO",
    (pathname) => {
      const m = pathname.match(/\/product\/(poco-[^/]+)\/?$/i);
      if (!m) return null;
      const slug = m[1].toLowerCase();
      if (/series$/i.test(slug)) return null;
      // Prefer India marketing URL when possible
      return {
        slug,
        url: `https://www.poco.in/product/${slug}`,
      };
    }
  );

  // Also pull absolute global product URLs from raw HTML
  const extras: BrandCatalogItem[] = [];
  const seen = new Set(fromGlobal.map((i) => i.url));
  for (const m of html.matchAll(
    /https?:\/\/www\.po\.co\/global\/product\/(poco-[a-z0-9-]+)\/?/gi
  )) {
    const slug = m[1].toLowerCase();
    if (/series$/i.test(slug)) continue;
    const url = `https://www.poco.in/product/${slug}`;
    if (seen.has(url)) continue;
    seen.add(url);
    extras.push(item("POCO", prettySlug(slug, "POCO"), url));
  }

  return mergeItems(fromGlobal, extras);
}

/* ─── Motorola ─────────────────────────────────────────────────────────── */

export async function fetchMotorolaCatalog(): Promise<BrandCatalogItem[]> {
  const locs = await fetchSitemapLocs(
    "https://www.motorola.in/sitemap/product-0.xml"
  );
  const fromSitemap: BrandCatalogItem[] = [];
  const seen = new Set<string>();
  for (const loc of locs) {
    let u: URL;
    try {
      u = new URL(loc);
    } catch {
      continue;
    }
    if (!u.hostname.includes("motorola.in")) continue;
    if (!/\/p$/i.test(u.pathname)) continue;
    const slug = u.pathname.replace(/\/p$/i, "").replace(/^\//, "");
    if (!slug) continue;
    const url = `https://www.motorola.in/${slug}/p`;
    if (seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    fromSitemap.push(item("Motorola", prettySlug(slug, "Motorola"), url));
  }

  const html = await fetchText("https://www.motorola.in/");
  const fromNav = itemsFromHtmlPaths(
    html,
    "https://www.motorola.in/",
    "Motorola",
    (pathname) => {
      const m = pathname.match(/^\/([^/]+)\/p\/?$/i);
      if (!m) return null;
      const slug = m[1];
      return { slug, url: `https://www.motorola.in/${slug}/p` };
    }
  );

  return mergeItems(fromNav, fromSitemap);
}

/* ─── Lava ─────────────────────────────────────────────────────────────── */

export async function fetchLavaCatalog(): Promise<BrandCatalogItem[]> {
  const sitemap = await fetchSitemapLocs(
    "https://www.lavamobiles.com/sitemap.xml"
  );
  const fromSitemap: BrandCatalogItem[] = [];
  const seen = new Set<string>();
  for (const loc of sitemap) {
    let u: URL;
    try {
      u = new URL(loc);
    } catch {
      continue;
    }
    const m = u.pathname.match(/^\/smartphones\/([^/]+)\/?$/i);
    if (!m) continue;
    const slug = m[1].toLowerCase();
    const url = `https://www.lavamobiles.com/smartphones/${slug}`;
    if (seen.has(url)) continue;
    seen.add(url);
    fromSitemap.push(item("Lava", prettySlug(slug, "Lava"), url));
  }

  const html = await fetchText("https://www.lavamobiles.com/");
  const fromNav = itemsFromHtmlPaths(
    html,
    "https://www.lavamobiles.com/",
    "Lava",
    (pathname) => {
      const m = pathname.match(/^\/smartphones\/([^/]+)\/?$/i);
      if (!m) return null;
      const slug = m[1].toLowerCase();
      return {
        slug,
        url: `https://www.lavamobiles.com/smartphones/${slug}`,
      };
    }
  );

  return mergeItems(fromNav, fromSitemap);
}

/* ─── HMD / Nokia India ────────────────────────────────────────────────── */

const HMD_SKIP =
  /^(about|accessories|all-phones|better-phone|blog|choose|compare|compliance|e-waste|ethics|feature-phones|nokia-smartphones|press|privacy|rg-tnc|security|self-repair|seller|smartphones|support|sustainability|tablets|terms|store-locator)/i;

export async function fetchHmdCatalog(): Promise<BrandCatalogItem[]> {
  const locs = await fetchSitemapLocs(
    "https://www.hmd.com/en_in/sitemap-dtc.xml"
  );
  const fromSitemap: BrandCatalogItem[] = [];
  const seen = new Set<string>();
  for (const loc of locs) {
    let u: URL;
    try {
      u = new URL(loc);
    } catch {
      continue;
    }
    if (!u.hostname.includes("hmd.com")) continue;
    if (/\/specs\/?$/i.test(u.pathname)) continue;
    const m = u.pathname.match(/^\/en_in\/([^/]+)\/?$/i);
    if (!m) continue;
    const slug = m[1].toLowerCase();
    if (HMD_SKIP.test(slug)) continue;
    if (/contest|guess|tnc|terms|policy|bundle|cover|case|christmas|warranty/i.test(slug))
      continue;
    if (!/^(hmd-|nokia-)/i.test(slug)) continue;
    const url = `https://www.hmd.com/en_in/${slug}`;
    if (seen.has(url)) continue;
    seen.add(url);
    const brand = /^nokia/i.test(slug) ? "Nokia" : "HMD";
    fromSitemap.push(item(brand, prettySlug(slug, brand), url));
  }

  const html = await fetchText("https://www.hmd.com/en_in");
  const fromNav = itemsFromHtmlPaths(
    html,
    "https://www.hmd.com/en_in",
    "HMD",
    (pathname) => {
      const m = pathname.match(/^\/en_in\/([^/]+)\/?$/i);
      if (!m) return null;
      const slug = m[1].toLowerCase();
      if (HMD_SKIP.test(slug)) return null;
      if (!/^(hmd-|nokia-)/i.test(slug)) return null;
      return { slug, url: `https://www.hmd.com/en_in/${slug}` };
    }
  );

  return mergeItems(fromSitemap, fromNav);
}

/**
 * Route a page URL to the best live catalog fetcher.
 * Returns null when the URL is not a handled brand hub.
 */
export async function fetchLiveBrandCatalog(
  pageUrl: string
): Promise<BrandCatalogItem[] | null> {
  try {
    const u = new URL(pageUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "/";

    if (host.includes("vivo.com") || host.includes("shop.vivo.com")) {
      const {
        fetchVivoShopCatalog,
        isVivoShopListingUrl,
        isVivoShopProductUrl,
      } = await import("./liveBrandCatalogs");
      // Single PDP — catalog expand is wrong here
      if (isVivoShopProductUrl(pageUrl)) return null;
      // Prefer live e-store cards (shop.vivo.com) when available
      if (
        isVivoShopListingUrl(pageUrl) ||
        (host.includes("shop.vivo.com") && /\/products\/phone/i.test(path)) ||
        path === "/" ||
        path === "/in" ||
        /\/products\/?$/i.test(path)
      ) {
        const shopUrl =
          host.includes("shop.vivo.com") && /\/products\/phone/i.test(path)
            ? pageUrl
            : "https://shop.vivo.com/in/products/phone";
        const shop = await fetchVivoShopCatalog(shopUrl);
        if (shop.length >= 4) {
          // www hub: merge shop cards with sitemap so older SKUs stay available
          if (!host.includes("shop.vivo.com")) {
            const sitemap = await fetchVivoCatalog();
            return mergeItems(shop, sitemap);
          }
          return shop;
        }
        if (
          path === "/" ||
          path === "/in" ||
          /\/products\/?$/i.test(path)
        ) {
          return fetchVivoCatalog();
        }
      }
      return null;
    }

    if (host.includes("oppo.com")) {
      if (
        path === "/" ||
        path === "/in" ||
        /\/(smartphones|accessories)\/?$/i.test(path)
      ) {
        return fetchOppoCatalog();
      }
      return null;
    }

    if (host.includes("oneplus.in") || host.includes("oneplus.com")) {
      if (path === "/" || path === "" || /\/(phones|store)(\/|$)/i.test(path)) {
        return fetchOnePlusCatalog();
      }
      return null;
    }

    if (host.includes("store.google.com")) {
      if (
        path === "/" ||
        path === "/in" ||
        /\/category\//i.test(path) ||
        /\/collection\//i.test(path)
      ) {
        return fetchGoogleStoreCatalog();
      }
      return null;
    }

    if (host.includes("poco.in") || host.includes("po.co")) {
      if (path === "/" || path === "" || /\/phone/i.test(path) || /\/global/i.test(path)) {
        return fetchPocoCatalog();
      }
      return null;
    }

    if (host.includes("motorola.in") || host.includes("motorola.com")) {
      if (
        path === "/" ||
        /\/(phones|all-phones|smartphones)(\/|$)/i.test(path)
      ) {
        return fetchMotorolaCatalog();
      }
      return null;
    }

    if (host.includes("lavamobiles.com") || host.includes("lava.com")) {
      if (path === "/" || /\/smartphones/i.test(path)) {
        return fetchLavaCatalog();
      }
      return null;
    }

    if (host.includes("hmd.com")) {
      if (
        path === "/" ||
        /\/en_in\/?$/i.test(path) ||
        /\/(smartphones|all-phones|feature-phones|tablets|accessories)(\/|$)/i.test(
          path
        )
      ) {
        return fetchHmdCatalog();
      }
      return null;
    }

    // Existing liveBrandCatalogs handlers
    if (host.includes("realme.com")) {
      const { fetchRealmeCatalog, isRealmeListingUrl } = await import(
        "./liveBrandCatalogs"
      );
      if (isRealmeListingUrl(pageUrl)) return fetchRealmeCatalog(pageUrl);
      return null;
    }

    if (host.includes("mi.com") || host.includes("xiaomi.com")) {
      const {
        fetchXiaomiCategoryCatalog,
        isXiaomiCategoryListingUrl,
      } = await import("./liveBrandCatalogs");
      if (isXiaomiCategoryListingUrl(pageUrl)) {
        return fetchXiaomiCategoryCatalog(pageUrl);
      }
      return null;
    }

    if (host.includes("iqoo.com") || host.includes("shop.iqoo.com")) {
      const { fetchIqooShopCatalog, isIqooShopListingUrl } = await import(
        "./liveBrandCatalogs"
      );
      if (
        isIqooShopListingUrl(pageUrl) ||
        path === "/" ||
        path === "/in" ||
        /shop\.iqoo\.com/i.test(host)
      ) {
        return fetchIqooShopCatalog();
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}
