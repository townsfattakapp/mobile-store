import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/utils/supabase/admin";
import { ScraperEngine } from "@/lib/catalog/scraper/ScraperEngine";
import {
  fetchSamsungSmartphoneCatalog,
  isSamsungHost,
} from "@/lib/catalog/scraper/samsung";
import {
  isCategoryUrl,
  isLikelyProductUrl,
} from "@/lib/catalog/scraper/CategoryScraper";
import { sanitizeAppleImageUrl } from "@/lib/catalog/scraper/appleInPrices";
import { formatStoreProductName } from "@/lib/catalog/scraper/extractProductImages";
import {
  curateSourceImages,
  uploadCuratedImagesToR2,
  mapVariantsToUploadedImages,
} from "@/lib/storage/productImages";
import { R2NotConfiguredError } from "@/lib/storage/R2Client";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireAdmin() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasSession) return null;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Prefer admin/staff, but allow any authenticated user who can reach /admin
  // (proxy only checks session cookie, same as this page).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role && !["admin", "staff"].includes(profile.role)) {
    return null;
  }
  return user;
}

async function saveScrapedDevice(fetchedData: any) {
  const supabase = createAdminClient();

  let brandName =
    fetchedData.brand_name ||
    String(fetchedData.model_name || "").split(" ")[0] ||
    "Unknown";

  let brandId: string | null = null;
  const { data: existingBrand } = await supabase
    .from("brands")
    .select("id")
    .ilike("name", brandName)
    .maybeSingle();

  if (existingBrand) {
    brandId = existingBrand.id;
  } else {
    const { data: newBrand, error: brandErr } = await supabase
      .from("brands")
      .insert([{ name: brandName, slug: brandName.toLowerCase() }])
      .select("id")
      .single();
    if (brandErr) throw new Error("Could not create brand: " + brandErr.message);
    brandId = newBrand.id;
  }

  const appleSafe = (raw?: string | null) => {
    if (!raw) return "";
    return sanitizeAppleImageUrl(raw) || raw;
  };

  const curated = curateSourceImages({
    main: appleSafe(
      fetchedData.main_image_url || fetchedData.specifications?.main_image_url
    ),
    gallery: Array.isArray(fetchedData.specifications?.gallery_images)
      ? fetchedData.specifications.gallery_images.map(appleSafe)
      : [],
    colorImages: Object.fromEntries(
      Object.entries(
        (fetchedData.specifications?.color_images || {}) as Record<string, string>
      ).map(([k, v]) => [k, appleSafe(v)])
    ),
    variantImages: (fetchedData.variants || []).map((v: any) => ({
      color: v.color,
      url: appleSafe(v.reference_image_url),
    })),
  });

  const uploaded = await uploadCuratedImagesToR2(
    curated,
    fetchedData.slug || "device"
  );
  const finalImageUrl = uploaded.main;
  const uploadedGallery = uploaded.gallery;
  const colorImagesOut = uploaded.colorImages;

  const variantsWithImages = mapVariantsToUploadedImages(
    fetchedData.variants || [],
    uploaded
  );

  // Always persist at least one sellable variant
  if (variantsWithImages.length === 0) {
    variantsWithImages.push({
      ram: "",
      storage: "",
      color: "Standard",
      reference_image_url: finalImageUrl,
      mrp: fetchedData.specifications?.mrp || 0,
      selling_price: fetchedData.specifications?.selling_price || 0,
    });
  }

  const cleanedName = formatStoreProductName(
    fetchedData.model_name,
    brandName
  );

  const devicePayload = {
    brand_id: brandId,
    model_name: cleanedName,
    slug: fetchedData.slug,
    release_year: fetchedData.release_year || new Date().getFullYear(),
    source_provider: fetchedData.source_provider || "scraper",
    specifications: {
      ...fetchedData.specifications,
      main_image_url: finalImageUrl || null,
      gallery_images: uploadedGallery,
      color_images: colorImagesOut,
      variant_pricing:
        fetchedData.specifications?.variant_pricing ||
        variantsWithImages.map((v: any) => ({
          color: v.color,
          storage: v.storage,
          ram: v.ram,
          mrp: v.mrp,
          selling_price: v.selling_price || v.mrp,
          image: v.reference_image_url,
        })),
    },
  };

  const { data: savedDevice, error: deviceErr } = await supabase
    .from("master_devices")
    .insert([devicePayload])
    .select("id")
    .single();

  if (deviceErr) {
    if (deviceErr.code === "23505") {
      const { data: existingDev } = await supabase
        .from("master_devices")
        .select("id")
        .eq("slug", fetchedData.slug)
        .maybeSingle();
      if (!existingDev) throw new Error("Slug conflict but device not found");

      await supabase
        .from("master_devices")
        .update({
          specifications: devicePayload.specifications,
          release_year: devicePayload.release_year,
          source_provider: devicePayload.source_provider,
          model_name: devicePayload.model_name,
        })
        .eq("id", existingDev.id);

      if (variantsWithImages.length > 0) {
        await supabase
          .from("master_device_variants")
          .delete()
          .eq("master_device_id", existingDev.id);
        const { error: variantsErr } = await supabase
          .from("master_device_variants")
          .insert(
            variantsWithImages.map((v: any) => ({
              master_device_id: existingDev.id,
              ram: v.ram || "",
              storage: v.storage || "",
              color: v.color || "",
              reference_image_url: v.reference_image_url || finalImageUrl,
            }))
          );
        if (variantsErr)
          throw new Error("Could not refresh variants: " + variantsErr.message);
      }

      return {
        deviceId: existingDev.id,
        message: "Updated existing Master Catalog entry.",
      };
    }
    throw new Error("Could not save master device: " + deviceErr.message);
  }

  if (variantsWithImages.length > 0) {
    const { error: variantsErr } = await supabase
      .from("master_device_variants")
      .insert(
        variantsWithImages.map((v: any) => ({
          master_device_id: savedDevice.id,
          ram: v.ram || "",
          storage: v.storage || "",
          color: v.color || "",
          reference_image_url: v.reference_image_url || finalImageUrl,
        }))
      );
    if (variantsErr)
      throw new Error("Could not save variants: " + variantsErr.message);
  }

  return {
    deviceId: savedDevice.id,
    message: "Successfully fetched and saved to Master Catalog.",
  };
}

