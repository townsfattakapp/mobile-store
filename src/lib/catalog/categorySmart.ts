/**
 * Pick the best store category for a product type / model name.
 * Avoids alphabetical traps like "Batteries" being first.
 */
export function pickSmartCategoryId(
  categories: { id: string; name: string; slug?: string | null }[],
  productType: string,
  modelName?: string
): string {
  if (!categories.length) return "";

  const model = (modelName || "").toLowerCase();
  const scored = categories.map((c) => {
    const n = `${c.name} ${c.slug || ""}`.toLowerCase();
    let score = 0;

    const penalizeParts =
      /batter|spare|part|display|screen|speaker|mic|flex|charging port/.test(n);
    const penalizeAccessories =
      /accessor|case|cover|charger|cable|earbud|airpod|watch band|tempered|glass/.test(n);

    if (productType === "new_mobile" || productType === "used_mobile") {
      if (/smart\s*phone|smartphone/.test(n)) score += 50;
      if (/\bmobiles?\b|\bphones?\b|\bhandset/.test(n)) score += 40;
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
      if (/smart\s*phone|mobile|phone/.test(n) && !/accessor/.test(n)) score -= 30;
      if (penalizeParts) score -= 40;
      if (model && /power.?bank|charger|cable|earbud|speaker|watch|mouse/.test(model)) {
        if (/power.?bank|charger|cable|audio|accessor/.test(n)) score += 15;
      }
    } else if (productType === "part") {
      if (/spare|part|batter|display|screen/.test(n)) score += 50;
      if (/smart\s*phone|accessor/.test(n)) score -= 20;
    }

    // Soft boost if category name appears related to model family
    if (model.includes("iphone") && n.includes("iphone")) score += 5;
    if (model.includes("galaxy") && n.includes("samsung")) score += 5;

    return { id: c.id, name: c.name, score };
  });

  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score > 0) return scored[0].id;

  // Fallback: first category that doesn't look like batteries/parts
  const safe = categories.find(
    (c) => !/batter|spare|part|accessor/i.test(c.name)
  );
  return safe?.id || categories[0].id;
}
