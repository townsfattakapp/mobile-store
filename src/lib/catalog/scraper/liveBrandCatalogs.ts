/**
 * Live catalog fetchers for brand hubs where curated lists fall behind
 * (iQOO shop, Xiaomi phone finder, …).
 */

import * as cheerio from "cheerio";
import type { BrandCatalogItem } from "./brandCatalogs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function item(brand: string, name: string, url: string): BrandCatalogItem {
  return { brand, name, url };
}

/** Map iQOO card title → marketing PDP slug */
function iqooSlugFromName(name: string): string {
  const n = name
    .toLowerCase()
    .replace(/refurbished/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const table: [RegExp, string][] = [
    [/z11\s*lite/, "z11-Lite-44w"],
    [/z11x/, "z11x"],
    [/iqoo\s*15\s*r|iqoo15r|15r/, "iqoo15r"],
    [/iqoo\s*15\b|iqoo15\b/, "iqoo15"],
    [/iqoo\s*13\b/, "iqoo13"],
    [/neo\s*10\s*r/, "neo10r"],
    [/neo\s*10\b/, "neo10"],
    [/z10\s*r/, "z10r-5g"],
    [/z10\s*lite/, "z10-lite"],
    [/z10\b/, "z10-5g"],
  ];
  for (const [re, slug] of table) {
    if (re.test(n)) return slug;
  }
  return n
    .replace(/^iqoo\s+/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function prettyIqooName(raw: string): string {
  let n = raw
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // slug form: neo10r / z10r-5g / _NEO_10R
  if (/^[a-z0-9-\s]+$/i.test(n) && !/\s/.test(n.replace(/[-_]/g, ""))) {
    n = n
      .replace(/-/g, " ")
      .replace(/([a-z])(\d)/gi, "$1 $2")
      .replace(/(\d)([a-z])/gi, "$1 $2");
  }
  if (!/^iqoo\b/i.test(n) && !/^neo\b/i.test(n) && !/^z\d/i.test(n)) {
    n = `iQOO ${n}`;
  }
  if (/^neo\b/i.test(n)) n = `iQOO ${n}`;
  if (/^z\d/i.test(n)) n = `iQOO ${n}`;
  return n
    .replace(/\biqoo\b/gi, "iQOO")
    .replace(/\b5g\b/gi, "5G")
    .replace(/\bNEO\b/gi, "Neo")
    .replace(/\bNeo\s*(\d)/gi, "Neo $1")
    .replace(/(\d)\s+([rR])\b/g, "$1$2")
    .replace(/\bZ(\d)/gi, "Z$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse https://shop.iqoo.com/in/products/phone — typically 12 goods-item cards
 * (new + refurbished).
 */
export async function fetchIqooShopCatalog(
  pageUrl = "https://shop.iqoo.com/in/products/phone"
): Promise<BrandCatalogItem[]> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const out: BrandCatalogItem[] = [];
    const seen = new Set<string>();

    $(".goods-item").each((_, el) => {
      const nameRaw = $(el)
        .find(".phone-name h3, h3.thick-font")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      if (!nameRaw || nameRaw.length < 3) return;
      if (/flagship|series|guarantee|about/i.test(nameRaw)) return;

      const name = prettyIqooName(nameRaw);
      const slug = iqooSlugFromName(nameRaw);
      if (!slug) return;

      const isRefurb = /refurbished/i.test(nameRaw);
      const url = isRefurb
        ? `https://www.iqoo.com/in/products/${slug}?condition=refurbished`
        : `https://www.iqoo.com/in/products/${slug}`;

      const key = url.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(item("iQOO", name, url));
    });

    // Also pull nav / “new” model links not present as goods cards
    const paths = [
      ...html.matchAll(
        /https?:\/\/www\.iqoo\.com\/in\/products\/([a-zA-Z0-9_-]+)/g
      ),
    ];
    for (const m of paths) {
      const slug = m[1];
      if (/^phone$/i.test(slug)) continue;
      const url = `https://www.iqoo.com/in/products/${slug}`;
      if (seen.has(url.toLowerCase())) continue;
      seen.add(url.toLowerCase());
      const name = prettyIqooName(slug.replace(/[-_]+/g, " "));
      out.push(item("iQOO", name, url));
    }

    return out;
  } catch {
    return [];
  }
}

const MI_PHONE_EXCLUDE =
  /power-bank|watch|band|pad|tv-|earphone|earbuds?|buds|charger|cable|speaker|vacuum|robot|humidifier|cleaner|scooter|router|camera(?!-)|notebook|laptop|cover|keyboard|focus-pen|smart-pen|filter|wall-mount|grooming|toothbrush|sound-outdoor|air-purifier/i;

type MiCategory = "phone" | "tablet" | "watch-audio" | "tv-smart-home" | "store" | "all";

function miCategoryFromUrl(url: string): MiCategory | null {
  try {
    const u = new URL(url);
    if (!(u.hostname.includes("mi.com") || u.hostname.includes("xiaomi.com")))
      return null;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    if (/\/tablet/i.test(path)) return "tablet";
    if (/\/watch-audio/i.test(path)) return "watch-audio";
    if (/\/tv-smart-home/i.test(path)) return "tv-smart-home";
    if (/\/store/i.test(path)) return "store";
    if (/\/phone/i.test(path) || /\/product-list\/(xiaomi|redmi)/i.test(path))
      return "phone";
    if (path === "" || path === "/" || path === "/in") return "all";
    return null;
  } catch {
    return null;
  }
}

function miListingUrlFor(cat: MiCategory): string {
  switch (cat) {
    case "tablet":
      return "https://www.mi.com/in/tablet";
    case "watch-audio":
      return "https://www.mi.com/in/watch-audio";
    case "tv-smart-home":
      return "https://www.mi.com/in/tv-smart-home";
    case "store":
      return "https://www.mi.com/in/store/";
    case "phone":
      return "https://www.mi.com/in/phone/";
    case "all":
    default:
      return "https://www.mi.com/in/phone/";
  }
}

function prettyMiName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    // Slugs like pad-8-8-pro-cover → "Pad 8 / 8 Pro Cover"
    .replace(/\bPad 8 8 Pro\b/gi, "Pad 8 / 8 Pro")
    .replace(/\b5g\b/gi, "5G")
    .replace(/\bSe\b/g, "SE")
    .replace(/\bPro Plus\b/gi, "Pro+")
    .replace(/\b17t\b/gi, "17T")
    .replace(/\bIr\b/g, "IR")
    .replace(/\bQled\b/g, "QLED")
    .replace(/\bLed\b/g, "LED")
    .replace(/\bWifi\b/g, "Wi-Fi")
    .replace(/\b4k\b/gi, "4K")
    .replace(/\bTv\b/g, "TV")
    .trim();
}

function shouldKeepMiSlug(slug: string, cat: MiCategory): boolean {
  if (!slug) return false;
  if (cat === "phone") return !MI_PHONE_EXCLUDE.test(slug);
  // Category pages: keep every product linked on that page (tablets, covers, TVs, buds, …)
  return true;
}

async function fetchMiProductLinksFromPage(
  pageUrl: string,
  cat: MiCategory
): Promise<BrandCatalogItem[]> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) return [];
    const html = await res.text();
    const out: BrandCatalogItem[] = [];
    const seen = new Set<string>();

    const links = [
      ...html.matchAll(/href=["']([^"']*\/product\/[^"']+)["']/gi),
    ].map((m) => m[1]);

    for (const raw of links) {
      let abs = "";
      try {
        abs = new URL(raw, pageUrl).href;
      } catch {
        continue;
      }
      abs = abs.split("?")[0].replace(/\/buy\/?$/i, "/");
      if (!/\/product\//i.test(abs)) continue;

      const slug =
        abs.match(/\/product\/([^/]+)\/?/i)?.[1]?.toLowerCase() || "";
      if (!shouldKeepMiSlug(slug, cat)) continue;

      const canon = `https://www.mi.com/in/product/${slug}/`;
      if (seen.has(canon)) continue;
      seen.add(canon);

      out.push(item("Xiaomi", prettyMiName(slug), canon));
    }

    return out;
  } catch {
    return [];
  }
}

/**
 * Live phones from https://www.mi.com/in/phone/
 * @deprecated prefer fetchXiaomiCategoryCatalog
 */
export async function fetchXiaomiPhoneCatalog(
  pageUrl = "https://www.mi.com/in/phone/"
): Promise<BrandCatalogItem[]> {
  return fetchMiProductLinksFromPage(pageUrl, "phone");
}

/**
 * Live Xiaomi India category catalog:
 * phone | tablet | watch-audio | tv-smart-home | store | homepage (all).
 */
export async function fetchXiaomiCategoryCatalog(
  pageUrl: string
): Promise<BrandCatalogItem[]> {
  const cat = miCategoryFromUrl(pageUrl) || "phone";

  if (cat === "all" || cat === "store") {
    // Aggregate major shop sections so /store and homepage aren't capped at 5 promos
    const sections: MiCategory[] = [
      "phone",
      "tablet",
      "watch-audio",
      "tv-smart-home",
    ];
    const merged: BrandCatalogItem[] = [];
    const seen = new Set<string>();
    for (const section of sections) {
      const items = await fetchMiProductLinksFromPage(
        miListingUrlFor(section),
        section
      );
      for (const i of items) {
        if (seen.has(i.url)) continue;
        seen.add(i.url);
        merged.push(i);
      }
    }
    // Also include anything linked on the requested page itself
    const onPage = await fetchMiProductLinksFromPage(
      cat === "store" ? "https://www.mi.com/in/store/" : pageUrl,
      cat === "store" ? "store" : "phone"
    );
    for (const i of onPage) {
      if (seen.has(i.url)) continue;
      // store homepage promos may include power banks — keep them as extras
      if (cat === "all" && MI_PHONE_EXCLUDE.test(i.url)) {
        // skip accessory promos on homepage aggregate? keep phones-first from sections
        continue;
      }
      seen.add(i.url);
      merged.push(i);
    }
    return merged;
  }

  return fetchMiProductLinksFromPage(miListingUrlFor(cat), cat);
}

export function isIqooShopListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("iqoo.com") &&
      /\/products\/phone\/?$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

export function isXiaomiPhoneListingUrl(url: string): boolean {
  return miCategoryFromUrl(url) === "phone" || miCategoryFromUrl(url) === "all";
}

export function isXiaomiCategoryListingUrl(url: string): boolean {
  return miCategoryFromUrl(url) != null;
}

/* ─── realme India ─────────────────────────────────────────────────────── */

const REALME_SKIP_SLUG =
  /^(realme-ui|realme-membership|realme-student|realme-exchange|realme-music|realme-events|realmeow|next-ai|productcompare|independence|brand|user|orders|coupons|rpass|reviews|address|search|store|support|login|logout|bulk-order|app-download)/i;

/** Extra audio / wearables / tablets often not in sitemap (verified PDP paths). */
const REALME_ACCESSORY_URLS: { name: string; url: string }[] = [
  { name: "realme Buds Air8 Pro", url: "https://www.realme.com/in/more-products/realme-buds-air-8-pro" },
  { name: "realme Buds Air 8", url: "https://www.realme.com/in/more-products/realme-buds-air-8" },
  { name: "realme Buds Air7", url: "https://www.realme.com/in/more-products/realme-buds-air-7" },
  { name: "realme Buds Air6 Pro", url: "https://www.realme.com/in/more-products/realme-buds-air-6-pro" },
  { name: "realme Buds Air 5 Pro", url: "https://www.realme.com/in/realme-buds-air-5-pro" },
  { name: "realme Buds T500 Pro", url: "https://www.realme.com/in/more-products/realme-buds-t500-pro" },
  { name: "realme Buds T310", url: "https://www.realme.com/in/more-products/realme-buds-t310" },
  { name: "realme Buds T110", url: "https://www.realme.com/in/realme-buds-t110" },
  { name: "realme Buds Clip", url: "https://www.realme.com/in/more-products/realme-buds-clip" },
  { name: "realme Techlife Studio H1", url: "https://www.realme.com/in/more-products/realme-techlife-studio-h1" },
  { name: "realme Buds Wireless 5 ANC", url: "https://www.realme.com/in/more-products/realme-buds-wireless-5-anc" },
  { name: "realme Buds Wireless 3 Neo", url: "https://www.realme.com/in/realme-buds-wireless-3-neo" },
  { name: "realme Watch S5", url: "https://www.realme.com/in/realme-watch-s5" },
  { name: "realme Watch 5", url: "https://www.realme.com/in/more-products/realme-watch-5" },
  { name: "realme Watch S2", url: "https://www.realme.com/in/more-products/realme-watch-s2" },
  { name: "realme Pad 3", url: "https://www.realme.com/in/realme-pad-3" },
  { name: "realme Pad 2", url: "https://www.realme.com/in/realme-pad-2" },
  { name: "realme Pad 2 Lite", url: "https://www.realme.com/in/realme-pad-2-lite" },
];

function prettyRealmeName(slug: string, linkText?: string): string {
  const fromLink = (linkText || "")
    .replace(/\s+/g, " ")
    .replace(/^(NEW|New)\s*/i, "")
    .trim();
  if (fromLink && /realme|narzo|buds|watch|pad/i.test(fromLink) && fromLink.length < 80) {
    return fromLink.replace(/\brealme\b/gi, "realme").trim();
  }
  return slug
    .replace(/^realme-/, "realme-")
    .replace(/-/g, " ")
    .replace(/\bplus\b/gi, "+")
    .replace(/\b5g\b/gi, "5G")
    .replace(/\b4g\b/gi, "4G")
    .replace(/\bgt\b/gi, "GT")
    .replace(/\bnarzo\b/gi, "NARZO")
    .replace(/\bpad\b/gi, "Pad")
    .replace(/\bbuds\b/gi, "Buds")
    .replace(/\bwatch\b/gi, "Watch")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bRealme\b/g, "realme")
    .replace(/\b5G\b/g, "5G")
    .replace(/\bGt\b/g, "GT")
    .replace(/\bNarzo\b/g, "NARZO")
    .trim();
}

