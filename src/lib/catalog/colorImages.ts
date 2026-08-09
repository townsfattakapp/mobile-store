/**
 * Helpers for matching Refit-style graded colors to base color image maps.
 * e.g. "Frosted Blue (Sky Blue) (Good)" → "Frosted Blue (Sky Blue)"
 */

const GRADE_SUFFIX =
  /\s*\((good|very\s*good|superb|excellent|fair|acceptable)\)\s*$/i;

export function stripConditionGrade(color: string): string {
  return String(color || "").replace(GRADE_SUFFIX, "").trim();
}

export function normalizeColorKey(color: string): string {
  return stripConditionGrade(color)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token set for soft matching ("onyx black midnight black" vs "onyx black") */
function tokens(color: string): string[] {
  return normalizeColorKey(color)
    .split(" ")
    .filter((t) => t.length > 2 && !["the", "and", "with"].includes(t));
}

/**
 * Find best image URL for a variant color from a color→url map.
 */
export function resolveColorImageUrl(
  colorName: string,
  colorImages: Record<string, string> | null | undefined
): string {
  if (!colorName || !colorImages) return "";
  const entries = Object.entries(colorImages).filter(
    ([, url]) => typeof url === "string" && !!url
  );
  if (!entries.length) return "";

  // 1. Exact
  if (colorImages[colorName]) return colorImages[colorName];

  // 2. Case-insensitive
  const lower = colorName.toLowerCase();
  const ci = entries.find(([k]) => k.toLowerCase() === lower);
  if (ci) return ci[1];

  // 3. Strip grade suffix once / twice
  const stripped = stripConditionGrade(colorName);
  if (stripped && colorImages[stripped]) return colorImages[stripped];
  const stripped2 = stripConditionGrade(stripped);
  if (stripped2 && colorImages[stripped2]) return colorImages[stripped2];
  const strippedCi = entries.find(
    ([k]) => k.toLowerCase() === stripped.toLowerCase()
  );
  if (strippedCi) return strippedCi[1];

  // 4. Normalized key equality
  const want = normalizeColorKey(colorName);
  const byKey = entries.find(([k]) => normalizeColorKey(k) === want);
  if (byKey) return byKey[1];

  // 5. Soft token overlap (prefer longest map key that is contained / overlaps)
  const HUES = new Set([
    "black",
    "white",
    "blue",
    "purple",
    "green",
    "pink",
    "yellow",
    "red",
    "gold",
    "silver",
    "gray",
    "grey",
    "orange",
    "cream",
  ]);
  const wantTokens = new Set(tokens(colorName));
  if (wantTokens.size === 0) return "";

  let best: { url: string; score: number } | null = null;
  for (const [k, url] of entries) {
    const keyTokens = tokens(k);
    if (!keyTokens.length) continue;
    let overlap = 0;
    for (const t of keyTokens) {
      if (wantTokens.has(t)) overlap++;
    }
    const sharedHue = keyTokens.some((t) => HUES.has(t) && wantTokens.has(t));
    // Require mostly matching the map key (avoid "blue" matching everything)
    const cover = overlap / keyTokens.length;
    const wantCover = overlap / wantTokens.size;
    const ok =
      cover >= 0.6 ||
      (sharedHue && (wantCover >= 0.5 || overlap >= 1) && cover >= 0.33);
    const score =
      overlap * 10 + cover * 5 + wantCover * 5 + keyTokens.length + (sharedHue ? 3 : 0);
    if (ok && (!best || score > best.score)) {
      best = { url, score };
    }
  }
  return best?.url || "";
}

/**
 * Expand a base color_images map so graded variant labels also resolve.
 */
export function expandColorImagesForVariants(
  colorImages: Record<string, string>,
  variantColors: string[]
): Record<string, string> {
  const out: Record<string, string> = { ...colorImages };
  for (const color of variantColors) {
    if (!color || out[color]) continue;
    const resolved = resolveColorImageUrl(color, colorImages);
    if (resolved) out[color] = resolved;
  }
  return out;
}
