"use server";

import { autoFetchProvider } from "@/lib/catalog/providers/AutoFetchProvider";
import { webScraperProvider } from "@/lib/catalog/providers/WebScraperProvider";
import { MasterDevice } from "@/lib/catalog/CatalogProvider";
import { isCategoryUrl, isLikelyProductUrl } from "@/lib/catalog/scraper/CategoryScraper";
import { R2NotConfiguredError } from "@/lib/storage/R2Client";

function cleanedSlugFallback(name: string): string {
  return (
    String(name || "device")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "device"
  );
}

export async function bulkScrapeCategoryLinks(url: string) {
  try {
    const list = await webScraperProvider.fetchListFromUrl(url);
    return {
      success: true,
      items: list,
      isCategory: isCategoryUrl(url),
      message:
        list.length > 0
          ? `Found ${list.length} product model(s) on this page.`
          : "No product models found. Try a more specific product URL.",
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to find models on this page" };
  }
}

/**
 * Smart entry: if URL is a category/store hub (e.g. /iphone/, ambraneindia.com/),
 * expand into products. If it's a product page, scrape & save that one device.
 */
export async function smartScrapeOrExpand(url: string) {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return { success: false, error: "Invalid URL" };
    }

    // CRITICAL: PDPs with related-product links must NOT be expanded as hubs
    // (this was breaking Scrape & Add for Samsung / many brand buy pages)
    if (isLikelyProductUrl(url)) {
      const result = await autoFetchAndSaveMasterDevice(url);
      if (result.success) {
        return {
          success: true,
          mode: "product" as const,
          deviceId: result.deviceId,
          message: result.message,
        };
      }
      // Samsung: broken /buy/ or short family URL — expand catalog instead of hard-fail
      if (/samsung\.com/i.test(url)) {
        const list = await webScraperProvider.fetchListFromUrl(
          "https://www.samsung.com/in/smartphones/all-smartphones/"
        );
        if (list.length > 0) {
          return {
            success: true,
            mode: "expand" as const,
            items: list,
            message: `Could not load that Samsung URL directly. Showing ${list.length} phones from Samsung India — pick one and Add.`,
          };
        }
      }
      return { success: false, error: result.error };
    }

    // Always try listing expansion for hubs / Shopify stores first
    const looksLikeHub = isCategoryUrl(url);
    if (looksLikeHub) {
      const list = await webScraperProvider.fetchListFromUrl(url);
      if (list.length > 0) {
        return {
          success: true,
          mode: "expand" as const,
          items: list,
          message: `Found ${list.length} products on this store/category page.`,
        };
      }
      // Hub with zero products — don't try to save homepage as a device
      return {
        success: false,
        error:
          "This looks like a store/category page, but no products were found. Try a collection URL (e.g. /collections/power-banks) or a single product /buy URL.",
      };
    }

    // Non-hub URL: only expand if it clearly isn't a PDP and has many products
    const probe = await webScraperProvider.fetchListFromUrl(url);
    if (probe.length >= 5) {
      return {
        success: true,
        mode: "expand" as const,
        items: probe,
        message: `Found ${probe.length} products on this page.`,
      };
    }

    const result = await autoFetchAndSaveMasterDevice(url);
    if (result.success) {
      return {
        success: true,
        mode: "product" as const,
        deviceId: result.deviceId,
        message: result.message,
      };
    }
    return { success: false, error: result.error };
  } catch (error: any) {
    return { success: false, error: error.message || "Could not discover models from this URL" };
  }
}

export async function bulkImportDiscoveredLinks(
  items: { name: string; url: string; image?: string }[]
) {
  const results: { name: string; url: string; ok: boolean; deviceId?: string; error?: string }[] = [];

  for (const item of items) {
    if (isCategoryUrl(item.url)) {
      results.push({ ...item, ok: false, error: "Skipped category URL" });
      continue;
    }
    const res = await autoFetchAndSaveMasterDevice(item.url);
    results.push({
      name: item.name,
      url: item.url,
      ok: !!res.success,
      deviceId: res.deviceId,
      error: res.error,
    });
    // Be gentle with Apple; Shopify JSON can be faster
    const delay = /apple\.com/i.test(item.url) ? 800 : 200;
    await new Promise((r) => setTimeout(r, delay));
  }

  const okCount = results.filter((r) => r.ok).length;
  return {
    success: true,
    results,
    message: `Imported ${okCount}/${items.length} models into Master Catalog.`,
  };
}

