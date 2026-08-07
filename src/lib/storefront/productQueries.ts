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
