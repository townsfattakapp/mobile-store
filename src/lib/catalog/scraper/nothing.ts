/**
 * Nothing India (Shopify Hydrogen / Oxygen) — Storefront GraphQL.
 * https://in.nothing.tech/
 *
 * Classic /products.json is blocked; GraphQL at /api/{version}/graphql.json works.
 */

export type NothingCatalogItem = {
  name: string;
  url: string;
  handle: string;
  image?: string;
};

export type NothingVariant = {
  color: string;
  ram: string;
  storage: string;
  price: number;
  mrp: number;
  image: string;
  available: boolean;
  title: string;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const GQL_VERSIONS = ["2025-01", "2024-10", "2024-07", "2024-04"];

export function isNothingHost(url: string): boolean {
  try {
    return new URL(url).hostname.includes("nothing.tech");
  } catch {
    return false;
  }
}

export function isNothingListingUrl(url: string): boolean {
  if (!isNothingHost(url)) return false;
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "") return true;
    if (/\/collections\/(phones|all|smartphones)/i.test(path)) return true;
    if (/\/collections\/?$/i.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}

export function isNothingProductUrl(url: string): boolean {
  if (!isNothingHost(url)) return false;
  try {
    return /\/products\/[^/]+/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function nothingProductHandle(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(/\/products\/([^/?#]+)/i);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function shopOrigin(url: string): string {
  try {
    const u = new URL(url);
    // Prefer India storefront
    if (u.hostname.includes("nothing.tech")) {
      if (u.hostname.startsWith("in.")) return `${u.protocol}//${u.host}`;
      return "https://in.nothing.tech";
    }
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://in.nothing.tech";
  }
}

async function nothingGraphql(
  origin: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<any | null> {
  for (const ver of GQL_VERSIONS) {
    try {
      const res = await fetch(`${origin}/api/${ver}/graphql.json`, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Language": "en-IN,en;q=0.9",
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.errors && !data?.data) continue;
      return data;
    } catch {
      /* try next version */
    }
  }
  return null;
}

/** Parse Nothing Capacity option "8+256GB" → { ram, storage } */
export function parseNothingCapacity(raw: string): { ram: string; storage: string } {
  const s = String(raw || "").replace(/\s+/g, "").toUpperCase();
  const m = s.match(/^(\d+)\+(\d+)(GB|TB)$/i);
  if (m) {
    return { ram: `${m[1]}GB`, storage: `${m[2]}${m[3].toUpperCase()}` };
  }
  const storageOnly = s.match(/^(\d+)(GB|TB)$/i);
  if (storageOnly) {
    return { ram: "", storage: `${storageOnly[1]}${storageOnly[2].toUpperCase()}` };
  }
  return { ram: "", storage: raw || "" };
}

/**
 * List phones (+ CMF phones) from the India collection.
 */
export async function fetchNothingPhoneCatalog(
  pageUrl = "https://in.nothing.tech/"
): Promise<NothingCatalogItem[]> {
  const origin = shopOrigin(pageUrl);
  const query = `
    query {
      phones: collection(handle: "phones") {
        products(first: 50) {
          nodes {
            title
            handle
            featuredImage { url }
            images(first: 1) { nodes { url } }
          }
        }
      }
      all: products(first: 50, query: "product_type:Smartphones OR title:Phone OR title:CMF") {
        nodes {
          title
          handle
          productType
          featuredImage { url }
          images(first: 1) { nodes { url } }
        }
      }
    }
  `;
  const data = await nothingGraphql(origin, query);
  const items: NothingCatalogItem[] = [];
  const seen = new Set<string>();

  const push = (title: string, handle: string, image?: string) => {
    if (!handle || seen.has(handle)) return;
    // Skip pure accessories / headphone unless CMF/Phone
    if (/headphone|ear|buds|case|cable|charger|watch/i.test(title) && !/phone/i.test(title)) {
      return;
    }
    seen.add(handle);
    items.push({
      name: title.startsWith("Phone") || title.startsWith("CMF")
        ? title.startsWith("CMF")
          ? title
          : `Nothing ${title}`
        : title,
      url: `${origin}/products/${handle}`,
      handle,
      ...(image ? { image } : {}),
    });
  };

  for (const n of data?.data?.phones?.products?.nodes || []) {
    const image =
      String(n.featuredImage?.url || n.images?.nodes?.[0]?.url || "") || undefined;
    push(String(n.title || ""), String(n.handle || ""), image);
  }
  if (items.length < 3) {
    for (const n of data?.data?.all?.nodes || []) {
      const image =
        String(n.featuredImage?.url || n.images?.nodes?.[0]?.url || "") ||
        undefined;
      push(String(n.title || ""), String(n.handle || ""), image);
    }
  }

  // Fallback curated list if GraphQL collection empty
  if (!items.length) {
    const curated = [
      "phone-4a-pro",
      "phone-4a",
      "phone-4b",
      "phone-3",
      "phone-3a-pro",
      "phone-3a",
      "phone-3a-lite",
      "cmf-phone-2-pro",
      "cmf-phone-1",
    ];
    for (const handle of curated) {
      const name = handle
        .replace(/^phone-/, "Phone (")
        .replace(/-pro$/, ") Pro")
        .replace(/-lite$/, ") Lite")
        .replace(/-/g, " ");
      // nicer names
      const pretty = handle
        .replace(/^cmf-/, "CMF ")
        .replace(/^phone-/, "Phone (")
        .replace(/-pro$/, ") Pro")
        .replace(/-lite$/, ") Lite")
        .replace(/-(?=\d)/g, " ")
        .replace(/phone \(/i, "Phone (");
      push(
        handle.startsWith("cmf")
          ? pretty.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
          : `Nothing Phone (${handle.replace(/^phone-/, "").replace(/-/g, " ")})`
            .replace(" pro", " Pro")
            .replace(" lite", " Lite"),
        handle
      );
    }
  }

  return items;
}

/**
 * Full product with colour × capacity variants + INR prices.
 */
export async function fetchNothingProduct(
  pageUrl: string
): Promise<{
  modelName: string;
  handle: string;
  description: string;
  variants: NothingVariant[];
  gallery: string[];
  colorImages: Record<string, string>;
  startingPrice: number;
  startingMrp: number;
} | null> {
  const origin = shopOrigin(pageUrl);
  const handle = nothingProductHandle(pageUrl);
  if (!handle) return null;

  const query = `
    query($handle: String!) {
      product(handle: $handle) {
        id
        title
        handle
        description
        productType
        options { name values }
        images(first: 20) { nodes { url altText } }
        variants(first: 100) {
          nodes {
            id
            title
            availableForSale
            selectedOptions { name value }
            image { url }
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
          }
        }
        priceRange {
          minVariantPrice { amount currencyCode }
        }
      }
    }
  `;

  const data = await nothingGraphql(origin, query, { handle });
  const product = data?.data?.product;
  if (!product?.title) return null;

  const gallery: string[] = [];
  for (const img of product.images?.nodes || []) {
    const u = String(img?.url || "");
    if (u && !gallery.includes(u)) gallery.push(u);
  }

  const colorImages: Record<string, string> = {};
  const variants: NothingVariant[] = [];

  for (const v of product.variants?.nodes || []) {
    const opts: Record<string, string> = {};
    for (const o of v.selectedOptions || []) {
      opts[String(o.name || "").toLowerCase()] = String(o.value || "");
    }
    const color =
      opts["colour"] ||
      opts["color"] ||
      opts["colourway"] ||
      "Standard";
    const capacity =
      opts["capacity"] ||
      opts["storage"] ||
      opts["size"] ||
      v.title ||
      "";
    const { ram, storage } = parseNothingCapacity(capacity);

    const price = Math.round(parseFloat(v.price?.amount || "0")) || 0;
    const compare = Math.round(parseFloat(v.compareAtPrice?.amount || "0")) || 0;
    const mrp = Math.max(compare, price);
    const image = String(v.image?.url || gallery[0] || "");

    if (color && image && !colorImages[color]) {
      colorImages[color] = image;
    }
    if (image && !gallery.includes(image)) gallery.push(image);

    variants.push({
      color,
      ram,
      storage,
      price,
      mrp,
      image,
      available: !!v.availableForSale,
      title: String(v.title || ""),
    });
  }

  const prices = variants.map((v) => v.price).filter((p) => p > 0);
  const mrps = variants.map((v) => v.mrp).filter((p) => p > 0);
  const title = String(product.title || "");
  const modelName = /^phone\b/i.test(title)
    ? `Nothing ${title}`
    : title;

  return {
    modelName,
    handle: String(product.handle || handle),
    description:
      String(product.description || "").trim() ||
      `Official Nothing ${modelName} — colours and storage options from Nothing India.`,
    variants,
    gallery,
    colorImages,
    startingPrice: prices.length ? Math.min(...prices) : 0,
    startingMrp: mrps.length ? Math.min(...mrps) : 0,
  };
}