export async function autoFetchAndSaveMasterDevice(query: string) {
  try {
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const supabase = createAdminClient();
    
    // 1. Try to scrape data first from the brand websites (via proxy/skeleton)
    let fetchedData = await webScraperProvider.fetchFromExternalWebAPI(query);
    
    // 2. Hybrid Enrichment: GSMArena-style specs via MobileAPI when scrape is weak
    if (fetchedData && fetchedData.model_name) {
      const { enrichFetchedDeviceWithGsmArenaSpecs } = await import(
        "@/lib/catalog/enrichPhoneSpecs"
      );
      fetchedData = await enrichFetchedDeviceWithGsmArenaSpecs(fetchedData as any);
    } else {
      // 3. If scraper completely failed or blocked, fallback entirely to MobileAPI.dev
      console.log("Scraper failed or blocked. Falling back to MobileAPI.dev entirely...");
      fetchedData = await autoFetchProvider.fetchFromExternalWebAPI(query);
    }
    
    if (!fetchedData || !fetchedData.model_name) {
      // Last chance: synthesize from URL + Flipkart/Amazon MRP
      if (/^https?:\/\//i.test(query.trim())) {
        const {
          enrichWithMarketplacePricing,
          modelNameFromProductUrl,
          brandHintFromUrl,
        } = await import("@/lib/catalog/scraper/enrichMarketplace");
        const nameHint = modelNameFromProductUrl(query);
        const brandHint = brandHintFromUrl(query);
        fetchedData = (await enrichWithMarketplacePricing(null, {
          nameHint: nameHint || query,
          brandHint,
        })) as any;
      }
    }

    if (fetchedData?.model_name) {
      const {
        enrichWithMarketplacePricing,
        brandHintFromUrl,
      } = await import("@/lib/catalog/scraper/enrichMarketplace");
      fetchedData = (await enrichWithMarketplacePricing(fetchedData as any, {
        brandHint:
          (fetchedData as any).brand_name ||
          (/^https?:/i.test(query) ? brandHintFromUrl(query) : ""),
        nameHint: fetchedData.model_name,
      })) as any;
    }

    if (!fetchedData || !fetchedData.model_name) {
      const isUrl = /^https?:\/\//i.test(query.trim());
      const isSamsung = /samsung\.com/i.test(query);
      if (isSamsung) {
        return {
          success: false,
          error:
            "Could not load this Samsung page. Prefer a /buy/ family URL (e.g. …/galaxy-s25/buy/), or a product URL that includes the model code (sm-…). Listing hubs may need Expand first.",
        };
      }
      if (isUrl) {
        return {
          success: false,
          error:
            "Could not load this URL (page blocked, not a product page, or no product data found). Try a direct product or buy page, or discover models from a brand hub first.",
        };
      }
      return {
        success: false,
        error: "Device not found from this URL or name.",
      };
    }

    // Backfill India MRP + color×storage matrix for Apple when scrape missed it
    {
      const specs = (fetchedData.specifications || {}) as any;
      const brandGuess =
        ((fetchedData as any).brand_name || "").toLowerCase() ||
        fetchedData.model_name.toLowerCase();
      const isApple =
        brandGuess.includes("apple") || /iphone/i.test(fetchedData.model_name);

      if (isApple) {
        const { lookupAppleIndiaMrp, buildAppleVariants, getAppleModelCatalog } =
          await import("@/lib/catalog/scraper/appleInPrices");

        const hasMatrix =
          Array.isArray(specs.variant_pricing) && specs.variant_pricing.length > 0;

        if (!hasMatrix && getAppleModelCatalog(fetchedData.model_name)) {
          const built = buildAppleVariants({
            modelName: fetchedData.model_name,
            colorImages: specs.color_images || {},
            mainImageFallback:
              (fetchedData as any).main_image_url || specs.main_image_url || "",
          });
          fetchedData.specifications = {
            ...specs,
            mrp: built.startingMrp || specs.mrp,
            selling_price: built.startingMrp || specs.selling_price || specs.mrp,
            currency: "INR",
            price_source: "apple_in_variant_matrix",
            colors: built.colors,
            storages: built.storages,
            variant_pricing: built.variants.map((v) => ({
              color: v.color,
              storage: v.storage,
              ram: v.ram,
              mrp: v.mrp,
              selling_price: v.mrp,
              image: v.reference_image_url,
            })),
          };
          if (!fetchedData.variants?.length || fetchedData.variants.length < built.variants.length) {
            fetchedData.variants = built.variants.map((v) => ({
              id: "",
              master_device_id: "",
              ram: v.ram,
              storage: v.storage,
              color: v.color,
              reference_image_url: v.reference_image_url,
              mrp: v.mrp,
              selling_price: v.mrp,
            })) as any;
          }
        } else if (!specs.mrp) {
          const curated = lookupAppleIndiaMrp(fetchedData.model_name);
          if (curated) {
            fetchedData.specifications = {
              ...specs,
              mrp: curated,
              selling_price: specs.selling_price || curated,
              currency: "INR",
              price_source: "apple_in_mrp_table",
            };
          }
        }
      }
    }

    // Normalize laptop variants → CPU · RAM · SSD · display · color (not phone matrix)
    {
      const { isLaptopBlob, normalizeLaptopVariants } = await import(
        "@/lib/catalog/laptopVariants"
      );
      const specs = (fetchedData.specifications || {}) as any;
      if (
        isLaptopBlob(
          fetchedData.model_name,
          specs.product_type,
          specs.device_form,
          (fetchedData as any).source_provider,
          (fetchedData as any).brand_name
        )
      ) {
        const normalized = normalizeLaptopVariants({
          modelName: fetchedData.model_name,
          specifications: specs,
          variants: fetchedData.variants || [],
        });
        fetchedData.specifications = normalized.specifications;
        fetchedData.variants = normalized.variants.map((v) => ({
          id: v.id || "",
          master_device_id: v.master_device_id || "",
          ram: v.ram,
          storage: v.storage,
          color: v.color,
          cpu: v.cpu,
          display_size: v.display_size,
          reference_image_url: v.reference_image_url,
          mrp: v.mrp,
          selling_price: v.selling_price,
        })) as any;
        (fetchedData as any).device_type = "laptop";
      }
    }

    // 2. Determine Brand
    // Use the brand_name provided by the provider, or default to parsing the query
    let brandName = (fetchedData as any).brand_name || fetchedData.model_name.split(' ')[0] || "Unknown";

    // Skip re-import if this slug is already in Master Catalog (no duplicate clutter)
    if (fetchedData.slug) {
      const { data: existingMaster } = await supabase
        .from("master_devices")
        .select("id, model_name")
        .eq("slug", fetchedData.slug)
        .maybeSingle();
      if (existingMaster) {
        return {
          success: true,
          deviceId: existingMaster.id,
          skipped: true,
          message: `Already in Master Catalog (“${existingMaster.model_name}”). Opened existing entry — no duplicate created.`,
        };
      }
    }

    // Also block if a storefront product with same slug/name already exists
    {
      const { formatStoreProductName } = await import(
        "@/lib/catalog/scraper/extractProductImages"
      );
      const cleaned = formatStoreProductName(fetchedData.model_name, brandName);
      const candidateSlug =
        fetchedData.slug ||
        cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      const { data: bySlug } = await supabase
        .from("products")
        .select("id, name, slug")
        .eq("slug", candidateSlug)
        .maybeSingle();
      const { data: byName } = bySlug
        ? { data: null }
        : await supabase
            .from("products")
            .select("id, name, slug")
            .ilike("name", cleaned)
            .limit(1)
            .maybeSingle();
      const existingProduct = bySlug || byName;
      if (existingProduct) {
        return {
          success: false,
          duplicate: true,
          existingProductId: existingProduct.id,
          error: `Duplicate blocked: store already has “${existingProduct.name}”. Edit that product instead of importing again.`,
        };
      }
    }

    // 3. Find or Create Brand in our DB
    let brandId = null;
    const { data: existingBrand } = await supabase
        .from('brands')
        .select('id')
        .ilike('name', brandName)
        .maybeSingle();
        
    if (existingBrand) {
        brandId = existingBrand.id;
    } else {
        const { data: newBrand, error: brandErr } = await supabase
            .from('brands')
            .insert([{ name: brandName, slug: brandName.toLowerCase() }])
            .select()
            .single();
        if (brandErr) throw new Error("Could not create brand: " + brandErr.message);
        brandId = newBrand.id;
    }

    // Process images: curate → upload to R2 only (never persist brand CDN URLs)
    const { sanitizeAppleImageUrl } = await import("@/lib/catalog/scraper/appleInPrices");
    const {
      curateSourceImages,
      uploadCuratedImagesToR2,
      mapVariantsToUploadedImages,
    } = await import("@/lib/storage/productImages");

    const appleSafe = (raw?: string | null) => {
      if (!raw) return "";
      return sanitizeAppleImageUrl(raw) || raw;
    };

    const curated = curateSourceImages({
      main: appleSafe(
        (fetchedData as any).main_image_url ||
          (fetchedData.specifications as any)?.main_image_url
      ),
      gallery: Array.isArray((fetchedData.specifications as any)?.gallery_images)
        ? (fetchedData.specifications as any).gallery_images.map(appleSafe)
        : [],
      colorImages: Object.fromEntries(
        Object.entries(
          ((fetchedData.specifications as any)?.color_images || {}) as Record<
            string,
            string
          >
        ).map(([k, v]) => [k, appleSafe(v)])
      ),
      variantImages: (fetchedData.variants || []).map((v: any) => ({
        color: v.color,
        url: appleSafe(v.reference_image_url),
      })),
    });

    // Prefer MobileAPI hero when curated main is empty
    if (!curated.main && (fetchedData as any).api_image_url) {
      const apiMain = appleSafe((fetchedData as any).api_image_url);
      if (apiMain) {
        curated.main = apiMain;
        curated.gallery = [apiMain, ...curated.gallery].slice(0, 5);
      }
    }

    const uploaded = await uploadCuratedImagesToR2(
      curated,
      fetchedData.slug || cleanedSlugFallback(fetchedData.model_name)
    );
    const finalImageUrl = uploaded.main;
    const uploadedGallery = uploaded.gallery;
    const colorImagesOut = uploaded.colorImages;

    const variantsWithImages = mapVariantsToUploadedImages(
      fetchedData.variants || [],
      uploaded
    );

    // 4. Save Master Device — clean slug/title noise before persisting
    const { formatStoreProductName } = await import(
      "@/lib/catalog/scraper/extractProductImages"
    );
    const cleanedModelName = formatStoreProductName(
      fetchedData.model_name,
      brandName
    );
    const devicePayload = {
        brand_id: brandId,
        model_name: cleanedModelName,
        slug: fetchedData.slug,
        release_year: fetchedData.release_year,
        source_provider: (fetchedData as any).source_provider || 'manual',
        specifications: {
            ...fetchedData.specifications,
            // R2 URLs only — never brand CDN leftovers
            main_image_url: finalImageUrl || null,
            gallery_images: uploadedGallery,
            color_images: colorImagesOut,
            variant_pricing:
              (fetchedData.specifications as any)?.variant_pricing ||
              variantsWithImages.map((v: any) => ({
                color: v.color,
                storage: v.storage,
                ram: v.ram,
                cpu: v.cpu || "",
                display_size: v.display_size || "",
                mrp: v.mrp,
                selling_price: v.selling_price || v.mrp,
                image: v.reference_image_url,
              })),
        }
    };

    const { data: savedDevice, error: deviceErr } = await supabase
        .from('master_devices')
        .insert([devicePayload])
        .select()
        .single();

    if (deviceErr) {
        // Refresh existing catalog entry with smarter scrape (images + variant prices)
        if (deviceErr.code === '23505') {
            const { data: existingDev } = await supabase
              .from('master_devices')
              .select('*')
              .eq('slug', fetchedData.slug)
              .single();
            if (!existingDev) throw new Error("Slug conflict but existing device not found");

            await supabase
              .from('master_devices')
              .update({
                specifications: devicePayload.specifications,
                release_year: devicePayload.release_year,
                source_provider: devicePayload.source_provider,
                model_name: devicePayload.model_name,
              })
              .eq('id', existingDev.id);

            if (variantsWithImages.length > 0) {
              await supabase
                .from('master_device_variants')
                .delete()
                .eq('master_device_id', existingDev.id);

              const base = variantsWithImages.map((v: any) => ({
                master_device_id: existingDev.id,
                ram: v.ram,
                storage: v.storage,
                color: v.color,
                reference_image_url: v.reference_image_url || finalImageUrl,
              }));
              const withLaptop = variantsWithImages.map((v: any, i: number) => ({
                ...base[i],
                cpu: v.cpu || null,
                display_size: v.display_size || null,
              }));
              let { error: variantsErr } = await supabase
                .from("master_device_variants")
                .insert(withLaptop);
              if (
                variantsErr &&
                /cpu|display_size|column/i.test(variantsErr.message || "")
              ) {
                ({ error: variantsErr } = await supabase
                  .from("master_device_variants")
                  .insert(base));
              }
              if (variantsErr) throw new Error("Could not refresh variants: " + variantsErr.message);
            }

            return {
              success: true,
              deviceId: existingDev.id,
              message: "Updated existing Master Catalog entry with fresh images & variant prices.",
            };
        }
        throw new Error("Could not save master device: " + deviceErr.message);
    }

    // 5. Save Master Variants (phone color×storage OR laptop config matrix)
    if (variantsWithImages.length > 0) {
        const base = variantsWithImages.map((v: any) => ({
            master_device_id: savedDevice.id,
            ram: v.ram,
            storage: v.storage,
            color: v.color,
            reference_image_url: v.reference_image_url || finalImageUrl
        }));
        const withLaptop = variantsWithImages.map((v: any, i: number) => ({
            ...base[i],
            cpu: v.cpu || null,
            display_size: v.display_size || null,
        }));

        let { error: variantsErr } = await supabase
            .from('master_device_variants')
            .insert(withLaptop);
        if (variantsErr && /cpu|display_size|column/i.test(variantsErr.message || "")) {
          ({ error: variantsErr } = await supabase
            .from("master_device_variants")
            .insert(base));
        }
            
        if (variantsErr) throw new Error("Could not save variants: " + variantsErr.message);
    }

    return { success: true, deviceId: savedDevice.id, message: "Successfully fetched and saved to Master Catalog." };

  } catch (error: any) {
    console.error("AutoFetch Error:", error);
    if (error instanceof R2NotConfiguredError || error?.name === "R2NotConfiguredError") {
      return { success: false, error: error.message };
    }
    const msg = error?.message || "An unexpected error occurred.";
    if (/samsung\.com/i.test(query)) {
      return { success: false, error: `Could not save Samsung device: ${msg}` };
    }
    return { success: false, error: msg };
  }
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function assertAdminOrStaff() {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Unauthorized" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return { ok: false as const, error: "Forbidden" };
  }
  return { ok: true as const, user };
}