function isRealmeProductPath(pathname: string): {
  ok: boolean;
  url: string;
  slug: string;
} | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const more = path.match(/^\/in\/more-products\/([^/]+)$/i);
  const direct = path.match(/^\/in\/([^/]+)$/i);
  if (more) {
    const slug = more[1].toLowerCase();
    if (REALME_SKIP_SLUG.test(slug)) return null;
    return {
      ok: true,
      slug,
      url: `https://www.realme.com/in/more-products/${slug}`,
    };
  }
  if (direct) {
    const slug = direct[1].toLowerCase();
    if (REALME_SKIP_SLUG.test(slug)) return null;
    if (!/^realme[-_]/i.test(slug) && !/^narzo/i.test(slug)) return null;
    // Soft-launch / campaign landings often 404 for bots
    if (/-new-launch$/i.test(slug)) return null;
    if (/astonmartin|dream-edition|music-fest|events-by/i.test(slug)) return null;
    return {
      ok: true,
      slug,
      url: `https://www.realme.com/in/${slug}`,
    };
  }
  return null;
}

async function fetchRealmeSitemapProducts(): Promise<BrandCatalogItem[]> {
  try {
    const res = await fetch("https://www.realme.com/sitemap-in.xml", {
      headers: { "User-Agent": UA, Accept: "application/xml,text/xml,*/*" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const out: BrandCatalogItem[] = [];
    const seen = new Set<string>();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
      let loc = m[1].trim();
      if (!/realme\.com\/in\//i.test(loc)) continue;
      if (/\/specs\/?$/i.test(loc)) continue;
      try {
        const u = new URL(loc);
        const hit = isRealmeProductPath(u.pathname);
        if (!hit) continue;
        if (seen.has(hit.url)) continue;
        seen.add(hit.url);
        out.push(item("realme", prettyRealmeName(hit.slug), hit.url));
      } catch {
        /* ignore */
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchRealmeNavProducts(
  pageUrl = "https://www.realme.com/in/"
): Promise<BrandCatalogItem[]> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const out: BrandCatalogItem[] = [];
    const seen = new Set<string>();

    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      let abs: URL;
      try {
        abs = new URL(href, pageUrl);
      } catch {
        return;
      }
      if (!abs.hostname.includes("realme.com")) return;
      const hit = isRealmeProductPath(abs.pathname);
      if (!hit) return;
      if (seen.has(hit.url)) return;
      seen.add(hit.url);
      const text = $(el).text().replace(/\s+/g, " ").trim();
      out.push(item("realme", prettyRealmeName(hit.slug, text), hit.url));
    });

    return out;
  } catch {
    return [];
  }
}

/**
 * Live realme India catalog for search / home / phones hubs.
 * Search results are JS-only (“No result found” in SSR) — we expand via
 * sitemap + nav + accessory PDPs instead.
 */
export async function fetchRealmeCatalog(
  _pageUrl?: string
): Promise<BrandCatalogItem[]> {
  const [sitemap, nav] = await Promise.all([
    fetchRealmeSitemapProducts(),
    fetchRealmeNavProducts("https://www.realme.com/in/"),
  ]);

  const merged: BrandCatalogItem[] = [];
  const seen = new Set<string>();

  for (const i of [...nav, ...sitemap]) {
    if (seen.has(i.url)) continue;
    seen.add(i.url);
    merged.push(i);
  }

  for (const a of REALME_ACCESSORY_URLS) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    merged.push(item("realme", a.name, a.url));
  }

  return merged;
}

export function isRealmeListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("realme.com")) return false;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return (
      path === "" ||
      path === "/" ||
      path === "/in" ||
      /\/search/i.test(path) ||
      /\/(phones?|realme-phones|store)(\/|$)/i.test(path)
    );
  } catch {
    return false;
  }
}