/**
 * POST { url: string }
 * Scrapes a product URL (Samsung API-first) and saves to Master Catalog.
 * Or expands a Samsung hub into a product list.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const url = String(body.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { success: false, error: "Pass a valid https URL" },
        { status: 400 }
      );
    }

    // Hub → expand list (don't save as one device)
    if (isCategoryUrl(url) || (isSamsungHost(url) && !isLikelyProductUrl(url))) {
      let items: { name: string; url: string; image?: string }[] = [];
      if (isSamsungHost(url)) {
        items = await fetchSamsungSmartphoneCatalog(url);
      } else {
        const { webScraperProvider } = await import(
          "@/lib/catalog/providers/WebScraperProvider"
        );
        items = await webScraperProvider.fetchListFromUrl(url);
      }
      if (items.length) {
        return NextResponse.json({
          success: true,
          mode: "expand",
          items,
          message: `Found ${items.length} products.`,
        });
      }
      return NextResponse.json({
        success: false,
        error:
          "This looks like a category/search page but no products were found. Try the brand homepage or a product URL.",
      });
    }

    if (isLikelyProductUrl(url) || isSamsungHost(url) || /^https?:/i.test(url)) {
      const engine = new ScraperEngine();
      let fetched: any = await engine.fetchFromUrl(url);

      const {
        enrichWithMarketplacePricing,
        modelNameFromProductUrl,
        brandHintFromUrl,
      } = await import("@/lib/catalog/scraper/enrichMarketplace");

      if (!fetched?.model_name) {
        if (isSamsungHost(url)) {
          const items = await fetchSamsungSmartphoneCatalog();
          if (items.length) {
            return NextResponse.json({
              success: true,
              mode: "expand",
              items,
              message: `Could not scrape that URL. Showing ${items.length} Samsung phones — pick one.`,
            });
          }
        }
        // Marketplace-only fallback for JS-heavy brand PDPs
        fetched = await enrichWithMarketplacePricing(null, {
          nameHint: modelNameFromProductUrl(url),
          brandHint: brandHintFromUrl(url),
        });
      } else {
        fetched = await enrichWithMarketplacePricing(fetched, {
          brandHint: (fetched as any).brand_name || brandHintFromUrl(url),
          nameHint: fetched.model_name,
        });
      }

      if (!fetched?.model_name) {
        return NextResponse.json({
          success: false,
          error: "Scrape returned no product data for this URL.",
        });
      }

      const saved = await saveScrapedDevice(fetched);
      return NextResponse.json({
        success: true,
        mode: "product",
        deviceId: saved.deviceId,
        message: saved.message,
        model_name: fetched.model_name,
        mrp: (fetched.specifications as any)?.mrp ?? null,
        price_source: (fetched.specifications as any)?.price_source ?? null,
      });
    }

    return NextResponse.json({
      success: false,
      error: "URL not recognized as a product or category page.",
    });
  } catch (e: any) {
    console.error("import-url error", e);
    const status =
      e instanceof R2NotConfiguredError || e?.name === "R2NotConfiguredError"
        ? 503
        : 500;
    return NextResponse.json(
      { success: false, error: e?.message || String(e) },
      { status }
    );
  }
}
