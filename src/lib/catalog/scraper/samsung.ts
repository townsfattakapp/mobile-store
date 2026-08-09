/**
 * Samsung India helpers — public Search API + ProductGroup JSON-LD on buy pages.
 * @see https://www.samsung.com/in
 */

export type SamsungCatalogItem = {
  name: string;
  url: string;
  image?: string;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Smartphone finder type code used by Samsung IN site */
const SMARTPHONE_TYPE = "01010000";
const TABLET_TYPE = "01020000";
const WATCH_TYPE = "01030000";
const BUDS_TYPE = "01040000";

function samsungTypeFromUrl(pageUrl: string): string[] {
  try {
    const path = new URL(pageUrl).pathname.toLowerCase();
    // Computers / Galaxy Book / monitors — not mobile finder API
    if (/\/computers|galaxy-book|\/monitors|all-monitors/i.test(path)) {
      if (/monitor/i.test(path)) return ["07010000"];
      // Empty → CategoryScraper falls through to HTML link extraction
      return [];
    }
    if (/all-tablets|\/tablets/i.test(path)) return [TABLET_TYPE];
    if (/all-watches|\/watches/i.test(path)) return [WATCH_TYPE];
    if (/buds|audio|wearables/i.test(path) && /all-|audio/i.test(path))
      return [BUDS_TYPE];
    // Homepage / mobile hub → full mobile ecosystem
    if (
      path === "/" ||
      /^\/[a-z]{2}$/i.test(path.replace(/\/+$/, "")) ||
      /\/mobile\/?$/i.test(path)
    ) {
      return [SMARTPHONE_TYPE, TABLET_TYPE, WATCH_TYPE, BUDS_TYPE];
    }
  } catch {
    /* ignore */
  }
  return [SMARTPHONE_TYPE];
}

export function isSamsungHost(url: string): boolean {
  try {
    return new URL(url).hostname.includes("samsung.com");
  } catch {
    return false;
  }
}

export function isSamsungListingUrl(url: string): boolean {
  if (!isSamsungHost(url)) return false;
  try {
    const path = new URL(url).pathname.toLowerCase().replace(/\/+$/, "") || "/";
    if (path === "/" || /^\/[a-z]{2}$/i.test(path)) return true; // /in
    if (/\/all-smartphones$/i.test(path)) return true;
    if (/\/smartphones$/i.test(path)) return true;
    if (/\/smartphones\/galaxy-[a-z]$/i.test(path)) return true; // /galaxy-s series hub
    if (/\/mobile$/i.test(path)) return true;
    if (/\/all-tablets$|\/all-watches$|\/all-mobile-accessories$/i.test(path))
      return true;
    if (/\/all-computers$/i.test(path) || /\/computers\/?$/i.test(path))
      return true;
    // Galaxy Book family hubs only — SKUs embed "-np750..." in the last segment
    if (
      /\/galaxy-book\/?$/i.test(path) ||
      (/\/computers\/galaxy-book\/?$/i.test(path) && !/-np[0-9a-z-]+/i.test(path))
    ) {
      return true;
    }
    if (/\/galaxy-book/i.test(path) && !/-np[0-9a-z-]+/i.test(path) && !/\/np[0-9a-z-]+/i.test(path))
      return true;
    if (/\/monitors(\/|$)|\/all-monitors$/i.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Parse Galaxy Book / computer PDPs out of Samsung computers hub HTML. */
export function extractSamsungComputerLinksFromHtml(
  html: string,
  pageUrl: string
): SamsungCatalogItem[] {
  const origin = "https://www.samsung.com";
  const seen = new Set<string>();
  const items: SamsungCatalogItem[] = [];
  const re =
    /\/in\/computers\/galaxy-book\/(galaxy-book[a-z0-9\-]*?np[a-z0-9\-]+)\/?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].replace(/\/+$/, "").toLowerCase();
    if (seen.has(slug)) continue;
    seen.add(slug);
    const path = `/in/computers/galaxy-book/${slug}/`;
    const name = slug
      .replace(/-np[a-z0-9\-]+$/i, "")
      .split("-")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    items.push({
      name: name || slug,
      url: `${origin}${path}`,
    });
  }
  return items;
}

/** Galaxy Book / computer SKU pages: …-np750xgj-lg2in/ */
export function isSamsungComputerProductUrl(url: string): boolean {
  if (!isSamsungHost(url)) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return (
      /\/computers\/galaxy-book\//i.test(path) &&
      /-np[0-9a-z-]+/i.test(path)
    );
  } catch {
    return false;
  }
}

/**
 * Parse schema.org Product JSON-LD (Galaxy Book pages often lack ProductGroup).
 */
export function parseSamsungProductJsonLd(html: string): {
  modelName: string;
  description: string;
  price: number;
  image: string;
  sku: string;
} | null {
  const blocks = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];
  for (const m of blocks) {
    try {
      const parsed = JSON.parse(m[1]);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      const queue = [...nodes];
      while (queue.length) {
        const n = queue.shift();
        if (!n || typeof n !== "object") continue;
        if (Array.isArray(n["@graph"])) queue.push(...n["@graph"]);
        const type = String(n["@type"] || "");
        if (!/Product$/i.test(type) || /ProductGroup/i.test(type)) continue;
        const offers = Array.isArray(n.offers) ? n.offers[0] : n.offers;
        const price =
          Math.round(parseFloat(String(offers?.price || offers?.lowPrice || "0"))) ||
          0;
        const imageRaw = n.image;
        const image =
          typeof imageRaw === "string"
            ? absSamsungUrl(imageRaw)
            : Array.isArray(imageRaw)
              ? absSamsungUrl(String(imageRaw[0] || ""))
              : absSamsungUrl(String(imageRaw?.url || ""));
        const modelName = String(n.name || "")
          .replace(/\s*[|–—].*$/, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!modelName) continue;
        return {
          modelName,
          description: String(n.description || "").slice(0, 500),
          price,
          image,
          sku: String(n.sku || offers?.sku || ""),
        };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function isSamsungProductUrl(url: string): boolean {
  if (!isSamsungHost(url)) return false;
  try {
    const u = new URL(url);
    if (u.searchParams.get("smc") || u.searchParams.get("modelCode")) return true;
    const path = u.pathname.toLowerCase();
    if (/\/buy\/?$/i.test(path)) return true;
    // SKU deep links: …-sm-e476…/ or certified …-sm5s938…/
    if (/\bsm-?[a-z0-9]{6,}\b/i.test(path)) return true;
    // Galaxy Book configs
    if (isSamsungComputerProductUrl(url)) return true;
    // /in/smartphones/galaxy-s26-ultra/ (not series hub /galaxy-s/)
    if (
      /\/smartphones\/galaxy-[a-z0-9-]+/i.test(path) &&
      !/\/smartphones\/galaxy-[a-z]\/?$/i.test(path) &&
      !/all-smartphones/i.test(path)
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function absSamsungUrl(pathOrUrl: string, siteOrigin = "https://www.samsung.com"): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("//")) return `https:${pathOrUrl}`;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return `${siteOrigin}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function preferBuyUrl(pdpUrl: string): string {
  const abs = absSamsungUrl(pdpUrl);
  if (/\/buy\/?$/i.test(abs)) return abs.replace(/\/?$/, "/");
  // Family PDP → buy page often has ProductGroup JSON-LD
  // Skip SKU deep-links (they scrape via Search API using sm- code)
  if (/\/smartphones\/galaxy-[^/]+\/?$/i.test(abs) && !/\bsm-?/i.test(abs)) {
    return abs.replace(/\/?$/, "/buy/");
  }
  return abs;
}

/** Prefer SKU deep-link (has model code) over short family /buy/ URLs that often 404 */
function bestSamsungCatalogUrl(model: any, origin: string): string {
  const originPdp = String(model.originPdpUrl || "");
  const pdp = String(model.pdpUrl || "");
  const code = String(model.modelCode || "").trim();
  const withCode =
    [originPdp, pdp].find((p) => /\bsm-?[a-z0-9]+/i.test(p)) || "";
  const family =
    [pdp, originPdp].find(
      (p) =>
        /\/smartphones\/galaxy-[^/]+\/?$/i.test(p) && !/\bsm-?/i.test(p)
    ) || "";
  let url = absSamsungUrl(withCode || family || pdp || originPdp, origin);
  if (!withCode) url = preferBuyUrl(url);
  if (code) {
    try {
      const u = new URL(url);
      u.searchParams.set("smc", code);
      return u.toString();
    } catch {
      return url;
    }
  }
  return url;
}

/**
 * Paginate Samsung IN finder APIs (phones / tablets / watches / buds).
 */
export async function fetchSamsungSmartphoneCatalog(
  pageUrl = "https://www.samsung.com/in/smartphones/all-smartphones/",
  maxPages = 8
): Promise<SamsungCatalogItem[]> {
  const siteCode =
    pageUrl.match(/samsung\.com\/([a-z]{2})\b/i)?.[1]?.toLowerCase() || "in";
  const origin = `https://www.samsung.com`;
  const pageSize = 24;
  const seen = new Set<string>();
  const items: SamsungCatalogItem[] = [];
  const types = samsungTypeFromUrl(pageUrl);

  for (const typeCode of types) {
    for (let page = 0; page < maxPages; page++) {
      const start = page * pageSize + 1;
      const api = `https://searchapi.samsung.com/v6/front/b2c/product/finder/global?type=${typeCode}&siteCode=${siteCode}&start=${start}&num=${pageSize}&sort=newest&onlyFilterInfoYN=N&keySummaryYN=Y`;
      try {
        const res = await fetch(api, {
          headers: {
            "User-Agent": UA,
            Accept: "application/json",
            "Accept-Language": "en-IN,en;q=0.9",
          },
          cache: "no-store",
        });
        if (!res.ok) break;
        const data = await res.json();
        const list: any[] = data?.response?.resultData?.productList || [];
        if (!list.length) break;

        for (const family of list) {
          const name = String(
            family.fmyMarketingName || family.fmyEngName || ""
          ).trim();
          if (/certified|re-?newed|renewed/i.test(name)) continue;
          const model = family.modelList?.[0] || {};
          if (!name || !(model.pdpUrl || model.originPdpUrl || model.modelCode))
            continue;
          const url = bestSamsungCatalogUrl(model, origin);
          const key = name.toLowerCase().replace(/\s+/g, " ");
          const familyKey = key
            .replace(/\(\s*\d+\s*gb\s*memory\s*\)/gi, "")
            .replace(/\(special colour\)/gi, "")
            .trim();
          if (seen.has(familyKey)) continue;
          seen.add(familyKey);

          const image = absSamsungUrl(
            model.largeUrl || model.galleryImageLarge || model.thumbUrl || ""
          );
          items.push({
            name: name
              .replace(/\(\s*\d+\s*gb\s*memory\s*\)/gi, "")
              .replace(/\(special colour\)/gi, "")
              .trim(),
            url,
            image,
          });
        }

        const total = parseInt(
          data?.response?.resultData?.common?.totalRecord || "0",
          10
        );
        if (start + pageSize > total) break;
      } catch (e) {
        console.warn("Samsung finder API failed", e);
        break;
      }
    }
  }

  return items;
}

export type SamsungVariant = {
  sku: string;
  name: string;
  color: string;
  storage: string;
  ram: string;
  price: number;
  image: string;
};

/**
 * Parse schema.org ProductGroup JSON-LD from Samsung buy pages.
 */
export function parseSamsungProductGroup(html: string): {
  modelName: string;
  description: string;
  variants: SamsungVariant[];
  gallery: string[];
  startingPrice: number;
} | null {
  const blocks = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];

  let group: any = null;
  for (const m of blocks) {
    try {
      const parsed = JSON.parse(m[1]);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const n of nodes) {
        const type = String(n?.["@type"] || "");
        if (/ProductGroup/i.test(type) && Array.isArray(n.hasVariant)) {
          group = n;
          break;
        }
      }
      if (group) break;
    } catch {
      /* ignore */
    }
  }
  if (!group) return null;

  const variants: SamsungVariant[] = [];
  const gallery: string[] = [];
  const colorImages: Record<string, string> = {};

  for (const v of group.hasVariant || []) {
    const price = Math.round(parseFloat(v?.offers?.price || "0")) || 0;
    const img = absSamsungUrl(v?.image || "");
    const fullName = String(v?.name || "");
    // "Galaxy S26 Ultra 256 GB｜12 GB Pink Gold"
    let storage = "";
    let ram = "";
    let color = "";
    const mem = fullName.match(
      /(\d+\s*GB|\d+\s*TB)\s*[|｜]\s*(\d+\s*GB)/i
    );
    if (mem) {
      storage = mem[1].replace(/\s+/g, "").toUpperCase().replace("GB", "GB");
      if (/tb/i.test(mem[1])) storage = mem[1].replace(/\s+/g, "").toUpperCase();
      ram = mem[2].replace(/\s+/g, "").toUpperCase();
      color = fullName
        .slice(fullName.toLowerCase().indexOf(mem[0].toLowerCase()) + mem[0].length)
        .trim();
    } else {
      const props = Array.isArray(v.additionalProperty)
        ? v.additionalProperty
        : v.additionalProperty
          ? [v.additionalProperty]
          : [];
      const storageProp = props.find((p: any) => /storage/i.test(p?.name || ""));
      if (storageProp?.value) {
        const parts = String(storageProp.value).split(/[|｜]/);
        storage = (parts[0] || "").replace(/\s+/g, "").toUpperCase();
        ram = (parts[1] || "").replace(/\s+/g, "").toUpperCase();
      }
      color = fullName
        .replace(/galaxy[^0-9]*/i, "")
        .replace(/\d+\s*GB.*$/i, "")
        .trim();
    }

    color = color.replace(/\s+/g, " ").trim() || "Standard";
    storage = storage.replace(/\|/g, "").trim() || "";
    ram = ram.replace(/\|/g, "").trim() || "";

    if (img && !/logo|letter\.png|galaxy_ai/i.test(img)) {
      if (!gallery.includes(img)) gallery.push(img);
      if (!colorImages[color]) colorImages[color] = img;
    }

    variants.push({
      sku: String(v.sku || ""),
      name: fullName,
      color,
      storage,
      ram,
      price,
      image: colorImages[color] || img,
    });
  }

  const prices = variants.map((v) => v.price).filter((p) => p >= 5000);
  const modelName = String(group.name || "Galaxy")
    .replace(/\s*[|–—].*$/, "")
    .trim();

  return {
    modelName,
    description: String(group.description || "").slice(0, 500),
    variants,
    gallery: gallery.length ? gallery : Object.values(colorImages),
    startingPrice: prices.length ? Math.min(...prices) : 0,
  };
}

export type SamsungTechSpecs = {
  processor: string;
  display: string;
  camera: string;
  battery: string;
  os: string;
  dimensions: string;
  weight: string;
  /** Flat label → value for storefront table */
  tech_specs: Record<string, string>;
  /** Grouped sections from Samsung API */
  spec_sections: { title: string; items: { name: string; value: string }[] }[];
};

function flattenSpecItems(
  items: any[]
): { title: string; items: { name: string; value: string }[] }[] {
  const sections: { title: string; items: { name: string; value: string }[] }[] =
    [];
  for (const item of items || []) {
    const title = String(item.attrName || "").trim();
    if (!title) continue;
    const children = Array.isArray(item.attrs) ? item.attrs : null;
    if (children?.length) {
      const rows = children
        .map((c: any) => ({
          name: String(c.attrName || "").trim(),
          value: String(c.attrValue || "").trim(),
        }))
        .filter((r: { name: string; value: string }) => r.name && r.value);
      if (rows.length) sections.push({ title, items: rows });
    } else if (item.attrValue) {
      sections.push({
        title,
        items: [{ name: title, value: String(item.attrValue).trim() }],
      });
    }
  }
  return sections;
}

function pickSpec(
  sections: { title: string; items: { name: string; value: string }[] }[],
  sectionMatch: RegExp,
  rowMatch?: RegExp
): string {
  const matches = sections.filter((s) => sectionMatch.test(s.title));
  for (const section of matches) {
    if (rowMatch) {
      const row = section.items.find((i) => rowMatch.test(i.name));
      if (row?.value) return row.value;
      continue; // try next matching section
    }
    return section.items
      .slice(0, 3)
      .map((i) => (i.name === section.title ? i.value : `${i.name}: ${i.value}`))
      .join(" · ");
  }
  // Fallback: search all rows by name
  if (rowMatch) {
    for (const section of sections) {
      const row = section.items.find((i) => rowMatch.test(i.name));
      if (row?.value) return row.value;
    }
  }
  return "";
}

/** India model codes usually append INS to the shop SKU */
export function toSamsungIndiaModelCode(sku: string, siteCode = "in"): string {
  let code = String(sku || "").trim().toUpperCase();
  if (!code) return "";
  // Galaxy Book / PC SKUs (NP…) — do not append INS
  if (/^NP/i.test(code)) return code;
  // Normalize SM5XXXX (certified renewed) and SMXXXX without hyphen
  if (/^SM[0-9A-Z]/i.test(code) && !code.startsWith("SM-") && !/^SM5/i.test(code)) {
    code = code.replace(/^SM/i, "SM-");
  }
  if (siteCode === "in" && !/INS$/i.test(code) && /^SM/i.test(code)) {
    return `${code}INS`;
  }
  return code;
}

/** Pull SM-XXXX / SM5XXXX from a Samsung PDP URL or ?smc= query */
export function extractSamsungModelCodeFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const smc = u.searchParams.get("smc") || u.searchParams.get("modelCode");
    if (smc && /^(SM|NP)/i.test(smc.trim())) return smc.trim().toUpperCase();

    const path = u.pathname.toLowerCase();
    // Galaxy Book: ...-np750xgj-lg2in/
    const np = path.match(/-(np[0-9a-z]+(?:-[a-z0-9]+)?)\b/i);
    if (np) return np[1].toUpperCase();
    // Standard: ...-sm-e476bzkbins/  or certified: ...-sm5s938bzbbins/
    const m =
      path.match(/-(sm-[a-z0-9]+)\b/i) ||
      path.match(/-(sm5[a-z0-9]+)\b/i) ||
      path.match(/\b(sm-[a-z0-9]+)\b/i);
    if (m) return m[1].toUpperCase();
  } catch {
    /* ignore */
  }
  const m2 =
    String(url).match(/-(np[0-9a-z]+(?:-[a-z0-9]+)?)\b/i) ||
    String(url).match(/-(sm-[a-z0-9]+)\b/i) ||
    String(url).match(/-(sm5[a-z0-9]+)\b/i) ||
    String(url).match(/\b(sm-[a-z0-9]+)\b/i);
  return m2 ? m2[1].toUpperCase() : null;
}

/** galaxy-s25-ultra / galaxy-a56-5g from path (not series hub galaxy-s) */
export function extractGalaxyFamilySlug(url: string): string | null {
  try {
    const parts = new URL(url).pathname
      .toLowerCase()
      .split("/")
      .filter(Boolean);
    const slug = [...parts]
      .reverse()
      .find((p) => /^galaxy-/.test(p) && !/^galaxy-[a-z]$/.test(p));
    if (!slug || slug === "buy") return null;
    let s = slug.replace(/-sm-?[a-z0-9]+$/i, "");
    const known = s.match(
      /^(galaxy-(?:z-fold\d+[a-z]*|z-flip\d+[a-z]*|s\d+(?:-ultra|-plus|-fe|-edge)?|a\d+e?(?:-5g)?|m\d+(?:-5g)?|f\d+(?:e|pro)?(?:-5g)?|[a-z0-9]+(?:-5g)?))/i
    );
    if (known) return known[1];
    // Cut after common model endings
    const cut = s.match(
      /^(galaxy-.+?(?:ultra|plus|fe|edge|pro|5g|4g))(?:-|$)/i
    );
    return cut ? cut[1] : s.split("-").slice(0, 4).join("-");
  } catch {
    return null;
  }
}

/**
 * Resolve a Samsung model code from URL when HTML/ProductGroup is missing.
 * Uses ?smc=, path SM code, then finder match on family slug.
 */
let _finderCache: { siteCode: string; at: number; list: any[] } | null = null;

async function loadSamsungFinderIndex(siteCode: string): Promise<any[]> {
  const now = Date.now();
  if (
    _finderCache &&
    _finderCache.siteCode === siteCode &&
    now - _finderCache.at < 10 * 60 * 1000
  ) {
    return _finderCache.list;
  }

  const pageSize = 24;
  const all: any[] = [];
  for (let page = 0; page < 8; page++) {
    const start = page * pageSize + 1;
    try {
      const api = `https://searchapi.samsung.com/v6/front/b2c/product/finder/global?type=${SMARTPHONE_TYPE}&siteCode=${siteCode}&start=${start}&num=${pageSize}&sort=newest&onlyFilterInfoYN=N&keySummaryYN=Y`;
      const res = await fetch(api, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "Accept-Language": "en-IN,en;q=0.9",
        },
        cache: "no-store",
      });
      if (!res.ok) break;
      const data = await res.json();
      const list: any[] = data?.response?.resultData?.productList || [];
      if (!list.length) break;
      all.push(...list);
      const total = parseInt(
        data?.response?.resultData?.common?.totalRecord || "0",
        10
      );
      if (start + pageSize > total) break;
    } catch {
      break;
    }
  }
  _finderCache = { siteCode, at: now, list: all };
  return all;
}

