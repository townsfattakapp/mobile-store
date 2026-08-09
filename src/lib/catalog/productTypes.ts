/**
 * DB product_type enum values — coarse listing lane.
 * Fine-grained classification (phone / tablet / laptop / charger…) lives on categories.
 */
export type ProductTypeValue =
  | "new_mobile"
  | "used_mobile"
  | "accessory"
  | "part";

export const PRODUCT_TYPE_OPTIONS: {
  value: ProductTypeValue;
  label: string;
  hint: string;
}[] = [
  {
    value: "new_mobile",
    label: "New — Phone / Tablet / Laptop",
    hint: "Brand-new sealed or box-pack devices",
  },
  {
    value: "used_mobile",
    label: "Pre-Owned — Phone / Tablet / Laptop",
    hint: "Used, refurbished, or certified pre-owned devices",
  },
  {
    value: "accessory",
    label: "Accessory — Mobile & Computer",
    hint: "Cases, chargers, audio, wearables, PC gear, gadgets",
  },
  {
    value: "part",
    label: "Spare Part",
    hint: "Displays, batteries, flex cables, repair parts",
  },
];

export function productTypeLabel(type: string): string {
  return (
    PRODUCT_TYPE_OPTIONS.find((o) => o.value === type)?.label ||
    type ||
    "Product"
  );
}

/** Infer coarse type from a store category slug/name. */
export function productTypeFromCategory(
  category?: { slug?: string | null; name?: string | null } | null
): ProductTypeValue | null {
  if (!category) return null;
  const blob = `${category.slug || ""} ${category.name || ""}`.toLowerCase();

  if (/spare|batter|part/.test(blob) && !/power\s*bank/.test(blob)) {
    return "part";
  }
  if (
    /accessor|case|cover|charger|cable|power-bank|audio|earbud|keyboard|mouse|storage|network|gaming|gadget|wearable|watch|bag|stand/.test(
      blob
    )
  ) {
    return "accessory";
  }
  if (/pre-?owned|refurbished|used/.test(blob)) {
    return "used_mobile";
  }
  if (
    /smartphone|tablet|laptop|phone|mobile|ipad|macbook|notebook/.test(blob) ||
    /\bnew\b/.test(blob)
  ) {
    return "new_mobile";
  }
  return null;
}
