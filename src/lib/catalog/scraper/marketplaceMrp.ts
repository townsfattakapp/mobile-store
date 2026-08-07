import * as cheerio from "cheerio";

export type MarketplaceOffer = {
  mrp: number;
  sellingPrice: number;
  title: string;
  imageUrl?: string;
  sourceUrl?: string;
  source: "flipkart" | "amazon";
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function parseInr(raw: string): number | null {
  const n = Math.round(
    parseFloat(String(raw).replace(/[^\d.]/g, ""))
  );
  if (!Number.isFinite(n) || n < 2999 || n > 400000) return null;
  return n;
}

/** Normalize "₹80,99914" (MRP + glued discount %) → 80999 */
function parseFlipkartMoneyTokens(text: string): number[] {
  const out: number[] = [];
  const re = /₹\s*([\d,]+)(\d{0,2})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const base = parseInr(m[1]);
    if (base) out.push(base);
    // If glued digits look like % off (1–2 digits) keep base only
  }
  return [...new Set(out)];
}

function scoreTitleMatch(query: string, title: string): number {
  const q = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const t = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!q || !t) return 0;
  const qTokens = q.split(/\s+/).filter((w) => w.length > 0 && w !== "5g" && w !== "4g");
  let hit = 0;
  for (const tok of qTokens) {
    if (/^\d+[a-z]?$/i.test(tok)) {
      // Numeric model codes must appear as whole tokens (15 ≠ ce5, s25 ≠ s25fe handled below)
      const re = new RegExp(`(?:^|\\s)${tok}(?:\\s|$|pro|plus|ultra|r\\b|s\\b)`, "i");
      if (re.test(t) || t.split(/\s+/).includes(tok)) hit += 3;
      else hit -= 2;
    } else if (t.includes(tok)) {
      hit += 1;
    } else {
      hit -= 1;
    }
  }
  // Penalize accessories
  if (/case|cover|tempered|glass|charger|cable|earbud|buds|strap|band|screen guard|spigen|back cover/i.test(t)) {
    hit -= 8;
  }
  // Penalize sibling variants not requested (S25 FE when query is S25)
  const extras = [
    "fe",
    "ultra",
    "plus",
    "edge",
    "fold",
    "flip",
    "lite",
    "nord",
    "narzo",
    "turbo",
    "note",
  ];
  for (const extra of extras) {
    const inTitle = new RegExp(`(?:^|\\s)${extra}(?:\\s|$)`, "i").test(t);
    const inQuery = new RegExp(`(?:^|\\s)${extra}(?:\\s|$)`, "i").test(q);
    if (inTitle && !inQuery) hit -= 4;
  }
  if (/mobile|smartphone|phone|galaxy|pixel|iphone|oneplus|vivo|oppo|redmi|realme|motorola|poco/i.test(t)) {
    hit += 1;
  }
  // Exact flagship codes: query "15" must not match Nord 5 / 13s via substring luck
  const numToks = qTokens.filter((w) => /^\d+[a-z]?$/i.test(w));
  for (const tok of numToks) {
    const brandNum = new RegExp(
      `(?:^|\\s)(?:samsung\\s+galaxy\\s+|apple\\s+iphone\\s+|google\\s+pixel\\s+|oneplus\\s+|vivo\\s+|oppo\\s+|xiaomi\\s+|redmi\\s+|realme\\s+|iqoo\\s+|motorola\\s+|poco\\s+)?${tok}(?:\\s|$|pro|plus|ultra|5g)`,
      "i"
    );
    if (!brandNum.test(t) && !t.split(/\s+/).includes(tok)) {
      hit -= 5;
    }
    // Sibling suffix: 15 must not match 15r / 15s unless queried
    if (
      tok === "15" &&
      /\b15\s*[rs]\b|\b15[rs]\b/i.test(t) &&
      !/\b15\s*[rs]\b|\b15[rs]\b/i.test(q)
    ) {
      hit -= 6;
    }
  }
  return hit;
}

