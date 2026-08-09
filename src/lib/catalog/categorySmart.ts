/**
 * Smart category picking + listing inference.
 */
import {
  inferListingTypeAndCategory,
  STORE_CATEGORY_SEEDS,
} from "./storeCategories";

export { inferListingTypeAndCategory, STORE_CATEGORY_SEEDS };

/**
 * Pick the best store category for a product type / model name.
 * Prefer slug from inference when present in the catalog.
 */
export function pickSmartCategoryId(
  categories: { id: string; name: string; slug?: string | null }[],
  productType: string,
  modelName?: string,
  preferredSlug?: string
): string {
  if (!categories.length) return "";

  if (preferredSlug) {
    const bySlug = categories.find(
      (c) => (c.slug || "").toLowerCase() === preferredSlug.toLowerCase()
    );
    if (bySlug) return bySlug.id;
  }

  const inferred = inferListingTypeAndCategory({
    modelName,
    specProductType: productType,
  });
  const inferredHit = categories.find(
    (c) => (c.slug || "").toLowerCase() === inferred.categorySlug.toLowerCase()
  );
  if (inferredHit) return inferredHit.id;

  const model = (modelName || "").toLowerCase();
  const scored = categories.map((c) => {
    const n = `${c.name} ${c.slug || ""}`.toLowerCase();
    let score = 0;

    const penalizeParts =
      /batter|spare|part|display|screen|speaker|mic|flex|charging port/.test(n);
    const penalizeAccessories =
      /accessor|case|cover|charger|cable|earbud|airpod|watch band|tempered|glass/.test(
        n
      );

    if (productType === "new_mobile" || productType === "used_mobile") {
      if (/smart\s*phone|smartphone/.test(n)) score += 50;
      if (/\bmobiles?\b|\bphones?\b|\bhandset/.test(n)) score += 40;
      if (/tablet|ipad/.test(n) && /tablet|ipad|tab\b/.test(model)) score += 55;
      if (/laptop|notebook|macbook/.test(n) && /laptop|macbook|notebook/.test(model))
        score += 55;
      if (productType === "used_mobile" && /used|pre-?owned|refurbished|certified/.test(n))
        score += 25;
      if (productType === "new_mobile" && /\bnew\b/.test(n)) score += 15;
      if (/iphone|android|galaxy/.test(n)) score += 10;
      if (penalizeParts) score -= 80;
      if (penalizeAccessories) score -= 60;
      if (/batter/.test(n)) score -= 100;
    } else if (productType === "accessory") {
      if (/accessor/.test(n)) score += 50;
      if (/case|cover|charger|cable|earbud|audio|power.?bank|ambrane|watch/.test(n))
        score += 25;
      if (/computer|keyboard|mouse|storage|network/.test(n) &&
        /mouse|keyboard|ssd|pendrive|router/.test(model)) {
        score += 30;
      }
      if (/smart\s*phone|mobile|phone/.test(n) && !/accessor/.test(n)) score -= 30;
      if (penalizeParts) score -= 40;
      if (model && /power.?bank|charger|cable|earbud|speaker|watch|mouse/.test(model)) {
        if (/power.?bank|charger|cable|audio|accessor/.test(n)) score += 15;
      }
    } else if (productType === "part") {
      if (/spare|part|batter|display|screen/.test(n)) score += 50;
      if (/smart\s*phone|accessor/.test(n)) score -= 20;
    }

    if (model.includes("iphone") && n.includes("iphone")) score += 5;
    if (model.includes("galaxy") && n.includes("samsung")) score += 5;

    return { id: c.id, name: c.name, score };
  });

  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score > 0) return scored[0].id;

  const safe = categories.find(
    (c) => !/batter|spare|part/i.test(c.name)
  );
  return safe?.id || categories[0].id;
}
