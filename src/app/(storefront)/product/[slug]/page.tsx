import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ProductClient from "./ProductClient";
import { getStorefrontProfile } from "@/lib/store/profile";
import { absoluteUrl } from "@/lib/seo/absoluteUrl";
import {
  buildBreadcrumbJsonLd,
  buildProductImageAlt,
  buildProductJsonLd,
  buildProductMetadata,
  productHubPath,
  type ProductSeoInput,
} from "@/lib/seo/productSeo";

export const revalidate = 60;

const PRODUCT_SELECT = `
  id,
  name,
  slug,
  type,
  status,
  sku,
  barcode,
  selling_price,
  mrp,
  stock_quantity,
  main_image_url,
  short_description,
  full_description,
  seo_title,
  seo_description,
  tax_rate,
  brand:brands(name),
  category:categories(name, slug),
  master_devices(specifications, model_name, release_year),
  variants:product_variants(
    id, name, sku, mrp, selling_price, stock_quantity, attributes, image_url, status
  ),
  product_images(id, url, alt_text, sort_order),
  used_device_details(condition),
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
`;

function normalizeProduct(product: Record<string, unknown>) {
  const brand = Array.isArray(product.brand) ? product.brand[0] ?? null : product.brand;
  const category = Array.isArray(product.category)
    ? product.category[0] ?? null
    : product.category;
  const master_devices = Array.isArray(product.master_devices)
    ? product.master_devices[0] ?? null
    : product.master_devices;
  const used_device_details = Array.isArray(product.used_device_details)
    ? product.used_device_details[0] ?? null
    : product.used_device_details;
  const variants = ((product.variants as { status?: boolean | null }[]) || []).filter(
    (v) => v.status !== false
  );

  return {
    ...product,
    brand,
    category,
    master_devices,
    used_device_details,
    variants,
  };
}

function toSeoInput(pageProduct: any): ProductSeoInput {
  const variants = pageProduct.variants || [];
  const primary =
    variants.find((v: any) => Number(v.stock_quantity) > 0) || variants[0] || null;

  return {
    id: pageProduct.id,
    name: pageProduct.name,
    slug: pageProduct.slug,
    type: pageProduct.type,
    status: pageProduct.status,
    sku: pageProduct.sku,
    barcode: pageProduct.barcode,
    selling_price: primary?.selling_price ?? pageProduct.selling_price,
    mrp: primary?.mrp ?? pageProduct.mrp,
    stock_quantity:
      variants.length > 0
        ? variants.reduce(
            (sum: number, v: any) => sum + Math.max(0, Number(v.stock_quantity) || 0),
            0
          )
        : pageProduct.stock_quantity,
    main_image_url: pageProduct.main_image_url,
    short_description: pageProduct.short_description,
    full_description: pageProduct.full_description,
    seo_title: pageProduct.seo_title,
    seo_description: pageProduct.seo_description,
    brand: pageProduct.brand,
    category: pageProduct.category,
    master_devices: pageProduct.master_devices,
    primaryVariantName: primary?.name || null,
    condition: pageProduct.used_device_details?.condition || null,
  };
}