async function lookupFlipkart(
  query: string,
  brandHint?: string
): Promise<MarketplaceOffer | null> {
  const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    type Cand = MarketplaceOffer & { score: number };
    const cands: Cand[] = [];
    const brand = String(brandHint || "").toLowerCase();

    $("a[href*='/p/']").each((_, el) => {
      const href = $(el).attr("href") || "";
      const block = $(el).closest("div").text().replace(/\s+/g, " ").trim();
      const titleMatch = block.match(
        /((?:Samsung|Apple|OnePlus|Google|Pixel|vivo|OPPO|Xiaomi|Redmi|POCO|realme|iQOO|Motorola|Lava|Nokia|HMD|Nothing)[\w\s+.\-]{3,60}?)(?:\(|Add to|₹|Ratings)/i
      );
      const title =
        titleMatch?.[1]?.trim() ||
        block
          .replace(/^Add to Compare/i, "")
          .split(/₹|Ratings/)[0]
          .trim()
          .slice(0, 80);
      if (!title || title.length < 6) return;

      // Brand must match when provided (OnePlus 15 ≠ iPhone 15)
      if (brand) {
        const t = title.toLowerCase();
        const brandOk =
          t.includes(brand) ||
          (brand === "google" && t.includes("pixel")) ||
          (brand === "xiaomi" && (t.includes("redmi") || t.includes("xiaomi"))) ||
          (brand === "hmd" && (t.includes("nokia") || t.includes("hmd")));
        if (!brandOk) return;
      }

      const prices = parseFlipkartMoneyTokens(block);
      if (!prices.length) return;
      prices.sort((a, b) => a - b);
      let sellingPrice = prices[0];
      let mrp = prices.length > 1 ? prices[prices.length - 1] : sellingPrice;
      if (mrp > sellingPrice * 3.5) mrp = sellingPrice;
      if (sellingPrice < 5000) return;

      const imgRaw =
        $(el).find("img").attr("src") ||
        $(el).closest("div").find("img").first().attr("src") ||
        "";
      const img = imgRaw.startsWith("http")
        ? imgRaw.replace(/\/image\/\d+\/\d+\//, "/image/832/832/")
        : "";

      const score = scoreTitleMatch(query, title);
      if (score < 3) return;

      cands.push({
        mrp,
        sellingPrice,
        title,
        imageUrl: img || undefined,
        sourceUrl: href.startsWith("http")
          ? href
          : `https://www.flipkart.com${href}`,
        source: "flipkart",
        score,
      });
    });

    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score || a.sellingPrice - b.sellingPrice);
    const best = cands[0];
    return {
      mrp: best.mrp,
      sellingPrice: best.sellingPrice,
      title: best.title,
      imageUrl: best.imageUrl,
      sourceUrl: best.sourceUrl,
      source: "flipkart",
    };
  } catch (e) {
    console.warn("Flipkart MRP lookup failed", e);
    return null;
  }
}

async function lookupAmazon(
  query: string,
  brandHint?: string
): Promise<MarketplaceOffer | null> {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (/captcha/i.test(html.slice(0, 2000))) return null;
    const $ = cheerio.load(html);

    type Cand = MarketplaceOffer & { score: number };
    const cands: Cand[] = [];
    const brand = String(brandHint || "").toLowerCase();

    $('[data-component-type="s-search-result"]').each((_, el) => {
      const title = (
        $(el).find("h2 a span").first().text() ||
        $(el).find("h2 span").first().text() ||
        $(el).find("h2").text()
      )
        .replace(/\s+/g, " ")
        .trim();
      if (!title || title.length < 8) return;

      if (brand) {
        const t = title.toLowerCase();
        const brandOk =
          t.includes(brand) ||
          (brand === "google" && t.includes("pixel")) ||
          (brand === "xiaomi" && (t.includes("redmi") || t.includes("xiaomi"))) ||
          (brand === "hmd" && (t.includes("nokia") || t.includes("hmd")));
        if (!brandOk) return;
      }

      const off =
        $(el).find(".a-price .a-offscreen").first().text() ||
        $(el).find(".a-price-whole").first().text();
      const sellingPrice = parseInr(off || "");
      if (!sellingPrice || sellingPrice < 5000) return;

      const listRaw =
        $(el).find(".a-price[data-a-strike='true'] .a-offscreen").first().text() ||
        $(el).find(".a-text-price .a-offscreen").first().text() ||
        "";
      const list = parseInr(listRaw) || sellingPrice;
      const mrp = Math.max(list, sellingPrice);

      const img = $(el).find("img.s-image").attr("src") || "";
      const href = $(el).find("h2 a").attr("href") || "";
      const score = scoreTitleMatch(query, title);
      if (score < 3) return;

      cands.push({
        mrp,
        sellingPrice,
        title,
        imageUrl: img.startsWith("http") ? img : undefined,
        sourceUrl: href
          ? href.startsWith("http")
            ? href
            : `https://www.amazon.in${href}`
          : undefined,
        source: "amazon",
        score,
      });
    });

    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score || a.sellingPrice - b.sellingPrice);
    const best = cands[0];
    return {
      mrp: best.mrp,
      sellingPrice: best.sellingPrice,
      title: best.title,
      imageUrl: best.imageUrl,
      sourceUrl: best.sourceUrl,
      source: "amazon",
    };
  } catch (e) {
    console.warn("Amazon MRP lookup failed", e);
    return null;
  }
}

