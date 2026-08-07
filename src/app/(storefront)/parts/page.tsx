import React from "react";
import { createClient } from "@/utils/supabase/server";
import { ProductCard } from "@/components/storefront/ProductCard";
import { PlpToolbar } from "@/components/storefront/PlpToolbar";

export const revalidate = 60;

export default async function SparePartsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: sortFilter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select(
      `
      *,
      brand:brands(name),
      master_devices(specifications),
      variants:product_variants(*)
    `
    )
    .eq("type", "spare_part")
    .eq("status", "active");

  if (sortFilter === "price_asc") {
    query = query.order("selling_price", { ascending: true });
  } else if (sortFilter === "price_desc") {
    query = query.order("selling_price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: products } = await query;

  return (
    <div className="ms-plp min-h-screen bg-white">
      <div className="ms-plp-hero">
        <div className="ms-plp-hero-inner">
          <h1 className="ms-plp-title">
            Spare Parts.{" "}
            <span className="ms-plp-title-muted">Fix it. Keep it going.</span>
          </h1>
          <p className="ms-plp-lede">Original OEM parts for the perfect repair.</p>
        </div>
      </div>

      <PlpToolbar
        chips={[{ label: "All Parts", href: "/parts", active: true }]}
        basePath="/parts"
        sortParam={sortFilter || null}
      />

      <div className="ms-plp-grid-wrap">
        {products && products.length > 0 ? (
          <div className="ms-plp-grid">
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
            ))}
          </div>
        ) : (
          <div className="ms-plp-empty">
            <h3>No parts available</h3>
            <p>Check back soon for our latest arrivals.</p>
          </div>
        )}
      </div>
    </div>
  );
}
