/**
 * Shopify store helpers — many Indian accessory brands (Ambrane, etc.) run on Shopify.
 * Prefer public JSON endpoints over brittle HTML when available.
 */

export type ShopifyJsonProduct = {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  variants?: Array<{
    id: number;
    title: string;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    sku?: string | null;
    price: string;
    compare_at_price?: string | null;
    available?: boolean;
    featured_image?: { src: string } | null;
  }>;
  images?: Array<{ src: string; position?: number }>;
  options?: Array<{ name: string; values: string[] }>;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export function isShopifyHtml(html: string): boolean {
  const h = html.toLowerCase();
  // Require real Shopify signals — do NOT key off bare "/products/" paths
  // (vivo/iQOO Nuxt e-stores match that pattern and are not Shopify).
  return (
    h.includes("cdn.shopify.com") ||
    h.includes("shopify.theme") ||
    h.includes("shopify-digital-wallet") ||
    h.includes("myshopify.com") ||
    h.includes("shopify-section") ||
    h.includes("shopify.routes") ||
    h.includes("shopify.shop")
  );
}

export function isShopifyProductUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\/products\/[^/]+\/?$/.test(path);
  } catch {
    return false;
  }
}

export function shopifyProductHandle(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(/\/products\/([^/?#]+)/i);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export function shopOrigin(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

/** Detect store/collection hubs that should expand into many products */
export function isStoreListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = (u.pathname.replace(/\/+$/, "") || "/").toLowerCase();
    if (path === "/" || path === "") return true;
    if (path.startsWith("/collections")) return true;
    if (path.startsWith("/catalog") || path.startsWith("/shop")) return true;
    if (path.startsWith("/search")) return true;
    if (/\/(all|products)$/i.test(path)) return true;
    // Bare brand homepage paths like /in or /en
    if (/^\/[a-z]{2}$/i.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json,text/javascript,*/*",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Paginate Shopify /products.json or /collections/{handle}/products.json.
 */
export async function fetchShopifyCatalog(
  pageUrl: string,
  maxPages = 8,
  pageSize = 50
): Promise<{ name: string; url: string; image?: string }[]> {
  const origin = shopOrigin(pageUrl);
  const items: { name: string; url: string; image?: string }[] = [];
  const seen = new Set<string>();

  let collectionHandle: string | null = null;
  try {
    const path = new URL(pageUrl).pathname.replace(/\/+$/, "");
    const m = path.match(/^\/collections\/([^/]+)/i);
    if (m && m[1].toLowerCase() !== "all") collectionHandle = decodeURIComponent(m[1]);
  } catch {
    /* ignore */
  }

  // Refit / large refurbished catalogs — allow more pages
  const isRefit = /refitglobal\.com/i.test(origin);
  const isBigAccessoryShop =
    /gonoise\.com|stuffcool\.com|fireboltt\.com|goboult\.co\.in|ptron\.in|ubonindia\.com|boat-lifestyle\.com/i.test(
      origin
    );
  const pages = isRefit
    ? Math.max(maxPages, 20)
    : isBigAccessoryShop
      ? Math.max(maxPages, 12)
      : maxPages;

  for (let page = 1; page <= pages; page++) {
    const endpoint = collectionHandle
      ? `${origin}/collections/${collectionHandle}/products.json?limit=${pageSize}&page=${page}`
      : `${origin}/products.json?limit=${pageSize}&page=${page}`;
    const data = await fetchJson(endpoint);
    const products: ShopifyJsonProduct[] = data?.products || [];
    if (!products.length) break;

    for (const p of products) {
      if (!p.handle || seen.has(p.handle)) continue;
      seen.add(p.handle);
      const image =
        p.images?.[0]?.src ||
        p.variants?.find((v) => v.featured_image?.src)?.featured_image?.src ||
        undefined;
      items.push({
        name: p.title || p.handle,
        url: `${origin}/products/${p.handle}`,
        ...(image ? { image: absShopifyImage(image) } : {}),
      });
    }

    if (products.length < pageSize) break;
  }

  return items;
}

/** Fetch a single Shopify product via /products/{handle}.js */
export async function fetchShopifyProductJs(
  productUrl: string
): Promise<ShopifyJsonProduct | null> {
  const handle = shopifyProductHandle(productUrl);
  if (!handle) return null;
  const origin = shopOrigin(productUrl);
  const data = await fetchJson(`${origin}/products/${handle}.js`);
  if (!data?.title && !data?.handle) return null;
  // .js endpoint shape is slightly different — normalize
  return {
    id: data.id,
    title: data.title,
    handle: data.handle || handle,
    body_html: data.description || data.body_html || "",
    vendor: data.vendor,
    product_type: data.type || data.product_type || "",
    tags: Array.isArray(data.tags)
      ? data.tags
      : String(data.tags || "")
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean),
    variants: (data.variants || []).map((v: any) => ({
      id: v.id,
      title: v.title || v.option1 || "Default",
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
      sku: v.sku,
      price: String(
        typeof v.price === "number" ? (v.price / 100).toFixed(2) : v.price
      ),
      compare_at_price: v.compare_at_price
        ? String(
            typeof v.compare_at_price === "number"
              ? (v.compare_at_price / 100).toFixed(2)
              : v.compare_at_price
          )
        : null,
      available: v.available,
      featured_image: v.featured_image
        ? { src: v.featured_image.src || v.featured_image }
        : null,
    })),
    images: (data.images || []).map((img: any, i: number) => ({
      src: typeof img === "string" ? img : img.src,
      position: typeof img === "object" ? img.position : i + 1,
    })),
    options: data.options,
  };
}

export function extractShopifyProductLinksFromHtml(
  html: string,
  pageUrl: string
): { name: string; url: string }[] {
  // Never invent Shopify PDP URLs for known non-Shopify brand e-stores
  try {
    const host = new URL(pageUrl).hostname.toLowerCase();
    if (
      /(?:^|\.)(shop\.)?(vivo|iqoo)\.com$/i.test(host) ||
      host.includes("vivo.com") ||
      host.includes("iqoo.com")
    ) {
      return [];
    }
  } catch {
    /* continue */
  }
  if (!isShopifyHtml(html)) return [];

  const origin = shopOrigin(pageUrl);
  const seen = new Set<string>();
  const items: { name: string; url: string }[] = [];
  const re = /\/products\/([a-z0-9][a-z0-9\-_%]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const handle = decodeURIComponent(m[1]).replace(/\/$/, "");
    if (!handle || seen.has(handle)) continue;
    if (/^(cart|compare|search|phone|accessories)$/i.test(handle)) continue;
    seen.add(handle);
    const name = handle
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    items.push({ name, url: `${origin}/products/${handle}` });
  }
  return items;
}

/** Absolute Shopify CDN image */
export function absShopifyImage(src: string | undefined | null): string {
  if (!src) return "";
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("http")) return src;
  return src;
}