export type ManualVariantInput = {
  name?: string;
  color?: string;
  ram?: string;
  storage?: string;
  cpu?: string;
  display_size?: string;
  mrp: number;
  sellingPrice: number;
  stock: number;
  imageUrl?: string;
};

export type ManualProductInput = {
  name: string;
  sku?: string;
  brandId?: string | null;
  categoryId?: string | null;
  type: "new_mobile" | "used_mobile" | "accessory" | "part";
  mrp: number;
  sellingPrice: number;
  stock: number;
  taxRate?: number;
  imageUrl?: string;
  shortDescription?: string;
  fullDescription?: string;
  status?: "draft" | "active" | "archived";
  variants?: ManualVariantInput[];
};

/**
 * Production create-path for manually entered products (accessories, parts, one-offs).
 */
export async function createManualProduct(input: ManualProductInput) {
  try {
    const auth = await assertAdminOrStaff();
    if (!auth.ok) return { success: false, error: auth.error };

    const name = String(input.name || "").trim();
    if (name.length < 2) {
      return { success: false, error: "Product name is required" };
    }

    const mrp = Number(input.mrp);
    const sellingPrice = Number(input.sellingPrice);
    const stock = Math.max(0, Math.floor(Number(input.stock) || 0));
    const taxRate = Number(input.taxRate ?? 18);

    if (!Number.isFinite(mrp) || mrp < 0) {
      return { success: false, error: "Valid MRP is required" };
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      return { success: false, error: "Selling price must be greater than 0" };
    }
    if (sellingPrice > mrp && mrp > 0) {
      return {
        success: false,
        error: "Selling price cannot be higher than MRP",
      };
    }

    const type = input.type || "accessory";
    const allowed = ["new_mobile", "used_mobile", "accessory", "part"];
    if (!allowed.includes(type)) {
      return { success: false, error: "Invalid product type" };
    }

    const variants = Array.isArray(input.variants) ? input.variants : [];
    for (const [i, v] of variants.entries()) {
      const vp = Number(v.sellingPrice);
      const vm = Number(v.mrp);
      if (!Number.isFinite(vp) || vp <= 0) {
        return {
          success: false,
          error: `Variant ${i + 1}: selling price must be > 0`,
        };
      }
      if (Number.isFinite(vm) && vm > 0 && vp > vm) {
        return {
          success: false,
          error: `Variant ${i + 1}: selling price cannot exceed MRP`,
        };
      }
    }

    const { createAdminClient } = await import("@/utils/supabase/admin");
    const supabase = createAdminClient();

    const ts = Date.now();
    const sku =
      String(input.sku || "").trim() ||
      `SKU-${ts}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const slugBase = slugify(name) || "product";
    const slug = `${slugBase}-${ts}`;

    let baseMrp = mrp;
    let basePrice = sellingPrice;
    let baseStock = stock;
    if (variants.length > 0) {
      basePrice = Math.min(...variants.map((v) => Number(v.sellingPrice) || 0));
      baseMrp = Math.min(
        ...variants.map((v) => {
          const vm = Number(v.mrp);
          return Number.isFinite(vm) && vm > 0 ? vm : Number(v.sellingPrice) || 0;
        })
      );
      baseStock = variants.reduce(
        (sum, v) => sum + Math.max(0, Math.floor(Number(v.stock) || 0)),
        0
      );
    }

    const imageUrlRaw = String(input.imageUrl || "").trim() || null;
    let imageUrl: string | null = null;
    if (imageUrlRaw) {
      try {
        const { fetchAndUploadImageToR2, isOurR2Url } = await import(
          "@/lib/storage/R2Client"
        );
        imageUrl = isOurR2Url(imageUrlRaw)
          ? imageUrlRaw
          : await fetchAndUploadImageToR2(imageUrlRaw, `manual/${slugBase}`);
      } catch (e: any) {
        return {
          success: false,
          error:
            e?.message ||
            "Cloudflare R2 is required to store product images",
        };
      }
    }

    // Variant images → R2
    const { fetchAndUploadImageToR2, isOurR2Url } = await import(
      "@/lib/storage/R2Client"
    );
    const variantsUploaded: ManualVariantInput[] = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      let vImg = String(v.imageUrl || "").trim() || imageUrl || "";
      if (vImg) {
        try {
          if (!isOurR2Url(vImg)) {
            vImg = await fetchAndUploadImageToR2(
              vImg,
              `manual/${slugBase}-v${i}`
            );
          }
        } catch (e: any) {
          return {
            success: false,
            error: e?.message || "R2 upload failed for variant image",
          };
        }
      }
      variantsUploaded.push({ ...v, imageUrl: vImg || undefined });
    }

    const hasLaptopAxes = variants.some(
      (v) => String(v.cpu || "").trim() || String(v.display_size || "").trim()
    );
    const productPayload = {
      name,
      slug,
      sku,
      type,
      category_id: input.categoryId || null,
      brand_id: input.brandId || null,
      short_description: String(input.shortDescription || "").trim() || null,
      full_description: String(input.fullDescription || "").trim() || null,
      main_image_url: imageUrl,
      mrp: baseMrp,
      selling_price: basePrice,
      stock_quantity: baseStock,
      tax_rate: Number.isFinite(taxRate) ? taxRate : 18,
      status: input.status || "active",
      specifications: {
        created_via: "manual_admin",
        storage: "cloudflare_r2",
        ...(hasLaptopAxes
          ? {
              product_type: "laptop",
              device_form: "laptop",
              variant_schema: "laptop_config",
            }
          : {}),
      },
    };

    const { data: product, error: productErr } = await supabase
      .from("products")
      .insert(productPayload)
      .select("id, slug, name")
      .single();

    if (productErr || !product) {
      return {
        success: false,
        error: productErr?.message || "Failed to create product",
      };
    }

    if (imageUrl) {
      await supabase.from("product_images").insert({
        product_id: product.id,
        url: imageUrl,
        alt_text: name,
        sort_order: 0,
      });
    }

    if (variantsUploaded.length > 0) {
      const shortId = String(product.id).replace(/-/g, "").slice(0, 8);
      const { laptopVariantName } = await import("@/lib/catalog/laptopVariants");
      const rows = variantsUploaded.map((v, index) => {
        const color = String(v.color || "").trim();
        const ram = String(v.ram || "").trim();
        const storage = String(v.storage || "").trim();
        const cpu = String((v as any).cpu || "").trim();
        const display_size = String((v as any).display_size || "").trim();
        const isLaptop = Boolean(cpu || display_size);
        const autoName = isLaptop
          ? laptopVariantName({ cpu, ram, storage, display_size, color })
          : [ram, storage, color].filter(Boolean).join(" / ");
        const variantName =
          String(v.name || "").trim() || autoName || `Variant ${index + 1}`;
        const attrBits = [cpu, display_size, storage, ram, color]
          .filter(Boolean)
          .join("-")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40);

        return {
          product_id: product.id,
          sku: `VAR-${shortId}-${index + 1}-${attrBits || "std"}-${ts.toString(36)}`,
          name: variantName,
          mrp: Number(v.mrp) || Number(v.sellingPrice) || 0,
          selling_price: Number(v.sellingPrice) || 0,
          stock_quantity: Math.max(0, Math.floor(Number(v.stock) || 0)),
          image_url: String(v.imageUrl || "").trim() || imageUrl,
          attributes: {
            color: color || null,
            ram: ram || null,
            storage: storage || null,
            cpu: cpu || null,
            display_size: display_size || null,
            device_form: isLaptop ? "laptop" : null,
          },
          status: true,
        };
      });

      const { error: varErr } = await supabase
        .from("product_variants")
        .insert(rows);
      if (varErr) {
        return {
          success: false,
          error: `Product created but variants failed: ${varErr.message}`,
          productId: product.id,
        };
      }
    }

    return {
      success: true,
      productId: product.id,
      slug: product.slug,
      message: `Created “${product.name}”`,
    };
  } catch (e: any) {
    console.error("createManualProduct", e);
    return { success: false, error: e?.message || "Failed to create product" };
  }
}

export type PublishCatalogInput = {
  masterDeviceId: string;
  productType: "new_mobile" | "used_mobile" | "accessory" | "part";
  categoryId?: string | null;
  taxRate?: number;
  /** Editable storefront title (cleaned / customized before publish) */
  productName?: string;
  shortDescription?: string;
  /** Optional subset of gallery/main image URLs chosen in the UI */
  selectedImageUrls?: string[];
  /**
   * When a matching store product exists (same master/model + type):
   * merge new variants into it (default true). Set false to always create a new listing.
   */
  mergeIfExists?: boolean;
  variants: Array<{
    masterVariantId: string;
    mrp: number;
    sellingPrice: number;
    stock: number;
  }>;
};

/**
 * Publish a Master Catalog device into storefront products (+ variants).
 */
export async function publishCatalogProduct(input: PublishCatalogInput) {
  try {
    const auth = await assertAdminOrStaff();
    if (!auth.ok) return { success: false, error: auth.error };

    if (!input.masterDeviceId) {
      return { success: false, error: "Master device required" };
    }
    if (!input.variants?.length) {
      return {
        success: false,
        error: "Select at least one variant with pricing",
      };
    }

    for (const [i, v] of input.variants.entries()) {
      if (!Number.isFinite(v.sellingPrice) || v.sellingPrice <= 0) {
        return {
          success: false,
          error: `Variant ${i + 1}: selling price must be > 0`,
        };
      }
      if (
        Number.isFinite(v.mrp) &&
        v.mrp > 0 &&
        v.sellingPrice > v.mrp
      ) {
        return {
          success: false,
          error: `Variant ${i + 1}: selling price cannot exceed MRP`,
        };
      }
    }

    const { createAdminClient } = await import("@/utils/supabase/admin");
    const supabase = createAdminClient();

    const { data: device, error: deviceErr } = await supabase
      .from("master_devices")
      .select(
        "id, model_name, slug, brand_id, specifications, master_device_variants(*)"
      )
      .eq("id", input.masterDeviceId)
      .maybeSingle();

    if (deviceErr) {
      console.error("publishCatalogProduct device lookup", deviceErr);
      return {
        success: false,
        error: `Master device lookup failed: ${deviceErr.message}`,
      };
    }
    if (!device) {
      return {
        success: false,
        error: `Master device not found (id: ${input.masterDeviceId})`,
      };
    }

    const { formatStoreProductName } = await import(
      "@/lib/catalog/scraper/extractProductImages"
    );
    const {
      findMergeTargetProduct,
      variantIdentityKey,
      mergeColorImageMaps,
      mergeGalleryUrlLists,
    } = await import("@/lib/catalog/publishMerge");

    const { data: brandRow } = device.brand_id
      ? await supabase
          .from("brands")
          .select("name")
          .eq("id", device.brand_id)
          .maybeSingle()
      : { data: null };

    const productName =
      String(input.productName || "").trim() ||
      formatStoreProductName(device.model_name, brandRow?.name);

    const mergeIfExists = input.mergeIfExists !== false;
    const existingProduct = mergeIfExists
      ? await findMergeTargetProduct(supabase, {
          masterDeviceId: device.id,
          productType: input.productType,
          brandId: device.brand_id,
          candidateName: productName,
        })
      : null;

    const masterVariants: any[] = Array.isArray(device.master_device_variants)
      ? device.master_device_variants
      : [];
    const byId = new Map(masterVariants.map((v) => [v.id, v]));

    const hasMasterVariants = masterVariants.length > 0;
    let active = hasMasterVariants
      ? input.variants
          .map((v) => ({ conf: v, mv: byId.get(v.masterVariantId) }))
          .filter((x) => x.mv)
      : [];

    // Fallback: client used synthetic "standard" id, or IDs drifted — still publish
    if (!active.length) {
      active = input.variants.map((v, index) => {
        const mv =
          byId.get(v.masterVariantId) ||
          masterVariants[index] ||
          {
            id: v.masterVariantId || `standard-${index}`,
            color: masterVariants[index]?.color || "Default",
            ram: masterVariants[index]?.ram || "",
            storage: masterVariants[index]?.storage || "Standard",
            reference_image_url:
              masterVariants[index]?.reference_image_url ||
              (device.specifications as any)?.main_image_url ||
              null,
          };
        return { conf: v, mv };
      });
    }

    if (!active.length) {
      return {
        success: false,
        error: "Add pricing for at least one listing / variant",
      };
    }

    const specs = (device.specifications || {}) as Record<string, any>;
    const basePrice = Math.min(...active.map((a) => a.conf.sellingPrice));
    const baseMrp = Math.min(
      ...active.map((a) =>
        a.conf.mrp > 0 ? a.conf.mrp : a.conf.sellingPrice
      )
    );
    const totalStock = active.reduce(
      (sum, a) => sum + Math.max(0, Math.floor(a.conf.stock || 0)),
      0
    );

    const {
      curateSourceImages,
      uploadCuratedImagesToR2,
      IMAGE_LIMITS,
    } = await import("@/lib/storage/productImages");

    const allGallery = Array.isArray(specs.gallery_images)
      ? (specs.gallery_images as string[]).filter(Boolean)
      : [];
    const selected = (input.selectedImageUrls || [])
      .map((u) => String(u || "").trim())
      .filter(Boolean);
    const selectedSet = new Set(selected);

    // If admin picked images, only upload those; else keep auto-curated set
    const galleryForPublish =
      selected.length > 0
        ? allGallery.filter((u) => selectedSet.has(u)).length
          ? allGallery.filter((u) => selectedSet.has(u))
          : selected
        : allGallery;

    const mainCandidate =
      (selected.length > 0 ? selected[0] : "") ||
      specs.main_image_url ||
      galleryForPublish[0] ||
      active.find((a) => a.mv.reference_image_url)?.mv.reference_image_url ||
      "";

    const curated = curateSourceImages({
      main: mainCandidate,
      gallery: galleryForPublish,
      colorImages:
        selected.length > 0
          ? Object.fromEntries(
              Object.entries((specs.color_images || {}) as Record<string, string>).filter(
                ([, url]) => selectedSet.has(url)
              )
            )
          : specs.color_images || {},
      variantImages: active.map(({ mv }) => ({
        color: mv.color,
        url:
          selected.length === 0 ||
          !mv.reference_image_url ||
          selectedSet.has(mv.reference_image_url)
            ? mv.reference_image_url
            : mainCandidate,
      })),
    });

    let uploadedImages;
    try {
      uploadedImages = await uploadCuratedImagesToR2(
        curated,
        slugify(productName || device.slug || "product")
      );
    } catch (e: any) {
      return {
        success: false,
        error:
          e?.message ||
          "Cloudflare R2 is required to publish product images",
      };
    }

    const mainImage = uploadedImages.main;
    const { resolveColorImageUrl, expandColorImagesForVariants } = await import(
      "@/lib/catalog/colorImages"
    );
    const activeColors = active.map(({ mv }) => String(mv.color || "")).filter(Boolean);
    const expandedColors = expandColorImagesForVariants(
      uploadedImages.colorImages || {},
      activeColors
    );
    // Prefer expanded map on the product payload
    uploadedImages.colorImages = {
      ...uploadedImages.colorImages,
      ...expandedColors,
    };

    const mappedActive = active.map(({ conf, mv }) => {
      const colorKey = String(mv.color || "");
      const img =
        resolveColorImageUrl(colorKey, uploadedImages.colorImages) ||
        uploadedImages.colorImages[colorKey] ||
        mainImage;
      return { conf, mv: { ...mv, reference_image_url: img } };
    });

    const ts = Date.now();

    // —— MERGE into existing listing (new variants / price / stock updates) ——
    if (existingProduct) {
      const { data: existingVariants } = await supabase
        .from("product_variants")
        .select("id, name, attributes, stock_quantity, mrp, selling_price, image_url, status")
        .eq("product_id", existingProduct.id);

      const byKey = new Map<string, any>();
      for (const ev of existingVariants || []) {
        const attrs = (ev.attributes || {}) as Record<string, string>;
        byKey.set(
          variantIdentityKey({
            master_variant_id: attrs.master_variant_id,
            color: attrs.color,
            ram: attrs.ram,
            storage: attrs.storage,
            cpu: attrs.cpu,
            display_size: attrs.display_size,
          }),
          ev
        );
        // Also index by name attrs if master id missing on older rows
        byKey.set(
          variantIdentityKey({
            color: attrs.color,
            ram: attrs.ram,
            storage: attrs.storage,
            cpu: attrs.cpu,
            display_size: attrs.display_size,
          }),
          ev
        );
      }

      let updatedCount = 0;
      let addedCount = 0;
      const shortProduct = String(existingProduct.id)
        .replace(/-/g, "")
        .slice(0, 8);
      const { laptopVariantName } = await import("@/lib/catalog/laptopVariants");
      const isLaptopDevice =
        String((device.specifications as any)?.device_form || "") === "laptop" ||
        String((device.specifications as any)?.product_type || "") === "laptop";

      for (const [index, { conf, mv }] of mappedActive.entries()) {
        const cpu = String((mv as any).cpu || "").trim();
        const display_size = String((mv as any).display_size || "").trim();
        const isLaptop = isLaptopDevice || Boolean(cpu || display_size);
        const colorSuffix = mv.color ? ` - ${mv.color}` : "";
        const variantName = isLaptop
          ? laptopVariantName({
              cpu,
              ram: mv.ram || "",
              storage: mv.storage || "",
              display_size,
              color: mv.color || "",
            })
          : `${mv.ram || ""} / ${mv.storage || ""}${colorSuffix}`
              .replace(/^ \/ | \/ $/g, "")
              .trim();
        const keyPrimary = variantIdentityKey({
          master_variant_id: mv.id,
          color: mv.color,
          ram: mv.ram,
          storage: mv.storage,
          cpu,
          display_size,
        });
        const keyAttrs = variantIdentityKey({
          color: mv.color,
          ram: mv.ram,
          storage: mv.storage,
          cpu,
          display_size,
        });
        const hit = byKey.get(keyPrimary) || byKey.get(keyAttrs);

        if (hit) {
          const { error: upVarErr } = await supabase
            .from("product_variants")
            .update({
              name: variantName || hit.name || "Standard",
              mrp: conf.mrp || conf.sellingPrice,
              selling_price: conf.sellingPrice,
              stock_quantity: Math.max(0, Math.floor(conf.stock || 0)),
              image_url: mv.reference_image_url || hit.image_url || mainImage,
              status: true,
              attributes: {
                ...(hit.attributes || {}),
                master_variant_id: mv.id,
                color: mv.color,
                ram: mv.ram,
                storage: mv.storage,
                cpu: cpu || null,
                display_size: display_size || null,
                device_form: isLaptop ? "laptop" : null,
              },
            })
            .eq("id", hit.id);
          if (upVarErr) {
            return {
              success: false,
              error: `Could not update variant: ${upVarErr.message}`,
              productId: existingProduct.id,
            };
          }
          updatedCount++;
        } else {
          const attrBits = [cpu, display_size, mv.storage, mv.ram, mv.color]
            .filter(Boolean)
            .join("-")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 40);
          const { data: inserted, error: insErr } = await supabase
            .from("product_variants")
            .insert({
              product_id: existingProduct.id,
              sku: `VAR-${shortProduct}-${(existingVariants?.length || 0) + index + 1}-${attrBits || "std"}-${ts.toString(36)}`,
              name: variantName || "Standard",
              mrp: conf.mrp || conf.sellingPrice,
              selling_price: conf.sellingPrice,
              stock_quantity: Math.max(0, Math.floor(conf.stock || 0)),
              image_url: mv.reference_image_url || mainImage || null,
              attributes: {
                master_variant_id: mv.id,
                color: mv.color,
                ram: mv.ram,
                storage: mv.storage,
                cpu: cpu || null,
                display_size: display_size || null,
                device_form: isLaptop ? "laptop" : null,
              },
              status: true,
            })
            .select("id")
            .single();
          if (insErr) {
            return {
              success: false,
              error: `Could not add variant: ${insErr.message}`,
              productId: existingProduct.id,
            };
          }
          if (inserted) {
            byKey.set(keyPrimary, inserted);
            byKey.set(keyAttrs, inserted);
          }
          addedCount++;
        }
      }

      // Refresh totals from all variants after merge
      const { data: allVars } = await supabase
        .from("product_variants")
        .select("mrp, selling_price, stock_quantity, status")
        .eq("product_id", existingProduct.id);

      const live = (allVars || []).filter((v) => v.status !== false);
      const mergeStock = live.reduce(
        (s, v) => s + Math.max(0, Number(v.stock_quantity) || 0),
        0
      );
      const prices = live
        .map((v) => Number(v.selling_price) || 0)
        .filter((p) => p > 0);
      const mrps = live
        .map((v) => Number(v.mrp) || 0)
        .filter((p) => p > 0);

      const prevSpecs =
        (existingProduct.specifications as Record<string, any>) || {};
      const mergedColors = mergeColorImageMaps(
        prevSpecs.color_images,
        uploadedImages.colorImages
      );
      const prevGallery = Array.isArray(prevSpecs.gallery_images)
        ? prevSpecs.gallery_images
        : [];
      const { data: prevImgRows } = await supabase
        .from("product_images")
        .select("url")
        .eq("product_id", existingProduct.id)
        .order("sort_order", { ascending: true });
      const fromRows = (prevImgRows || []).map((r) => r.url).filter(Boolean);
      const mergedGallery = mergeGalleryUrlLists(
        [...fromRows, ...prevGallery],
        uploadedImages.gallery || [],
        mainImage || existingProduct.main_image_url
      ).slice(0, IMAGE_LIMITS.maxGallery);

      await supabase
        .from("products")
        .update({
          master_device_id: device.id,
          category_id: input.categoryId || null,
          tax_rate: Number(input.taxRate ?? 18) || 18,
          mrp: mrps.length ? Math.min(...mrps) : existingProduct.mrp,
          selling_price: prices.length
            ? Math.min(...prices)
            : existingProduct.selling_price,
          stock_quantity: mergeStock,
          status: "active",
          main_image_url:
            existingProduct.main_image_url || mainImage || null,
          short_description:
            String(input.shortDescription || "").trim() ||
            existingProduct.name ||
            productName,
          specifications: {
            ...prevSpecs,
            from_master: true,
            color_images: mergedColors,
            gallery_images: mergedGallery,
            storage: "cloudflare_r2",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProduct.id);

      // Sync product_images to merged gallery (keep order)
      await supabase
        .from("product_images")
        .delete()
        .eq("product_id", existingProduct.id);
      if (mergedGallery.length) {
        await supabase.from("product_images").insert(
          mergedGallery.map((url, i) => ({
            product_id: existingProduct.id,
            url,
            alt_text: `${existingProduct.name} image ${i + 1}`,
            sort_order: i,
          }))
        );
      }

      const parts: string[] = [];
      if (addedCount) parts.push(`added ${addedCount} new variant${addedCount === 1 ? "" : "s"}`);
      if (updatedCount) parts.push(`updated ${updatedCount}`);
      if (!parts.length) parts.push("no variant changes");

      return {
        success: true,
        merged: true,
        productId: existingProduct.id,
        addedVariants: addedCount,
        updatedVariants: updatedCount,
        message: `Updated existing “${existingProduct.name}” — ${parts.join(", ")}.`,
      };
    }

    // —— CREATE new listing ——
    const slugBase =
      slugify(productName || device.slug || device.model_name) || "device";

    const productPayload = {
      name: productName,
      slug: `${slugBase}-${ts}`,
      sku: `SKU-${ts}-${Math.random().toString(36).slice(2, 8)}`,
      type: input.productType,
      category_id: input.categoryId || null,
      brand_id: device.brand_id,
      master_device_id: device.id,
      mrp: baseMrp,
      selling_price: basePrice,
      stock_quantity: totalStock,
      tax_rate: Number(input.taxRate ?? 18) || 18,
      status: "active",
      main_image_url: mainImage || null,
      short_description:
        String(input.shortDescription || "").trim() ||
        productName ||
        null,
      full_description: String(specs.description || "").trim() || null,
      specifications: {
        from_master: true,
        color_images: uploadedImages.colorImages,
        gallery_images: uploadedImages.gallery,
        storage: "cloudflare_r2",
      },
    };

    const { data: product, error: baseErr } = await supabase
      .from("products")
      .insert(productPayload)
      .select("id")
      .single();

    if (baseErr || !product) {
      return {
        success: false,
        error: baseErr?.message || "Failed to create store product",
      };
    }

    const shortProduct = String(product.id).replace(/-/g, "").slice(0, 8);
    const { laptopVariantName } = await import("@/lib/catalog/laptopVariants");
    const variantPayloads = mappedActive.map(({ conf, mv }, index) => {
      const cpu = String((mv as any).cpu || "").trim();
      const display_size = String((mv as any).display_size || "").trim();
      const isLaptop =
        Boolean(cpu || display_size) ||
        String((device.specifications as any)?.device_form || "") === "laptop" ||
        String((device.specifications as any)?.product_type || "") === "laptop";
      const colorSuffix = mv.color ? ` - ${mv.color}` : "";
      const variantName = isLaptop
        ? laptopVariantName({
            cpu,
            ram: mv.ram || "",
            storage: mv.storage || "",
            display_size,
            color: mv.color || "",
          })
        : `${mv.ram || ""} / ${mv.storage || ""}${colorSuffix}`
            .replace(/^ \/ | \/ $/g, "")
            .trim();
      const attrBits = [cpu, display_size, mv.storage, mv.ram, mv.color]
        .filter(Boolean)
        .join("-")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);

      return {
        product_id: product.id,
        sku: `VAR-${shortProduct}-${index + 1}-${attrBits || "std"}-${ts.toString(36)}`,
        name: variantName || "Standard",
        mrp: conf.mrp || conf.sellingPrice,
        selling_price: conf.sellingPrice,
        stock_quantity: Math.max(0, Math.floor(conf.stock || 0)),
        image_url: mv.reference_image_url || mainImage || null,
        attributes: {
          master_variant_id: mv.id,
          color: mv.color,
          ram: mv.ram,
          storage: mv.storage,
          cpu: cpu || null,
          display_size: display_size || null,
          device_form: isLaptop ? "laptop" : null,
        },
        status: true,
      };
    });

    const { error: varErr } = await supabase
      .from("product_variants")
      .insert(variantPayloads);
    if (varErr) {
      return {
        success: false,
        error: `Product created but variants failed: ${varErr.message}`,
        productId: product.id,
      };
    }

    const galleryRows = uploadedImages.gallery
      .slice(0, IMAGE_LIMITS.maxGallery)
      .map((url, i) => ({
        product_id: product.id,
        url,
        alt_text: `${productName} image ${i + 1}`,
        sort_order: i,
      }));
    if (galleryRows.length) {
      await supabase.from("product_images").insert(galleryRows);
    }

    return {
      success: true,
      merged: false,
      productId: product.id,
      message: `Published “${productName}” to store`,
    };
  } catch (e: any) {
    console.error("publishCatalogProduct", e);
    return { success: false, error: e?.message || "Publish failed" };
  }
}
