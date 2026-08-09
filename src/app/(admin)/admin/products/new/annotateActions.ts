"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import {
  normalizeModelMatchKey,
  productHandleFromUrl,
  type AnnotatedDiscoveredLink,
} from "@/lib/catalog/modelMatchKey";

/**
 * Mark discovered collection items as already in master catalog and/or storefront.
 * Plus / Pro / Pro Max stay distinct from base iPhone 15 via normalizeModelMatchKey.
 */
export async function annotateDiscoveredLinks(
  items: { name: string; url: string; image?: string }[]
): Promise<{
  success: boolean;
  items: AnnotatedDiscoveredLink[];
  message?: string;
  error?: string;
}> {
  const safeItems = (Array.isArray(items) ? items : [])
    .filter((i) => i && typeof i.url === "string")
    .map((i) => ({
      name: String(i.name || ""),
      url: String(i.url || ""),
      image: i.image ? String(i.image) : undefined,
    }));

  try {
    const supabase = createAdminClient();

    const [{ data: masters }, { data: products }] = await Promise.all([
      supabase.from("master_devices").select("id, model_name, slug"),
      supabase.from("products").select("id, name, slug, master_device_id"),
    ]);

    const masterByKey = new Map<string, { id: string; name: string }>();
    for (const m of masters || []) {
      const key = normalizeModelMatchKey(m.model_name || "");
      if (key && !masterByKey.has(key)) {
        masterByKey.set(key, { id: m.id, name: m.model_name });
      }
    }

    const productByKey = new Map<
      string,
      { id: string; name: string; masterId?: string | null }
    >();
    const productByMaster = new Map<string, { id: string; name: string }>();
    for (const p of products || []) {
      const key = normalizeModelMatchKey(p.name || "");
      if (key && !productByKey.has(key)) {
        productByKey.set(key, {
          id: p.id,
          name: p.name,
          masterId: p.master_device_id,
        });
      }
      if (p.master_device_id) {
        productByMaster.set(p.master_device_id, { id: p.id, name: p.name });
      }
    }

    const annotated: AnnotatedDiscoveredLink[] = safeItems.map((item) => {
      const matchKey = normalizeModelMatchKey(item.name || "");
      const handle = productHandleFromUrl(item.url || "");
      const handleKey = normalizeModelMatchKey(handle.replace(/-/g, " "));

      const storeHit =
        (matchKey && productByKey.get(matchKey)) ||
        (handleKey && productByKey.get(handleKey)) ||
        null;
      if (storeHit) {
        return {
          name: item.name,
          url: item.url,
          image: item.image,
          status: "in_store" as const,
          matchKey,
          productId: storeHit.id,
          masterDeviceId: storeHit.masterId || undefined,
          existingName: storeHit.name,
        };
      }

      const masterHit =
        (matchKey && masterByKey.get(matchKey)) ||
        (handleKey && masterByKey.get(handleKey)) ||
        null;
      if (masterHit) {
        const storeFromMaster = productByMaster.get(masterHit.id);
        if (storeFromMaster) {
          return {
            name: item.name,
            url: item.url,
            image: item.image,
            status: "in_store" as const,
            matchKey,
            productId: storeFromMaster.id,
            masterDeviceId: masterHit.id,
            existingName: storeFromMaster.name,
          };
        }
        return {
          name: item.name,
          url: item.url,
          image: item.image,
          status: "in_master" as const,
          matchKey,
          masterDeviceId: masterHit.id,
          existingName: masterHit.name,
        };
      }

      return {
        name: item.name,
        url: item.url,
        image: item.image,
        status: "available" as const,
        matchKey,
      };
    });

    const available = annotated.filter((a) => a.status === "available").length;
    const blocked = annotated.length - available;

    return {
      success: true,
      items: annotated,
      message:
        blocked > 0
          ? `${available} new · ${blocked} already in catalog (Add disabled)`
          : `${available} models ready to add`,
    };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Could not check catalog duplicates";
    return {
      success: false,
      error: message,
      items: safeItems.map((item) => ({
        ...item,
        status: "available" as const,
        matchKey: "",
      })),
    };
  }
}
