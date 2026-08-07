import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import ProductClient from "./ProductClient";

export const revalidate = 60; // SSR with ISR

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select(`
      *,
      brand:brands(name),
      master_devices(specifications, model_name, release_year),
      variants:product_variants(*),
      product_images(*),
      used_device_inspections(*)
    `)
    .eq("slug", slug)
    .single();

  if (error || !product) {
    console.error("Product fetch error:", error);
    notFound();
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-8 flex items-center gap-2">
          <span>Home</span>
          <span>/</span>
          <span className="capitalize">{product.type.replace('_', ' ')}s</span>
          <span>/</span>
          <span className="font-medium text-black">{product.name}</span>
        </div>

        <ProductClient initialProduct={product} />
        
        {/* Specifications Section */}
        {product.master_devices?.specifications && Object.keys(product.master_devices.specifications).length > 0 && (
          <div className="mt-16 bg-white p-8 rounded-2xl border max-w-4xl">
            <h2 className="text-2xl font-bold mb-6">Technical Specifications</h2>

            {/* Prefer structured Samsung/API sections when available */}
            {Array.isArray(product.master_devices.specifications.spec_sections) &&
            product.master_devices.specifications.spec_sections.length > 0 ? (
              <div className="space-y-8">
                {product.master_devices.specifications.spec_sections.map(
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
            ) : Object.keys(product.master_devices.specifications.tech_specs || {}).length > 0 ? (
              <div className="divide-y border rounded-xl overflow-hidden">
                {Object.entries(
                  product.master_devices.specifications.tech_specs as Record<string, string>
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
                {Object.entries(product.master_devices.specifications)
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
                      ].includes(key)
                    ) {
                      return false;
                    }
                    if (value == null || typeof value === "object") return false;
                    const s = String(value).trim();
                    if (!s || /^see official website$/i.test(s) || s === "—") return false;
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

            {product.master_devices.specifications.description && (
              <div className="mt-8 pt-8 border-t">
                <h3 className="text-lg font-bold mb-4">Description</h3>
                <p className="text-gray-600 leading-relaxed">
                  {product.master_devices.specifications.description}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
