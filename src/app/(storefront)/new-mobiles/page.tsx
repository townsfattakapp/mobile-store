import React from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { ProductCard } from "@/components/storefront/ProductCard";
import { PlpToolbar } from "@/components/storefront/PlpToolbar";
import {
  PLP_PAGE_SIZE,
  PRODUCT_CARD_SELECT_INNER_BRAND,
  NON_PHONE_CATEGORY_SLUGS,
  applyPhoneHubFilters,
  getCategoryIdsBySlugs,
} from "@/lib/storefront/productQueries";

export const revalidate = 60;

export default async function NewMobilesPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; sort?: string; min?: string; max?: string; page?: string }>;
}) {
  const resolvedParams = await searchParams;
  const brandFilter = resolvedParams.brand?.trim().toLowerCase() || "";
  const sortFilter = resolvedParams.sort;
  const minPrice = resolvedParams.min ? Number(resolvedParams.min) : null;
  const maxPrice = resolvedParams.max ? Number(resolvedParams.max) : null;
  const page = Math.max(1, Number(resolvedParams.page) || 1);
  const from = (page - 1) * PLP_PAGE_SIZE;
  const to = from + PLP_PAGE_SIZE - 1;

  const supabase = await createClient();
  const excludeCategoryIds = await getCategoryIdsBySlugs(supabase, NON_PHONE_CATEGORY_SLUGS);

  let productQuery = supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT_INNER_BRAND, { count: "exact" })
    .eq("type", "new_mobile")
    .eq("status", "active");

  productQuery = applyPhoneHubFilters(productQuery, excludeCategoryIds);

  if (brandFilter) {
    productQuery = productQuery.ilike("brands.name", `%${brandFilter}%`);
  }
  if (minPrice != null && !Number.isNaN(minPrice)) {
    productQuery = productQuery.gte("selling_price", minPrice);
  }
  if (maxPrice != null && !Number.isNaN(maxPrice)) {
    productQuery = productQuery.lte("selling_price", maxPrice);
  }

  if (sortFilter === "price_asc") {
    productQuery = productQuery.order("selling_price", { ascending: true });
  } else if (sortFilter === "price_desc") {
    productQuery = productQuery.order("selling_price", { ascending: false });
  } else {
    productQuery = productQuery.order("created_at", { ascending: false });
  }

  productQuery = productQuery.range(from, to);

  let brandsQuery = supabase
    .from("products")
    .select("brand:brands!inner(name)")
    .eq("type", "new_mobile")
    .eq("status", "active");

  brandsQuery = applyPhoneHubFilters(brandsQuery, excludeCategoryIds);

  const [{ data: brandRows }, { data: products, count }] = await Promise.all([
    brandsQuery,
    productQuery,
  ]);

  const brandNames = Array.from(
    new Set(
      (brandRows || [])
        .map((r: any) => r.brand?.name)
        .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  const totalPages = Math.max(1, Math.ceil((count || 0) / PLP_PAGE_SIZE));

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
        active: brandFilter === slug,
      };
    }),
  ];

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (brandFilter) params.set("brand", brandFilter);
    if (sortFilter) params.set("sort", sortFilter);
    if (p > 1) params.set("page", String(p));
    const q = params.toString();
    return q ? `/new-mobiles?${q}` : "/new-mobiles";
  }

  return (
    <div className="ms-plp min-h-screen bg-white">
      <div className="ms-plp-hero">
        <div className="ms-plp-hero-inner">
          <h1 className="ms-plp-title">
            Mobiles.{" "}
            <span className="ms-plp-title-muted">
              New phones only — latest launches and everyday picks.
            </span>
          </h1>
          <p className="ms-plp-lede">
            Smartphones for Tiroda. Tablets and laptops live in their own shop sections.
          </p>
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
          <>
            <div className="ms-plp-grid">
              {products.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={i < 4 && page === 1}
                  prefetch={i < 12}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <nav className="ms-plp-pager" aria-label="Pagination">
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} className="ms-plp-pager-link" prefetch>
                    Previous
                  </Link>
                ) : (
                  <span className="ms-plp-pager-link is-disabled">Previous</span>
                )}
                <span className="ms-plp-pager-status">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Link href={pageHref(page + 1)} className="ms-plp-pager-link" prefetch>
                    Next
                  </Link>
                ) : (
                  <span className="ms-plp-pager-link is-disabled">Next</span>
                )}
              </nav>
            )}
          </>
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
