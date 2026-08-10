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

/** Preferred phone hubs (used when products are correctly tagged). */
export const SMARTPHONE_CATEGORY_SLUG = {
  new: "smartphones-new",
  used: "smartphones-pre-owned",
} as const;

/** Categories that must never appear on /new-mobiles or /used-mobiles. */
export const NON_PHONE_CATEGORY_SLUGS = [
  "laptops-new",
  "laptops-pre-owned",
  "tablets-new",
  "tablets-pre-owned",
  "laptop-bags-stands",
  "chargers-cables",
  "power-banks",
  "cases-covers-tempered-glass",
  "audio-earbuds-headphones",
  "smartwatches-bands",
  "car-mounts-holders",
  "storage-memory",
  "mobile-spare-parts",
  "computer-spare-parts",
] as const;

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

export async function getCategoryIdsBySlugs(
  supabase: { from: (t: string) => any },
  slugs: readonly string[]
): Promise<string[]> {
  if (!slugs.length) return [];
  const { data } = await supabase.from("categories").select("id, slug").in("slug", [...slugs]);
  return (data || []).map((row: { id: string }) => row.id).filter(Boolean);
}

/**
 * Drop obvious non-phone devices by title (safety net for mis-tagged rows).
 */
export function excludeNonPhoneNameFilter(query: any): any {
  return query
    .not("name", "ilike", "%laptop%")
    .not("name", "ilike", "%macbook%")
    .not("name", "ilike", "%galaxy book%")
    .not("name", "ilike", "%notebook%")
    .not("name", "ilike", "%chromebook%")
    .not("name", "ilike", "%ipad%")
    .not("name", "ilike", "% tablet%")
    .not("name", "ilike", "tablet %");
}

/**
 * Keep phone PLPs usable even when many phones lack smartphones-* tags:
 * exclude laptop/tablet/accessory category ids + obvious non-phone names.
 */
export function applyPhoneHubFilters(query: any, excludeCategoryIds: string[]): any {
  let next = excludeNonPhoneNameFilter(query);
  if (excludeCategoryIds.length) {
    // Keep null category_id rows; only drop known non-phone categories.
    next = next.or(
      `category_id.is.null,category_id.not.in.(${excludeCategoryIds.join(",")})`
    );
  }
  return next;
}
