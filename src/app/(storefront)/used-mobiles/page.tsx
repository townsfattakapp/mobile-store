import { createClient } from "@/utils/supabase/server";
import { ProductCard } from "@/components/storefront/ProductCard";
import { PlpToolbar } from "@/components/storefront/PlpToolbar";

export const revalidate = 60;

export default async function UsedMobilesPage({
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
    .eq("type", "used_mobile")
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
            Certified Pre-Owned.{" "}
            <span className="ms-plp-title-muted">Good for you, and the planet.</span>
          </h1>
          <p className="ms-plp-lede">Quality-checked phones with clear pricing.</p>
        </div>
      </div>

      <PlpToolbar
        chips={[{ label: "All Pre-Owned", href: "/used-mobiles", active: true }]}
        basePath="/used-mobiles"
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
            <h3>No pre-owned mobiles available</h3>
            <p>Check back soon for new arrivals.</p>
          </div>
        )}
      </div>
    </div>
  );
}
