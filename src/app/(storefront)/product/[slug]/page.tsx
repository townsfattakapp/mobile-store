import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import ProductClient from "./ProductClient";
import { getStorefrontProfile } from "@/lib/store/profile";
import { getSiteUrl } from "@/lib/seo/siteUrl";

export const revalidate = 60; // SSR with ISR

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  
  const supabase = await createClient();

  const [{ data: product, error }, store] = await Promise.all([
    supabase
      .from("products")
      .select(`
      id,
      name,
      slug,
      type,
      status,
      sku,
      selling_price,
      mrp,
      stock_quantity,
      main_image_url,
      short_description,
      full_description,
      tax_rate,
      brand:brands(name),
      master_devices(specifications, model_name, release_year),
      variants:product_variants(
        id, name, sku, mrp, selling_price, stock_quantity, attributes, image_url, status
      ),
      product_images(id, url, alt_text, sort_order),
      used_device_inspections(
        product_id,
        display_tested,
        touch_tested,
        camera_tested,
        speaker_tested,
        microphone_tested,
        wifi_tested,
        bluetooth_tested,
        charging_tested,
        battery_tested,
        fingerprint_tested,
        face_id_tested,
        sim_tested,
        buttons_tested,
        quality_checked_badge,
        inspected_at
      )
    `)
      .eq("slug", slug)
      .maybeSingle(),
    getStorefrontProfile(),
  ]);

  if (error || !product) {
    console.error("Product fetch error:", error);
    notFound();
  }

  // Normalize relation shapes from Supabase (object vs array typings)
  const pageProduct: any = {
    ...product,
    brand: Array.isArray((product as any).brand)
      ? (product as any).brand[0] ?? null
      : (product as any).brand,
    master_devices: Array.isArray((product as any).master_devices)
      ? (product as any).master_devices[0] ?? null
      : (product as any).master_devices,
    variants: ((product as any).variants || []).filter(
      (v: { status?: boolean | null }) => v.status !== false
    ),
  };

  const productUrl = `${getSiteUrl()}/product/${slug}`;
  const sellerContact = {
    name: store.brand_name,
    phone: store.phone,
    whatsapp_number: store.whatsapp_number,
    whatsapp_url: store.whatsapp_url,
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-8 flex items-center gap-2">
          <span>Home</span>
          <span>/</span>
          <span className="capitalize">{pageProduct.type.replace('_', ' ')}s</span>
          <span>/</span>
          <span className="font-medium text-black">{pageProduct.name}</span>
        </div>

        <ProductClient
          initialProduct={pageProduct}
          sellerContact={sellerContact}
          productUrl={productUrl}
        />
        
        {/* Specifications Section */}
        {pageProduct.master_devices?.specifications && Object.keys(pageProduct.master_devices.specifications).length > 0 && (
          <div className="mt-16 bg-white p-8 rounded-2xl border max-w-4xl">
            <h2 className="text-2xl font-bold mb-6">Technical Specifications</h2>

            {/* Prefer structured Samsung/API sections when available */}
            {Array.isArray(pageProduct.master_devices.specifications.spec_sections) &&
            pageProduct.master_devices.specifications.spec_sections.length > 0 ? (
              <div className="space-y-8">
                {pageProduct.master_devices.specifications.spec_sections.map(
                  (section: { title: string; items: { name: string; value: string }[] }) => (
                    <div key={section.title}>
                      <h3 className="text-lg font-semibold text-[#1d1d1f] mb-3">
                        {section.title}
                      </h3>
                      <div className="divide-y border rounded-xl overflow-hidden">
                        {section.items.map((row) => (
                          <div
                            key={`${section.title}-${row.name}`}
                            className="py-3 px-4 flex flex-col sm:flex-row sm:gap-8 bg-white"
                          >
                            <div className="sm:w-2/5 text-sm font-medium text-[#1d1d1f]">
                              {row.name}
                            </div>
                            <div className="sm:w-3/5 text-sm text-[#6e6e73] mt-1 sm:mt-0">
                              {row.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : Object.keys(pageProduct.master_devices.specifications.tech_specs || {}).length > 0 ? (
              <div className="divide-y border rounded-xl overflow-hidden">
                {Object.entries(
                  pageProduct.master_devices.specifications.tech_specs as Record<string, string>
                ).map(([key, value]) => (
                  <div key={key} className="py-3 px-4 flex flex-col sm:flex-row sm:gap-8">
                    <div className="sm:w-2/5 text-sm font-medium text-[#1d1d1f]">{key}</div>
                    <div className="sm:w-3/5 text-sm text-[#6e6e73] mt-1 sm:mt-0">
                      {String(value)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y">
                {Object.entries(pageProduct.master_devices.specifications)
                  .filter(([key, value]) => {
                    if (
                      [
                        "main_image_url",
                        "gallery_images",
                        "color_images",
                        "variant_pricing",
                        "colors",
                        "storages",
                        "description",
                        "image_b64",
                        "image_url",
                        "mrp",
                        "selling_price",
                        "currency",
                        "price_source",
                        "tech_specs",
                        "spec_sections",
                        "tags",
                        "model_sku",
                        "product_type",
                        "source_url",
                        "condition_source",
                        "available_grades",
                        "specs_enriched_from",
                        "specs_source",
                        "marketplace_url",
                        "marketplaceUrl",
                        "flipkart_url",
                        "amazon_url",
                      ].includes(key) ||
                      /marketplace\s*_?url/i.test(key) ||
                      /^(flipkart|amazon)_?url$/i.test(key)
                    ) {
                      return false;
                    }
                    if (value == null || typeof value === "object") return false;
                    const s = String(value).trim();
                    if (
                      !s ||
                      /^see official website$/i.test(s) ||
                      /^see specs$/i.test(s) ||
                      /^n\/a$/i.test(s) ||
                      s === "—" ||
                      /(?:flipkart|amazon)\.com/i.test(s)
                    ) {
                      return false;
                    }
                    return true;
                  })
                  .map(([key, value]) => (
                    <div key={key} className="py-4 flex flex-col sm:flex-row sm:gap-12">
                      <div className="sm:w-1/3 font-medium text-gray-900 capitalize">
                        {key.replace(/_/g, " ")}
                      </div>
                      <div className="sm:w-2/3 text-gray-600 mt-1 sm:mt-0">
                        {String(value)}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {pageProduct.master_devices.specifications.description && (
              <div className="mt-8 pt-8 border-t">
                <h3 className="text-lg font-bold mb-4">Description</h3>
                <p className="text-gray-600 leading-relaxed">
                  {pageProduct.master_devices.specifications.description}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