export async function resolveSamsungModelCodeFromUrl(
  url: string,
  siteCode = "in"
): Promise<string | null> {
  const direct = extractSamsungModelCodeFromUrl(url);
  if (direct) return toSamsungIndiaModelCode(direct, siteCode);

  const slug = extractGalaxyFamilySlug(url);
  if (!slug) return null;

  type Hit = { code: string; score: number };
  const hits: Hit[] = [];
  const list = await loadSamsungFinderIndex(siteCode);

  for (const family of list) {
    const model = family.modelList?.[0] || {};
    const code = String(model.modelCode || "").trim();
    if (!code) continue;
    const paths = `${model.pdpUrl || ""} ${model.originPdpUrl || ""}`.toLowerCase();
    const name = String(
      family.fmyMarketingName || family.fmyEngName || ""
    ).toLowerCase();
    const nameSlug = name
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const pathHit =
      paths.includes(`/${slug}/`) ||
      paths.includes(`/${slug}?`) ||
      paths.includes(`${slug}-`) ||
      new RegExp(`/${slug}(?:/|$|\\?)`).test(paths);
    const nameHit =
      nameSlug === slug ||
      nameSlug.startsWith(`${slug}-`) ||
      nameSlug.includes(`-${slug}`);

    if (!pathHit && !nameHit) continue;

    let score = 0;
    if (pathHit) score += 5;
    if (nameHit) score += 3;
    if (/certified|re-?newed|renewed/i.test(name + paths)) score -= 20;
    if (/^SM5/i.test(code)) score -= 15;
    if (/^SM-/i.test(code)) score += 4;

    hits.push({ code, score });
  }

  if (!hits.length) return null;
  hits.sort((a, b) => b.score - a.score);
  return toSamsungIndiaModelCode(hits[0].code, siteCode);
}

