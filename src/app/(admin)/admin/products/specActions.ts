"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { enrichFetchedDeviceWithGsmArenaSpecs } from "@/lib/catalog/enrichPhoneSpecs";

/**
 * Re-fetch GSMArena-style specs onto an existing master_device
 * (keeps commercial scrape fields when possible).
 */
export async function refreshMasterDeviceSpecs(masterDeviceId: string) {
  try {
    if (!masterDeviceId) {
      return { success: false as const, error: "Missing master device id" };
    }
    const supabase = createAdminClient();
    const { data: master, error } = await supabase
      .from("master_devices")
      .select("id, model_name, source_provider, specifications, brand:brands(name)")
      .eq("id", masterDeviceId)
      .single();

    if (error || !master) {
      return { success: false as const, error: error?.message || "Master device not found" };
    }

    const brandName = Array.isArray((master as any).brand)
      ? (master as any).brand[0]?.name
      : (master as any).brand?.name;

    const specs = { ...((master.specifications || {}) as Record<string, unknown>) };
    // Force a fresh GSMArena pull even when highlights already exist
    delete specs.spec_sections;
    delete specs.tech_specs;
    for (const k of [
      "processor",
      "display",
      "camera",
      "battery",
      "os",
      "dimensions",
      "weight",
    ]) {
      specs[k] = "See specs";
    }

    const enriched = await enrichFetchedDeviceWithGsmArenaSpecs({
      model_name: master.model_name,
      brand_name: brandName,
      source_provider: master.source_provider || "manual",
      specifications: specs,
    } as any);

    const nextSpecs = {
      ...((master.specifications || {}) as Record<string, unknown>),
      ...((enriched.specifications || {}) as Record<string, unknown>),
      // Preserve product commercial media if enrich tried to strip differently
      gallery_images:
        (master.specifications as any)?.gallery_images ||
        (enriched.specifications as any)?.gallery_images,
      color_images:
        (master.specifications as any)?.color_images ||
        (enriched.specifications as any)?.color_images,
      main_image_url:
        (master.specifications as any)?.main_image_url ||
        (enriched.specifications as any)?.main_image_url,
      variant_pricing: (master.specifications as any)?.variant_pricing,
      mrp: (master.specifications as any)?.mrp,
      selling_price: (master.specifications as any)?.selling_price,
    };
    delete (nextSpecs as any).source_url;
    delete (nextSpecs as any).condition_source;

    const { error: upErr } = await supabase
      .from("master_devices")
      .update({ specifications: nextSpecs })
      .eq("id", masterDeviceId);

    if (upErr) {
      return { success: false as const, error: upErr.message };
    }

    return {
      success: true as const,
      specifications: nextSpecs,
      message: "Specs refreshed from GSMArena catalog",
    };
  } catch (e: unknown) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : "Refresh failed",
    };
  }
}

export async function saveMasterDeviceSpecs(
  masterDeviceId: string,
  specifications: Record<string, unknown>
) {
  try {
    if (!masterDeviceId) {
      return { success: false as const, error: "Missing master device id" };
    }
    const supabase = createAdminClient();
    const cleaned = { ...specifications };
    delete cleaned.source_url;
    delete cleaned.condition_source;

    const { error } = await supabase
      .from("master_devices")
      .update({ specifications: cleaned })
      .eq("id", masterDeviceId);

    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  } catch (e: unknown) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}
