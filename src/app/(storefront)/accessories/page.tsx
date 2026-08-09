import React from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { ProductCard } from "@/components/storefront/ProductCard";
import { PlpToolbar } from "@/components/storefront/PlpToolbar";
import { PLP_PAGE_SIZE, PRODUCT_CARD_SELECT } from "@/lib/storefront/productQueries";
import { hubCategoryChips } from "@/lib/storefront/nav";

export const revalidate = 60;

type Props = {
  searchParams: Promise<{ sort?: string; page?: string }>;
};

async function ListingPage({
  type,
  title,
  titleMuted,
  lede,
  basePath,
  emptyTitle,
  chipLabel,
  searchParams,
}: {
  type: string;
  title: string;
  titleMuted: string;
  lede: string;
  basePath: string;
  emptyTitle: string;
  chipLabel: string;
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const { sort: sortFilter, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const from = (page - 1) * PLP_PAGE_SIZE;
  const to = from + PLP_PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT, { count: "exact" })
    .eq("type", type)
    .eq("status", "active");

  if (sortFilter === "price_asc") {
    query = query.order("selling_price", { ascending: true });
  } else if (sortFilter === "price_desc") {
    query = query.order("selling_price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: products, count } = await query.range(from, to);
  const totalPages = Math.max(1, Math.ceil((count || 0) / PLP_PAGE_SIZE));
  const subcats = hubCategoryChips("accessories");

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (sortFilter) params.set("sort", sortFilter);
    if (p > 1) params.set("page", String(p));
    const q = params.toString();
    return q ? `${basePath}?${q}` : basePath;
  }

  const chips = [
    { label: chipLabel, href: basePath, active: true },
    ...subcats.map((c) => ({
      label: c.label,
      href: c.href,
      active: false,
    })),
  ];

  return (
    <div className="ms-plp min-h-screen bg-white">
      <div className="ms-plp-hero">
        <div className="ms-plp-hero-inner">
          <h1 className="ms-plp-title">
            {title} <span className="ms-plp-title-muted">{titleMuted}</span>
          </h1>
          <p className="ms-plp-lede">{lede}</p>
        </div>
      </div>

      <PlpToolbar
        chips={chips}
        basePath={basePath}
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
            <h3>{emptyTitle}</h3>
            <p>Check back soon for our latest arrivals.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function AccessoriesPage(props: Props) {
  return ListingPage({
    type: "accessory",
    title: "Accessories.",
    titleMuted: "Essentials for your essentials.",
    lede: "Cases, chargers, audio, and more.",
    basePath: "/accessories",
    emptyTitle: "No accessories available",
    chipLabel: "All Categories",
    searchParams: props.searchParams,
  });
}
