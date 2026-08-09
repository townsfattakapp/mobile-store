import { normalizeModelMatchKey } from "@/lib/catalog/modelMatchKey";
import { normalizeColorKey, stripConditionGrade } from "@/lib/catalog/colorImages";

/** Stable identity for store/master variants (phone or laptop config) */
export function variantIdentityKey(input: {
  color?: string | null;
  storage?: string | null;
  ram?: string | null;
  cpu?: string | null;
  display_size?: string | null;
  master_variant_id?: string | null;
}): string {
  const masterId = String(input.master_variant_id || "").trim();
  if (masterId && !masterId.startsWith("standard")) {
    return `mvid:${masterId}`;
  }
  const color = normalizeColorKey(String(input.color || "")) || "default";
  const storage = String(input.storage || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  const ram = String(input.ram || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  const cpu = String(input.cpu || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  const display = String(input.display_size || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  return `attr:${color}|${storage}|${ram}|${cpu}|${display}`;
}

export function imageUrlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.toLowerCase().replace(/\/+$/, "");
  } catch {
    return String(url || "")
      .split("?")[0]
      .toLowerCase();
  }
}

export type ExistingStoreProduct = {
  id: string;
  name: string;
  slug: string;
  type: string;
  brand_id: string | null;
  master_device_id: string | null;
  main_image_url: string | null;
  specifications: Record<string, unknown> | null;
  mrp: number | null;
  selling_price: number | null;
  stock_quantity: number | null;
};

/**
 * Find the storefront product to merge into.
 * Same master + same product type wins; then brand + name key + type.
 * New vs used stay separate listings.
 */
export async function findMergeTargetProduct(
  supabase: any,
  opts: {
    masterDeviceId: string;
    productType: string;
    brandId?: string | null;
    candidateName: string;
  }
): Promise<ExistingStoreProduct | null> {
  const selectCols =
    "id, name, slug, type, brand_id, master_device_id, main_image_url, specifications, mrp, selling_price, stock_quantity";

  const { data: byMaster } = await supabase
    .from("products")
    .select(selectCols)
    .eq("master_device_id", opts.masterDeviceId)
    .eq("type", opts.productType)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (byMaster) return byMaster as ExistingStoreProduct;

  if (!opts.brandId) return null;

  const { data: brandProducts } = await supabase
    .from("products")
    .select(selectCols)
    .eq("brand_id", opts.brandId)
    .eq("type", opts.productType)
    .limit(80);

  const want = normalizeModelMatchKey(opts.candidateName);
  if (!want) return null;

  for (const p of brandProducts || []) {
    if (normalizeModelMatchKey(p.name || "") === want) {
      return p as ExistingStoreProduct;
    }
    // Soft: published name contains cleaned model or vice versa after strip
    const pn = normalizeModelMatchKey(p.name || "");
    if (pn && (pn.includes(want) || want.includes(pn))) {
      // Avoid matching "iphone 15" into "iphone 15 pro"
      const wantTokens = want.split(" ").filter(Boolean);
      const pnTokens = pn.split(" ").filter(Boolean);
      const extra =
        pnTokens.filter((t: string) => !wantTokens.includes(t)).length +
        wantTokens.filter((t: string) => !pnTokens.includes(t)).length;
      // Allow only trivial suffix differences (e.g. "5g" already stripped)
      if (extra === 0) return p as ExistingStoreProduct;
    }
  }

  return null;
}

export function mergeColorImageMaps(
  existing: Record<string, string> | null | undefined,
  incoming: Record<string, string> | null | undefined
): Record<string, string> {
  const out: Record<string, string> = { ...(existing || {}) };
  for (const [color, url] of Object.entries(incoming || {})) {
    if (!url) continue;
    out[color] = url;
    // Also set stripped base if missing
    const base = stripConditionGrade(color);
    if (base && !out[base]) out[base] = url;
  }
  return out;
}

export function mergeGalleryUrlLists(
  existing: string[],
  incoming: string[],
  mainUrl?: string | null
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (u?: string | null) => {
    if (!u) return;
    const key = imageUrlKey(u);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(u);
  };
  if (mainUrl) add(mainUrl);
  existing.forEach(add);
  incoming.forEach(add);
  return out;
}