/**
 * Build a full device from Samsung card + specs APIs (works even when HTML/ProductGroup is missing).
 */
export async function fetchSamsungDeviceByModelCode(
  modelCodeRaw: string,
  siteCode = "in"
): Promise<{
  modelName: string;
  description: string;
  variants: SamsungVariant[];
  gallery: string[];
  startingPrice: number;
  specs: SamsungTechSpecs | null;
  modelSku: string;
} | null> {
  const modelCode = toSamsungIndiaModelCode(modelCodeRaw, siteCode);
  if (!modelCode) return null;

  try {
    const cardUrl = `https://searchapi.samsung.com/v6/front/b2c/product/card/detail/global?siteCode=${siteCode}&modelList=${encodeURIComponent(modelCode)}&saleSkuYN=N&onlyRequestSkuYN=N&commonCodeYN=N&keySummaryYN=Y&specInfoYN=Y`;
    const res = await fetch(cardUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const family = data?.response?.resultData?.productList?.[0];
    const models: any[] = family?.modelList || [];
    if (!models.length) return null;

    const modelName = String(
      family.fmyMarketingName || family.fmyEngName || models[0].displayName || "Galaxy"
    )
      .replace(/\(\s*\d+\s*gb\s*memory\s*\)/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const variants: SamsungVariant[] = [];
    const gallery: string[] = [];

    for (const m of models) {
      const chips: any[] = m.fmyChipList || [];
      const chipLabel = (c: any) =>
        String(c?.fmyChipLocalName || c?.fmyChipName || "").trim();
      const memoryChip =
        chips.find((c) =>
          /memory|storage|MOBILE MEMORY/i.test(String(c.fmyChipType || ""))
        ) || chips.find((c) => /\d+\s*(GB|TB)\b/i.test(chipLabel(c)));
      const colorChip =
        chips.find((c) =>
          /color|colour/i.test(String(c.fmyChipType || c.optionTypeCode || ""))
        ) ||
        chips.find(
          (c) => c !== memoryChip && !/\d+\s*(GB|TB)\b/i.test(chipLabel(c))
        );

      const color = chipLabel(colorChip) || "Standard";
      const storage = chipLabel(memoryChip)
        .replace(/\s+/g, "")
        .toUpperCase();

      const img = absSamsungUrl(
        m.largeUrl || m.galleryImageLarge || m.galleryImage || m.thumbUrl || ""
      );
      if (img && !gallery.includes(img)) gallery.push(img);

      const priceRaw =
        m.promotionPrice || m.price || m.afterTaxPrice || null;
      let price = 0;
      if (priceRaw != null) {
        price = Math.round(parseFloat(String(priceRaw)));
        // Some feeds use paise
        if (price > 500000) price = Math.round(price / 100);
      } else if (m.priceDisplay) {
        price =
          Math.round(
            parseFloat(String(m.priceDisplay).replace(/[^\d.]/g, ""))
          ) || 0;
      }

      variants.push({
        sku: String(m.modelCode || "").replace(/INS$/i, ""),
        name: String(m.displayName || modelName),
        color,
        storage,
        ram: "",
        price,
        image: img,
      });
    }

    const specs = await fetchSamsungFullSpecs(modelCode, siteCode);
    const prices = variants.map((v) => v.price).filter((p) => p >= 5000);

    return {
      modelName,
      description: `Official Samsung ${modelName} specifications and configurations.`,
      variants,
      gallery,
      startingPrice: prices.length ? Math.min(...prices) : 0,
      specs,
      modelSku: modelCode.replace(/INS$/i, ""),
    };
  } catch (e) {
    console.warn("fetchSamsungDeviceByModelCode failed", e);
    return null;
  }
}

/**
 * Full technical specifications from Samsung Search API.
 */
export async function fetchSamsungFullSpecs(
  modelCodeOrSku: string,
  siteCode = "in"
): Promise<SamsungTechSpecs | null> {
  const modelCode = toSamsungIndiaModelCode(modelCodeOrSku, siteCode);
  if (!modelCode) return null;

  try {
    const api = `https://searchapi.samsung.com/v6/front/b2c/product/spec/detail?siteCode=${siteCode}&modelList=${encodeURIComponent(modelCode)}`;
    const res = await fetch(api, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const model = data?.response?.resultData?.modelList?.[0];
    const specItems = model?.spec?.specItems;
    if (!Array.isArray(specItems) || !specItems.length) return null;

    const spec_sections = flattenSpecItems(specItems);
    const tech_specs: Record<string, string> = {};
    for (const sec of spec_sections) {
      for (const row of sec.items) {
        const label =
          row.name === sec.title ? sec.title : `${sec.title} · ${row.name}`;
        tech_specs[label] = row.value;
      }
    }

    const processor =
      [
        pickSpec(spec_sections, /^Processor$/i, /CPU Type/i),
        pickSpec(spec_sections, /^Processor$/i, /CPU Speed/i),
      ]
        .filter(Boolean)
        .join(", ") || pickSpec(spec_sections, /^Processor$/i);

    const displayParts = [
      pickSpec(spec_sections, /^Display$/i, /Technology/i),
      pickSpec(spec_sections, /^Display$/i, /Size/i),
      pickSpec(spec_sections, /^Display$/i, /Resolution/i),
      pickSpec(spec_sections, /^Display$/i, /Refresh Rate/i),
    ].filter(Boolean);

    const camera =
      pickSpec(spec_sections, /^Camera$/i, /Rear Camera/i) ||
      pickSpec(spec_sections, /^Camera$/i) ||
      "";

    const batteryRaw =
      pickSpec(spec_sections, /^Battery$/i, /Battery Capacity/i) ||
      pickSpec(spec_sections, /^Battery$/i) ||
      "";
    const battery = batteryRaw
      ? /mah/i.test(batteryRaw)
        ? batteryRaw
        : `${batteryRaw} mAh`
      : "";

    const os =
      pickSpec(spec_sections, /^OS$/i) ||
      pickSpec(spec_sections, /Software/i, /OS/i) ||
      "Android";

    const weightRaw =
      pickSpec(spec_sections, /Physical/i, /^Weight/i) ||
      pickSpec(spec_sections, /./, /^Weight\s*\(g\)/i) ||
      "";
    const weight = weightRaw
      ? /\d/.test(weightRaw) && !/[a-z]/i.test(weightRaw.replace(/\s/g, ""))
        ? `${weightRaw} g`
        : /g$/i.test(weightRaw)
          ? weightRaw
          : `${weightRaw} g`
      : "";

    const dimensions =
      pickSpec(spec_sections, /Physical/i, /Dimension/i) ||
      pickSpec(spec_sections, /./, /Dimension\s*\(HxWxD/i) ||
      "";

    return {
      processor: processor || "—",
      display: displayParts.join(" · ") || "—",
      camera: camera || "—",
      battery: battery || "—",
      os: os || "Android",
      dimensions: dimensions || "—",
      weight: weight || "—",
      tech_specs,
      spec_sections,
    };
  } catch (e) {
    console.warn("fetchSamsungFullSpecs failed", e);
    return null;
  }
}
