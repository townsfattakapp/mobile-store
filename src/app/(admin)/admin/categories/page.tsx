"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Trash, Pencil, RefreshCw, X } from "lucide-react";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "./actions";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  product_count?: number;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [editing, setEditing] = useState<Category | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("categories")
      .select("id, name, slug, description, active")
      .order("name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setCategories([]);
      setLoading(false);
      return;
    }

    const rows = data || [];
    const withCounts = await Promise.all(
      rows.map(async (cat) => {
        const { count } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("category_id", cat.id);
        return { ...cat, product_count: count ?? 0 };
      })
    );

    setCategories(withCounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (!slugTouched && name) {
      setSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "")
      );
    }
  }, [name, slugTouched]);

  const resetForm = () => {
    setName("");
    setSlug("");
    setDescription("");
    setSlugTouched(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await createCategoryAction({ name, slug, description });
      if (result.error) {
        setError(result.error);
        return;
      }
      resetForm();
      setMessage("Category created.");
      fetchCategories();
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await updateCategoryAction({
        id: editing.id,
        name: editing.name,
        slug: editing.slug,
        description: editing.description || "",
        active: editing.active,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(null);
      setMessage("Category updated.");
      fetchCategories();
    });
  };

  const handleDelete = (cat: Category) => {
    if (
      !confirm(
        cat.product_count
          ? `“${cat.name}” has ${cat.product_count} product(s). Delete anyway? (Will fail if still assigned — reassign first.)`
          : `Delete category “${cat.name}”?`
      )
    ) {
      return;
    }
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await deleteCategoryAction(cat.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Category deleted.");
      if (editing?.id === cat.id) setEditing(null);
      fetchCategories();
    });
  };

  const toggleActive = (cat: Category) => {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await updateCategoryAction({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || "",
        active: !cat.active,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(cat.active ? "Category deactivated." : "Category activated.");
      fetchCategories();
    });
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize the catalog. Assign categories on{" "}
            <Link href="/admin/products" className="font-medium underline underline-offset-2">
              Products
            </Link>
            .
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={fetchCategories}
          className="gap-2"
          disabled={loading || pending}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="h-fit rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Add category</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="Category name"
              placeholder="e.g. Power Banks"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Slug"
              placeholder="e.g. power-banks"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              required
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-[#1d1d1f] outline-none placeholder:text-[#6e6e73] focus:ring-2 focus:ring-black"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full gap-2" isLoading={pending}>
              <Plus size={18} /> Add category
            </Button>
          </form>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-6 py-4 font-medium text-gray-600">Name</th>
                  <th className="px-6 py-4 font-medium text-gray-600">Slug</th>
                  <th className="px-6 py-4 font-medium text-gray-600">Products</th>
                  <th className="px-6 py-4 font-medium text-gray-600">Status</th>
                  <th className="px-6 py-4 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Loading categories…
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No categories yet. Add one to get started.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{cat.name}</td>
                      <td className="px-6 py-4 text-gray-500">{cat.slug}</td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/products?category=${cat.id}`}
                          className="font-medium text-blue-700 underline-offset-2 hover:underline"
                        >
                          {cat.product_count ?? 0}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => toggleActive(cat)}
                          disabled={pending}
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            cat.active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {cat.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing({ ...cat })}
                            className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50"
                            aria-label={`Edit ${cat.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cat)}
                            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                            aria-label={`Delete ${cat.name}`}
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
        </div>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit category</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <Input
                label="Name"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                required
              />
              <Input
                label="Slug"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                required
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  rows={3}
                  value={editing.description || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) =>
                    setEditing({ ...editing, active: e.target.checked })
                  }
                  className="rounded"
                />
                Active (visible for assignment / storefront filters)
              </label>
              <div className="flex gap-2 pt-2">
                <Button type="submit" isLoading={pending}>
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
