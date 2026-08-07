import type { CheerioAPI } from "cheerio";

/**
 * Extract Indian MRP / selling price from product HTML.
 * Handles ₹, Rs, INR, JSON-LD Product offers, meta tags, and common ecommerce selectors.
 */
export function extractIndianPrice($: CheerioAPI, html?: string): {
  mrp: number | null;
  sellingPrice: number | null;
} {
  const candidates: number[] = [];
  let mrp: number | null = null;
  let sellingPrice: number | null = null;

  const pushPrice = (raw: string | undefined | null, preferAsMrp = false) => {
    if (!raw) return;
    const n = parseInrAmount(raw);
    if (n == null) return;
    candidates.push(n);
    if (preferAsMrp) {
      if (mrp == null || n > mrp) mrp = n;
    } else if (sellingPrice == null) {
      sellingPrice = n;
    }
  };

  // 1) JSON-LD Product / Offer
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || $(el).text();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        walkJsonLd(node, (price, isMrp) => {
          if (isMrp) {
            if (mrp == null || price > mrp) mrp = price;
          } else if (sellingPrice == null) {
            sellingPrice = price;
          }
          candidates.push(price);
        });
      }
    } catch {
      /* ignore invalid JSON-LD */
    }
  });

  // 2) Meta / OpenGraph product price
  pushPrice($('meta[property="product:price:amount"]').attr("content"));
  pushPrice($('meta[property="og:price:amount"]').attr("content"));
  pushPrice($('meta[itemprop="price"]').attr("content"));
  pushPrice($('[itemprop="price"]').attr("content"));
  pushPrice($('[itemprop="price"]').first().text());

  // 3) Common ecommerce / brand selectors
  const mrpSelectors = [
    ".price-mrp",
    ".mrp",
    ".was-price",
    ".strike",
    "span.a-price[data-a-strike='true'] .a-offscreen",
    "._3I9_wc", // Flipkart MRP
    ".pdp-mrp",
    "[data-testid='mrp']",
    ".rf-pdp-priceasof",
  ];
  for (const sel of mrpSelectors) {
    $(sel).each((_, el) => pushPrice($(el).text(), true));
  }

  const sellSelectors = [
    ".price-current",
    ".selling-price",
    ".product-price",
    ".pdp-price",
    "#priceblock_ourprice",
    "#priceblock_dealprice",
    ".a-price .a-offscreen",
    "._30jeq3", // Flipkart selling
    "._16Jk6d",
    "[data-testid='price']",
    ".rc-prices-currentprice",
    ".rc-price",
    ".as-price-currentprice",
    ".price",
  ];
  for (const sel of sellSelectors) {
    const el = $(sel).first();
    if (el.length) pushPrice(el.text() || el.attr("content"));
  }

  // 4) Regex sweep on full HTML for ₹ / Rs. amounts
  // For phones, ignore tiny EMI / accessory teaser amounts (< 5k) when better candidates exist
  const source = html || $.root().html() || "";
  const moneyRe =
    /(?:₹|Rs\.?\s*|INR\s*)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
  let match: RegExpExecArray | null;
  while ((match = moneyRe.exec(source)) !== null) {
    const n = parseInrAmount(match[1]);
    if (n != null && n >= 4999 && n <= 500000) candidates.push(n);
  }

  // Also catch "From ₹79900" style
  const fromRe = /from\s*(?:₹|Rs\.?\s*)\s*([0-9,]+)/gi;
  while ((match = fromRe.exec(source)) !== null) {
    const n = parseInrAmount(match[1]);
    if (n != null && n >= 999 && n <= 500000) {
      candidates.push(n);
      if (sellingPrice == null) sellingPrice = n;
    }
  }

  const unique = [...new Set(candidates.filter((n) => n >= 499 && n <= 500000))].sort(
    (a, b) => a - b
  );

  if (sellingPrice == null && unique.length) {
    // Prefer mid/high plausible phone prices; take most common-ish by using median-low for "from"
    sellingPrice = unique[0];
  }
  if (mrp == null && unique.length) {
    mrp = unique[unique.length - 1]; // highest seen often = MRP / struck price
  }
  if (mrp == null && sellingPrice != null) mrp = sellingPrice;
  if (sellingPrice == null && mrp != null) sellingPrice = mrp;

  // If MRP ended up lower than selling, swap
  if (mrp != null && sellingPrice != null && mrp < sellingPrice) {
    const t = mrp;
    mrp = sellingPrice;
    sellingPrice = t;
  }

  return { mrp, sellingPrice };
}

function parseInrAmount(raw: string): number | null {
  const cleaned = String(raw)
    .replace(/[₹RsINR.\s]/gi, "")
    .replace(/,/g, "")
    .trim();
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Math.round(parseFloat(cleaned));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function walkJsonLd(
  node: any,
  onPrice: (price: number, isMrp: boolean) => void
) {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    node.forEach((n) => walkJsonLd(n, onPrice));
    return;
  }

  const type = node["@type"];
  const types = Array.isArray(type) ? type : type ? [type] : [];

  if (types.some((t: string) => /ProductGroup/i.test(String(t)))) {
    if (Array.isArray(node.hasVariant)) {
      node.hasVariant.forEach((v: any) => walkJsonLd(v, onPrice));
    }
  }

  if (types.some((t: string) => /Product/i.test(String(t)))) {
    const offers = node.offers || node.Offers;
    if (offers) walkJsonLd(offers, onPrice);
  }

  if (types.some((t: string) => /Offer|AggregateOffer/i.test(String(t)))) {
    const price = node.price ?? node.lowPrice ?? node.highPrice;
    if (price != null) {
      const n = parseInrAmount(String(price));
      if (n != null) onPrice(n, false);
    }
    if (node.highPrice != null) {
      const n = parseInrAmount(String(node.highPrice));
      if (n != null) onPrice(n, true);
    }
  }

  // Nested graphs
  if (node["@graph"]) walkJsonLd(node["@graph"], onPrice);
}