/**
 * Look up India MRP / street price on Flipkart then Amazon.
 * Used when brand PDPs omit price (Samsung card API, JS-heavy brand sites).
 */
export async function lookupMarketplaceMrp(
  modelName: string,
  brandName?: string
): Promise<MarketplaceOffer | null> {
  const cleaned = String(modelName || "")
    .replace(/\(\s*\d+\s*gb\s*memory\s*\)/gi, "")
    .replace(/\(special colour\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3) return null;

  const brand = String(brandName || "").trim();
  const q =
    brand && !cleaned.toLowerCase().startsWith(brand.toLowerCase())
      ? `${brand} ${cleaned}`
      : cleaned;

  // Prefer phone-intent query
  const phoneQ = /\b(phone|mobile|5g)\b/i.test(q) ? q : `${q} 5G`;

  const fk = await lookupFlipkart(phoneQ, brand || undefined);
  if (fk) return fk;

  const amz = await lookupAmazon(phoneQ, brand || undefined);
  if (amz) return amz;

  // Retry without 5G suffix
  if (phoneQ !== q) {
    const fk2 = await lookupFlipkart(q, brand || undefined);
    if (fk2) return fk2;
    const amz2 = await lookupAmazon(q, brand || undefined);
    if (amz2) return amz2;
  }

  return null;
}

/**
 * Apply marketplace offer onto scraped device specs / variants when MRP missing.
 */
export function applyMarketplaceOffer(
  fetched: {
    model_name?: string;
    main_image_url?: string;
    specifications?: any;
    variants?: any[];
  },
  offer: MarketplaceOffer,
  isJunk?: (url: string) => boolean
) {
  const specs = { ...(fetched.specifications || {}) };
  const hadMrp = Number(specs.mrp) > 0;
  const hadSell = Number(specs.selling_price) > 0;

  if (!hadMrp) {
    specs.mrp = offer.mrp;
    specs.price_source = `marketplace_${offer.source}`;
    specs.marketplace_url = offer.sourceUrl;
  }
  if (!hadSell) {
    specs.selling_price = offer.sellingPrice || offer.mrp;
    if (!specs.price_source) specs.price_source = `marketplace_${offer.source}`;
  }
  specs.currency = specs.currency || "INR";

  const variants = (fetched.variants || []).map((v: any) => {
    const mrp = Number(v.mrp) > 0 ? Number(v.mrp) : offer.mrp;
    const sell =
      Number(v.selling_price) > 0 ? Number(v.selling_price) : offer.sellingPrice;
    return { ...v, mrp, selling_price: sell };
  });

  if (Array.isArray(specs.variant_pricing)) {
    specs.variant_pricing = specs.variant_pricing.map((v: any) => ({
      ...v,
      mrp: Number(v.mrp) > 0 ? Number(v.mrp) : offer.mrp,
      selling_price:
        Number(v.selling_price) > 0
          ? Number(v.selling_price)
          : offer.sellingPrice,
    }));
  }

  let main = fetched.main_image_url || specs.main_image_url || "";
  const mainIsJunk = !main || (isJunk && isJunk(main));
  if (offer.imageUrl && mainIsJunk) {
    main = offer.imageUrl;
    specs.main_image_url = main;
  }

  const filledVariants = (variants.length ? variants : fetched.variants || []).map(
    (v: any) => {
      const ref = v.reference_image_url || "";
      if (
        offer.imageUrl &&
        (!ref || (isJunk && isJunk(ref)) || mainIsJunk)
      ) {
        return { ...v, reference_image_url: offer.imageUrl };
      }
      return v;
    }
  );

  return {
    ...fetched,
    main_image_url: main,
    specifications: specs,
    variants: filledVariants,
  };
}
