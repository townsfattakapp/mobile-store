"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  Search,
  Edit,
  Trash,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Tags,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { bulkSetProductCategoryAction } from "../categories/actions";

type Product = {
  id: string;
  name: string;
  sku: string;
  type: string;
  mrp: number;
  selling_price: number;
  stock_quantity: number;
  status: string;
  category_id: string | null;
  category: { name: string } | null;
  brand: { name: string } | null;
  variants?: { id: string }[];
};

type CategoryOption = { id: string; name: string; active: boolean };

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const TABS = [
  { id: "all", label: "All" },
  { id: "new_mobile", label: "New Mobiles" },
  { id: "used_mobile", label: "Pre-owned" },
  { id: "accessory", label: "Accessories" },
  { id: "part", label: "Spare Parts" },
] as const;

export default function ProductsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState(
    () => searchParams.get("category") || "all"
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkErr, setBulkErr] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const fromUrl = searchParams.get("category");
    if (fromUrl) setCategoryFilter(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("categories")
      .select("id, name, active")
      .order("name", { ascending: true })
      .then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("products")
      .select(
        `
        id, name, sku, type, mrp, selling_price, stock_quantity, status, category_id,
        category:categories(name),
        brand:brands(name),
        variants:product_variants(id)
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (activeTab !== "all") {
      query = query.eq("type", activeTab);
    }

    if (categoryFilter === "uncategorized") {
      query = query.is("category_id", null);
    } else if (categoryFilter !== "all") {
      query = query.eq("category_id", categoryFilter);
    }

    if (debouncedSearch) {
      query = query.or(
        `name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
      setTotalCount(0);
    } else {
      setProducts(
        ((data as unknown as any[]) || []).map((row) => ({
          ...row,
          category: Array.isArray(row.category)
            ? row.category[0] ?? null
            : row.category,
          brand: Array.isArray(row.brand) ? row.brand[0] ?? null : row.brand,
        })) as Product[]
      );
      setTotalCount(count ?? 0);
    }
    setSelected(new Set());
    setLoading(false);
  }, [page, pageSize, activeTab, debouncedSearch, categoryFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalCount);

  useEffect(() => {
    if (!loading && page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, page, totalPages]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      alert("Error deleting product: " + error.message);
    } else {
      fetchProducts();
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setPage(1);
  };

  const handleCategoryFilter = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("category");
    else params.set("category", value);
    const qs = params.toString();
    router.replace(qs ? `/admin/products?${qs}` : "/admin/products");
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const allOnPageSelected =
    products.length > 0 && products.every((p) => selected.has(p.id));

  const toggleAllOnPage = () => {
    if (allOnPageSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(products.map((p) => p.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyBulkCategory = () => {
    if (!selected.size) return;
    setBulkErr("");
    setBulkMsg("");
    const categoryId = bulkCategoryId === "" ? null : bulkCategoryId;
    startTransition(async () => {
      const result = await bulkSetProductCategoryAction(
        Array.from(selected),
        categoryId
      );
      if (result.error) {
        setBulkErr(result.error);
        return;
      }
      setBulkMsg(
        `Updated category on ${result.updated ?? selected.size} product(s).`
      );
      setSelected(new Set());
      fetchProducts();
    });
  };

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    let start = Math.max(2, page - 1);
    let end = Math.min(totalPages - 1, page + 1);

    if (page <= 3) {
      start = 2;
      end = 4;
    } else if (page >= totalPages - 2) {
      start = totalPages - 3;
      end = totalPages - 1;
    }

    if (start > 2) pages.push("ellipsis");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("ellipsis");

    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Products Management</h1>
          <p className="mt-1 text-sm text-[#6e6e73]">
            Manage your catalog, categories, stock, and pricing.
            {!loading && (
              <span className="ml-1 font-medium text-[#424245]">
                ({totalCount.toLocaleString("en-IN")} total)
              </span>
            )}
          </p>
        </div>

        <div className="flex w-full flex-wrap gap-2 md:w-auto">
          <Link href="/admin/categories">
            <Button variant="outline" className="flex items-center gap-2">
              <Tags size={16} />
              Categories
            </Button>
          </Link>
          <Button onClick={fetchProducts} variant="outline" className="flex items-center gap-2">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Link href="/admin/products/new">
            <Button className="flex items-center gap-2">
              <Plus size={16} /> Add Product
            </Button>
          </Link>
        </div>
      </div>

      {bulkErr ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {bulkErr}
        </p>
      ) : null}
      {bulkMsg ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {bulkMsg}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b bg-gray-50 p-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="relative max-w-md flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6e6e73]"
                size={18}
              />
              <input
                type="text"
                placeholder="Search by product name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-[#1d1d1f] outline-none placeholder:text-[#6e6e73] focus:ring-2 focus:ring-black"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => handleCategoryFilter(e.target.value)}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#1d1d1f] outline-none focus:ring-2 focus:ring-black"
              >
                <option value="all">All categories</option>
                <option value="uncategorized">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!c.active ? " (inactive)" : ""}
                  </option>
                ))}
              </select>

              <div className="flex overflow-x-auto rounded-lg bg-gray-200/50 p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-white text-black shadow-sm"
                        : "text-[#6e6e73] hover:text-[#1d1d1f]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selected.size > 0 ? (
            <div className="flex flex-col gap-3 rounded-lg border border-[#17151f]/10 bg-white p-3 sm:flex-row sm:items-center">
              <span className="text-sm font-medium text-[#1d1d1f]">
                {selected.size} selected
              </span>
              <select
                value={bulkCategoryId}
                onChange={(e) => setBulkCategoryId(e.target.value)}
                className="h-9 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="">Uncategorized</option>
                {categories
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <Button
                type="button"
                size="sm"
                onClick={applyBulkCategory}
                isLoading={pending}
              >
                Apply category
              </Button>
              <button
                type="button"
                className="text-sm text-[#6e6e73] underline-offset-2 hover:underline"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b bg-gray-50/50">
              <tr>
                <th className="w-10 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Select all on page"
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-4 font-medium text-[#6e6e73]">Product Info</th>
                <th className="px-6 py-4 font-medium text-[#6e6e73]">Type / Brand</th>
                <th className="px-6 py-4 font-medium text-[#6e6e73]">Price</th>
                <th className="px-6 py-4 font-medium text-[#6e6e73]">Stock</th>
                <th className="px-6 py-4 font-medium text-[#6e6e73]">Status</th>
                <th className="px-6 py-4 text-right font-medium text-[#6e6e73]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#6e6e73]">
                    <div className="mb-2 flex justify-center">
                      <RefreshCw size={24} className="animate-spin text-[#6e6e73]" />
                    </div>
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#6e6e73]">
                    <p className="mb-2">No products found.</p>
                    <Link href="/admin/products/new">
                      <Button variant="outline" size="sm">
                        Add Your First Product
                      </Button>
                    </Link>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selected.has(product.id)}
                        onChange={() => toggleOne(product.id)}
                        aria-label={`Select ${product.name}`}
                        className="rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#1d1d1f]">{product.name}</div>
                      <div className="mt-1 text-xs text-[#6e6e73]">SKU: {product.sku}</div>
                      <div className="mt-1 text-xs text-[#6e6e73]">
                        Category: {product.category?.name || "Uncategorized"}
                      </div>
                      {(product.variants?.length ?? 0) > 0 && (
                        <div className="mt-2 inline-block rounded border bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-[#424245]">
                          {product.variants!.length} Variants
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="capitalize text-[#1d1d1f]">
                        {product.type.replace("_", " ")}
                      </div>
                      <div className="mt-1 text-xs text-[#6e6e73]">
                        {product.brand?.name || "No Brand"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#1d1d1f]">
                        ₹{(product.selling_price || 0).toLocaleString("en-IN")}
                      </div>
                      <div className="mt-1 text-xs text-[#6e6e73] line-through">
                        ₹{(product.mrp || 0).toLocaleString("en-IN")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          product.stock_quantity > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {product.stock_quantity > 0
                          ? `${product.stock_quantity} in stock`
                          : "Out of Stock"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                          product.status === "active"
                            ? "bg-green-100 text-green-700"
                            : product.status === "draft"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/products/${product.id}`}>
                          <button className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50">
                            <Edit size={16} />
                          </button>
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t bg-gray-50/80 px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-3 text-sm text-[#424245]">
            <span>
              Showing{" "}
              <span className="font-semibold text-[#1d1d1f]">{showingFrom}</span>–
              <span className="font-semibold text-[#1d1d1f]">{showingTo}</span> of{" "}
              <span className="font-semibold text-[#1d1d1f]">
                {totalCount.toLocaleString("en-IN")}
              </span>
            </span>
            <label className="flex items-center gap-2">
              <span className="text-[#6e6e73]">Rows</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-[#1d1d1f] outline-none focus:ring-2 focus:ring-black"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
              className="rounded-md border border-gray-200 bg-white p-2 text-[#1d1d1f] transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="First page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-md border border-gray-200 bg-white p-2 text-[#1d1d1f] transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            {getPageNumbers().map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`e-${idx}`} className="select-none px-2 text-[#6e6e73]">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  disabled={loading}
                  className={`h-8 min-w-8 rounded-md border px-2 text-sm font-medium transition-colors ${
                    page === item
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white text-[#1d1d1f] hover:bg-gray-100"
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-md border border-gray-200 bg-white p-2 text-[#1d1d1f] transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
              className="rounded-md border border-gray-200 bg-white p-2 text-[#1d1d1f] transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Last page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
