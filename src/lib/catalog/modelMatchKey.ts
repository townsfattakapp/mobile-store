/**
 * Normalize phone/accessory titles so "Apple iPhone 15 5G Refurbished"
 * and "Apple iPhone 15" collide, while Plus / Pro / Pro Max stay distinct.
 */
export function normalizeModelMatchKey(raw: string): string {
  let s = String(raw || "")
    .toLowerCase()
    .replace(/[_./\\]+/g, " ")
    .replace(/['’]/g, "");

  // Strip common brand prefixes (keep model tokens like "plus"/"pro")
  s = s.replace(
    /\b(apple|samsung|xiaomi|redmi|poco|google|oneplus|motorola|nothing|vivo|oppo|realme|iqoo|tecno|infinix|nokia|honor|huawei|sony|asus|lenovo)\b/g,
    " "
  );

  // Strip marketplace / condition / network noise
  s = s
    .replace(
      /\b(5g|4g|lte|wifi|wi[\s-]?fi|dual[\s-]?sim|unlocked)\b/g,
      " "
    )
    .replace(
      /\b(refurbished|pre[\s-]?owned|renewed|certified|brand\s*box|open\s*box|like\s*new|excellent|superb|very\s*good|good|fair|acceptable)\b/g,
      " "
    )
    .replace(/\b(with\s+)?(box|charger|cable|bill|warranty)\b/g, " ")
    .replace(/\b\d+\s*gb(\s*ram)?\b/g, " ")
    .replace(/\b\d+\s*tb\b/g, " ");

  // Collapse "iphone15" → "iphone 15"
  s = s.replace(/\biphone(\d)/g, "iphone $1");

  return s
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Shopify/product handle from a URL path */
export function productHandleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p === "products");
    if (i >= 0 && parts[i + 1]) return parts[i + 1].toLowerCase();
    return (parts[parts.length - 1] || "").toLowerCase();
  } catch {
    return "";
  }
}

export type DiscoveredCatalogStatus =
  | "available"
  | "in_master"
  | "in_store";

export type AnnotatedDiscoveredLink = {
  name: string;
  url: string;
  image?: string;
  status: DiscoveredCatalogStatus;
  matchKey: string;
  masterDeviceId?: string;
  productId?: string;
  existingName?: string;
};
