import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ProductCard } from "@/components/storefront/ProductCard";
import { PlpToolbar } from "@/components/storefront/PlpToolbar";
import { PLP_PAGE_SIZE, PRODUCT_CARD_SELECT } from "@/lib/storefront/productQueries";
import { storeCategoryBySlug } from "@/lib/catalog/storeCategories";
import { siblingCategoryChips } from "@/lib/storefront/nav";

export const revalidate = 60;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const seed = storeCategoryBySlug(slug);
  const title = seed?.name || "Category";
  return {
    title,
    description: seed?.description || `Browse ${title} at our store.`,
  };
}

export default async function CategoryPlpPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort: sortFilter, page: pageRaw } = await searchParams;
  const seed = storeCategoryBySlug(slug);
  const page = Math.max(1, Number(pageRaw) || 1);
  const from = (page - 1) * PLP_PAGE_SIZE;
  const to = from + PLP_PAGE_SIZE - 1;
  const basePath = `/c/${slug}`;

  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug, description, active")
    .eq("slug", slug)
    .maybeSingle();

  if (!category && !seed) {
    notFound();
  }

  const title = category?.name || seed?.name || "Category";
  const lede =
    category?.description ||
    seed?.description ||
    "Browse products in this category.";

  let products: any[] | null = null;
  let count: number | null = 0;

  if (category?.id) {
    let query = supabase
      .from("products")
      .select(PRODUCT_CARD_SELECT, { count: "exact" })
      .eq("category_id", category.id)
      .eq("status", "active");

    if (sortFilter === "price_asc") {
      query = query.order("selling_price", { ascending: true });
    } else if (sortFilter === "price_desc") {
      query = query.order("selling_price", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const res = await query.range(from, to);
    products = res.data;
    count = res.count;
  }

  const totalPages = Math.max(1, Math.ceil((count || 0) / PLP_PAGE_SIZE));
  const siblings = siblingCategoryChips(slug);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (sortFilter) params.set("sort", sortFilter);
    if (p > 1) params.set("page", String(p));
    const q = params.toString();
    return q ? `${basePath}?${q}` : basePath;
  }

  const chips = siblings.length
    ? siblings.map((s) => ({
        label: s.label,
        href: s.href,
        active: s.active,
      }))
    : [{ label: title, href: basePath, active: true }];

  return (
    <div className="ms-plp min-h-screen bg-white">
      <div className="ms-plp-hero">
        <div className="ms-plp-hero-inner">
          <p className="ms-eyebrow mb-3">
            <Link href="/categories" className="hover:text-[#3b2f7c]">
              Categories
            </Link>
          </p>
          <h1 className="ms-plp-title">{title}</h1>
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
            <h3>Nothing listed here yet</h3>
            <p>Products added to this category will show up automatically.</p>
            <Link href="/categories" className="ms-textlink mt-4 inline-flex">
              Browse all categories
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
