import React from "react";
import { createClient } from "@/utils/supabase/server";
import { ProductCard } from "@/components/storefront/ProductCard";
import { PlpToolbar } from "@/components/storefront/PlpToolbar";

export const revalidate = 60;

export default async function NewMobilesPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; sort?: string; min?: string; max?: string }>;
}) {
  const resolvedParams = await searchParams;
  const brandFilter = resolvedParams.brand?.trim().toLowerCase() || "";
  const sortFilter = resolvedParams.sort;
  const minPrice = resolvedParams.min ? Number(resolvedParams.min) : null;
  const maxPrice = resolvedParams.max ? Number(resolvedParams.max) : null;

  const supabase = await createClient();

  const { data: brandRows } = await supabase
    .from("products")
    .select("brand:brands!inner(name)")
    .eq("type", "new_mobile")
    .eq("status", "active");

  const brandNames = Array.from(
    new Set(
      (brandRows || [])
        .map((r: any) => r.brand?.name)
        .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  let query = supabase
    .from("products")
    .select(
      `
      *,
      brand:brands!inner(name),
      master_devices(specifications),
      variants:product_variants(*)
    `
    )
    .eq("type", "new_mobile")
    .eq("status", "active");

  if (brandFilter) {
    query = query.ilike("brands.name", `%${brandFilter}%`);
  }

  if (minPrice != null && !Number.isNaN(minPrice)) {
    query = query.gte("selling_price", minPrice);
  }
  if (maxPrice != null && !Number.isNaN(maxPrice)) {
    query = query.lte("selling_price", maxPrice);
  }

  if (sortFilter === "price_asc") {
    query = query.order("selling_price", { ascending: true });
  } else if (sortFilter === "price_desc") {
    query = query.order("selling_price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: products } = await query;

  const chips = [
    {
      label: "All Models",
      href: sortFilter ? `/new-mobiles?sort=${sortFilter}` : "/new-mobiles",
      active: !brandFilter,
    },
    ...brandNames.map((name) => {
      const slug = name.toLowerCase();
      const params = new URLSearchParams();
      params.set("brand", slug);
      if (sortFilter) params.set("sort", sortFilter);
      return {
        label: name,
        href: `/new-mobiles?${params.toString()}`,
        active: brandFilter === slug || brandFilter === name.toLowerCase(),
      };
    }),
  ];

  return (
    <div className="ms-plp min-h-screen bg-white">
      <div className="ms-plp-hero">
        <div className="ms-plp-hero-inner">
          <h1 className="ms-plp-title">
            Store.{" "}
            <span className="ms-plp-title-muted">
              The best way to buy the products you love.
            </span>
          </h1>
          <p className="ms-plp-lede">Latest models. Best prices. Delivered to your door.</p>
        </div>
      </div>

      <PlpToolbar
        chips={chips}
        basePath="/new-mobiles"
        brandParam={brandFilter || null}
        sortParam={sortFilter || null}
      />

      <div className="ms-plp-grid-wrap">
        {products && products.length > 0 ? (
          <div className="ms-plp-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="ms-plp-empty">
            <h3>No products available</h3>
            <p>Check back soon for our latest arrivals.</p>
          </div>
        )}
      </div>
    </div>
  );
}
