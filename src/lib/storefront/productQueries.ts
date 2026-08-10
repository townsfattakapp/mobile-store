/** Fields needed for ProductCard / listing tiles — keep payloads light. */
export const PRODUCT_CARD_SELECT = `
  id,
  name,
  slug,
  type,
  status,
  selling_price,
  mrp,
  main_image_url,
  created_at,
  brand:brands(name),
  master_devices(specifications),
  variants:product_variants(id)
`;

export const PRODUCT_CARD_SELECT_INNER_BRAND = `
  id,
  name,
  slug,
  type,
  status,
  selling_price,
  mrp,
  main_image_url,
  created_at,
  brand:brands!inner(name),
  master_devices(specifications),
  variants:product_variants(id)
`;

export const PLP_PAGE_SIZE = 24;

/** Hub pages must not spill tablets/laptops into “Mobiles”. */
export const SMARTPHONE_CATEGORY_SLUG = {
  new: "smartphones-new",
  used: "smartphones-pre-owned",
} as const;

export async function getCategoryIdBySlug(
  supabase: { from: (t: string) => any },
  slug: string
): Promise<string | null> {
  const { data } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id || null;
}

/**
 * Drop obvious non-phone devices when category_id is missing / unset.
 * Used as a safety net alongside smartphones-* category filters.
 */
export function excludeNonPhoneNameFilter<T extends { not: (col: string, op: string, val: string) => T }>(
  query: T
): T {
  return query
    .not("name", "ilike", "%laptop%")
    .not("name", "ilike", "%macbook%")
    .not("name", "ilike", "%galaxy book%")
    .not("name", "ilike", "%notebook%")
    .not("name", "ilike", "%chromebook%")
    .not("name", "ilike", "%ipad%")
    .not("name", "ilike", "% tablet%")
    .not("name", "ilike", "tablet %")
    .not("name", "ilike", "%tab %");
}
