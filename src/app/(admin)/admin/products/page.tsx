"use client";

import React, { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  sku: string;
  type: string;
  mrp: number;
  selling_price: number;
  stock_quantity: number;
  status: string;
  category: { name: string } | null;
  brand: { name: string } | null;
  variants?: { id: string }[];
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const TABS = [
  { id: "all", label: "All" },
  { id: "new_mobile", label: "New Mobiles" },
  { id: "used_mobile", label: "Pre-owned" },
  { id: "accessory", label: "Accessories" },
  { id: "part", label: "Spare Parts" },
] as const;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search input
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
        id, name, sku, type, mrp, selling_price, stock_quantity, status,
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
    setLoading(false);
  }, [page, pageSize, activeTab, debouncedSearch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalCount);

  // Keep page in bounds if filters shrink results
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

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Products Management</h1>
          <p className="text-[#6e6e73] text-sm mt-1">
            Manage your catalog, stock, and pricing.
            {!loading && (
              <span className="ml-1 font-medium text-[#424245]">
                ({totalCount.toLocaleString("en-IN")} total)
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
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

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6e6e73]" size={18} />
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] bg-white"
            />
          </div>

          <div className="flex bg-gray-200/50 p-1 rounded-lg overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
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

        {/* Products Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium text-[#6e6e73]">Product Info</th>
                <th className="px-6 py-4 font-medium text-[#6e6e73]">Type / Brand</th>
                <th className="px-6 py-4 font-medium text-[#6e6e73]">Price</th>
                <th className="px-6 py-4 font-medium text-[#6e6e73]">Stock</th>
                <th className="px-6 py-4 font-medium text-[#6e6e73]">Status</th>
                <th className="px-6 py-4 font-medium text-[#6e6e73] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#6e6e73]">
                    <div className="flex justify-center mb-2">
                      <RefreshCw size={24} className="animate-spin text-[#6e6e73]" />
                    </div>
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#6e6e73]">
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
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#1d1d1f]">{product.name}</div>
                      <div className="text-xs text-[#6e6e73] mt-1">SKU: {product.sku}</div>
                      <div className="text-xs text-[#6e6e73] mt-1">
                        Category: {product.category?.name || "Uncategorized"}
                      </div>
                      {(product.variants?.length ?? 0) > 0 && (
                        <div className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-[#424245] rounded text-[10px] font-medium border">
                          {product.variants!.length} Variants
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="capitalize text-[#1d1d1f]">
                        {product.type.replace("_", " ")}
                      </div>
                      <div className="text-xs text-[#6e6e73] mt-1">
                        {product.brand?.name || "No Brand"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#1d1d1f]">
                        ₹{(product.selling_price || 0).toLocaleString("en-IN")}
                      </div>
                      <div className="text-xs text-[#6e6e73] line-through mt-1">
                        ₹{(product.mrp || 0).toLocaleString("en-IN")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
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
                        className={`px-2 py-1 rounded-full text-xs font-medium capitalize 
                        ${
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
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit size={16} />
                          </button>
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t bg-gray-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-[#424245]">
            <span>
              Showing{" "}
              <span className="font-semibold text-[#1d1d1f]">{showingFrom}</span>
              –<span className="font-semibold text-[#1d1d1f]">{showingTo}</span> of{" "}
              <span className="font-semibold text-[#1d1d1f]">
                {totalCount.toLocaleString("en-IN")}
              </span>
            </span>
            <label className="flex items-center gap-2">
              <span className="text-[#6e6e73]">Rows</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="h-8 px-2 border border-gray-300 rounded-md bg-white text-[#1d1d1f] text-sm focus:ring-2 focus:ring-black outline-none"
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
              className="p-2 rounded-md border border-gray-200 bg-white text-[#1d1d1f] hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="First page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-2 rounded-md border border-gray-200 bg-white text-[#1d1d1f] hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            {getPageNumbers().map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`e-${idx}`} className="px-2 text-[#6e6e73] select-none">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  disabled={loading}
                  className={`min-w-8 h-8 px-2 rounded-md text-sm font-medium border transition-colors ${
                    page === item
                      ? "bg-black text-white border-black"
                      : "bg-white text-[#1d1d1f] border-gray-200 hover:bg-gray-100"
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
              className="p-2 rounded-md border border-gray-200 bg-white text-[#1d1d1f] hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-md border border-gray-200 bg-white text-[#1d1d1f] hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