async function loadProductBySlug(slug: string) {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  // Graceful fallback if optional SEO / used_device_details columns aren't migrated
  if (error && /seo_title|seo_description|barcode|used_device_details|column|schema cache/i.test(error.message)) {
    ({ data, error } = await supabase
      .from("products")
      .select(`
        id, name, slug, type, status, sku, selling_price, mrp, stock_quantity,
        main_image_url, short_description, full_description, tax_rate,
        brand:brands(name),
        category:categories(name, slug),
        master_devices(specifications, model_name, release_year),
        variants:product_variants(
          id, name, sku, mrp, selling_price, stock_quantity, attributes, image_url, status
        ),
        product_images(id, url, alt_text, sort_order),
        used_device_inspections(
          product_id, display_tested, touch_tested, camera_tested, speaker_tested,
          microphone_tested, wifi_tested, bluetooth_tested, charging_tested, battery_tested,
          fingerprint_tested, face_id_tested, sim_tested, buttons_tested,
          quality_checked_badge, inspected_at
        )
      `)
      .eq("slug", slug)
      .maybeSingle());
  }

  if (error || !data) return null;
  return normalizeProduct(data as Record<string, unknown>);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [product, store] = await Promise.all([
    loadProductBySlug(slug),
    getStorefrontProfile(),
  ]);

  if (!product) {
    return { title: "Product not found", robots: { index: false, follow: false } };
  }

  // Draft/archived must not be indexed even if somehow reachable
  if ((product as any).status && (product as any).status !== "active") {
    return {
      ...buildProductMetadata(toSeoInput(product), { storeName: store.brand_name }),
      robots: { index: false, follow: false },
    };
  }

  return buildProductMetadata(toSeoInput(product), { storeName: store.brand_name });
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [pageProduct, store] = await Promise.all([
    loadProductBySlug(slug),
    getStorefrontProfile(),
  ]);

  if (!pageProduct) {
    notFound();
  }

  // Non-active products: soft-hide from public storefront
  if ((pageProduct as any).status && (pageProduct as any).status !== "active") {
    notFound();
  }

  const seo = toSeoInput(pageProduct);
  const hub = productHubPath(seo.type);
  const productUrl = absoluteUrl(`/product/${slug}`);
  const sellerContact = {
    name: store.brand_name,
    phone: store.phone,
    whatsapp_number: store.whatsapp_number,
    whatsapp_url: store.whatsapp_url,
  };

  const breadcrumbItems = [
    { name: "Home", path: "/" },
    { name: hub.label, path: hub.href },
    ...(seo.category?.slug
      ? [{ name: String(seo.category.name), path: `/c/${seo.category.slug}` }]
      : []),
    { name: seo.name, path: `/product/${slug}` },
  ];

  const productLd = buildProductJsonLd(seo, {
    storeName: store.brand_name,
    storeUrl: absoluteUrl("/"),
  });
  const breadcrumbLd = buildBreadcrumbJsonLd(breadcrumbItems);
  const imageAlt = buildProductImageAlt(seo);

  // Ensure product images in client have alt if missing
  const clientProduct = {
    ...pageProduct,
    image_alt: imageAlt,
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <div className="container mx-auto px-4 py-8">
        <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-8">
          <ol className="flex flex-wrap items-center gap-2">
            {breadcrumbItems.map((item, i) => {
              const last = i === breadcrumbItems.length - 1;
              return (
                <li key={`${item.path}-${i}`} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden>/</span>}
                  {last ? (
                    <span className="font-medium text-black line-clamp-1">{item.name}</span>
                  ) : (
                    <Link href={item.path} className="hover:text-black transition-colors">
                      {item.name}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <ProductClient
          initialProduct={clientProduct}
          sellerContact={sellerContact}
          productUrl={productUrl}
        />

        {/* Specifications Section */}
        {(pageProduct as any).master_devices?.specifications &&
          Object.keys((pageProduct as any).master_devices.specifications).length > 0 && (
            <div className="mt-16 bg-white p-8 rounded-2xl border max-w-4xl">
              <h2 className="text-2xl font-bold mb-6">Technical Specifications</h2>

              {Array.isArray(
                (pageProduct as any).master_devices.specifications.spec_sections
              ) &&
              (pageProduct as any).master_devices.specifications.spec_sections.length > 0 ? (
                <div className="space-y-8">
                  {(pageProduct as any).master_devices.specifications.spec_sections.map(
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
              ) : Object.keys(
                  (pageProduct as any).master_devices.specifications.tech_specs || {}
                ).length > 0 ? (
                <div className="divide-y border rounded-xl overflow-hidden">
                  {Object.entries(
                    (pageProduct as any).master_devices.specifications.tech_specs as Record<
                      string,
                      string
                    >
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
                  {Object.entries((pageProduct as any).master_devices.specifications)
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

              {(pageProduct as any).master_devices.specifications.description && (
                <div className="mt-8 pt-8 border-t">
                  <h3 className="text-lg font-bold mb-4">Description</h3>
                  <p className="text-gray-600 leading-relaxed">
                    {(pageProduct as any).master_devices.specifications.description}
                  </p>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
