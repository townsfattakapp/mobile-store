"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ImageOff, Plus, Save, Trash2 } from "lucide-react";
import { createManualProduct } from "./actions";
import { pickSmartCategoryId } from "@/lib/catalog/categorySmart";

type Category = { id: string; name: string; slug?: string | null };
type Brand = { id: string; name: string };

type VariantDraft = {
  key: string;
  color: string;
  ram: string;
  storage: string;
  mrp: string;
  price: string;
  stock: string;
  imageUrl: string;
};

function emptyVariant(): VariantDraft {
  return {
    key: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    color: "",
    ram: "",
    storage: "",
    mrp: "",
    price: "",
    stock: "4",
    imageUrl: "",
  };
}

export function ManualProductForm({
  categories,
  brands,
  onBack,
  onSuccess,
}: {
  categories: Category[];
  brands: Brand[];
  onBack: () => void;
  onSuccess: (productId: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enableVariants, setEnableVariants] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    brandId: "",
    type: "accessory" as "new_mobile" | "used_mobile" | "accessory" | "part",
    categoryId: pickSmartCategoryId(categories, "accessory") || "",
    mrp: "",
    price: "",
    stock: "4",
    taxRate: "18",
    imageUrl: "",
    shortDescription: "",
    fullDescription: "",
    status: "active" as "draft" | "active",
  });

  const setField = (key: keyof typeof form, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "type") {
        next.categoryId =
          pickSmartCategoryId(categories, value, prev.name) || prev.categoryId;
      }
      return next;
    });
  };

  const updateVariant = (
    key: string,
    field: keyof VariantDraft,
    value: string
  ) => {
    setVariants((rows) =>
      rows.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  };

  const previewImage = useMemo(() => {
    if (form.imageUrl.trim()) return form.imageUrl.trim();
    const fromVar = variants.find((v) => v.imageUrl.trim())?.imageUrl.trim();
    return fromVar || "";
  }, [form.imageUrl, variants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payloadVariants =
      enableVariants && variants.length > 0
        ? variants.map((v) => ({
            color: v.color,
            ram: v.ram,
            storage: v.storage,
            mrp: parseFloat(v.mrp || form.mrp) || 0,
            sellingPrice: parseFloat(v.price || form.price) || 0,
            stock: parseInt(v.stock || form.stock, 10) || 0,
            imageUrl: v.imageUrl || form.imageUrl,
          }))
        : undefined;

    const result = await createManualProduct({
      name: form.name,
      sku: form.sku || undefined,
      brandId: form.brandId || null,
      categoryId: form.categoryId || null,
      type: form.type,
      mrp: parseFloat(form.mrp) || 0,
      sellingPrice: parseFloat(form.price) || 0,
      stock: parseInt(form.stock, 10) || 0,
      taxRate: parseFloat(form.taxRate) || 18,
      imageUrl: form.imageUrl || undefined,
      shortDescription: form.shortDescription || undefined,
      fullDescription: form.fullDescription || undefined,
      status: form.status,
      variants: payloadVariants,
    });

    setSaving(false);
    if (!result.success || !result.productId) {
      setError(result.error || "Could not create product");
      return;
    }
    onSuccess(result.productId);
  };

  const selectClass =
    "w-full px-3 py-2 border border-neutral-300 rounded-md outline-none focus:ring-2 focus:ring-black text-sm text-[#1d1d1f] bg-white";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1d1d1f]">Create Manually</h2>
          <p className="text-sm text-[#6e6e73]">
            Add accessories, parts, or products not in the Master Catalog.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onBack}>
          Back to Catalog Search
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-5">
        <h3 className="font-semibold text-[#1d1d1f] border-b pb-2">Basics</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Product name *"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Ambrane 20000mAh Power Bank"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">
              Type *
            </label>
            <select
              className={selectClass}
              value={form.type}
              onChange={(e) => setField("type", e.target.value)}
            >
              <option value="accessory">Accessory</option>
              <option value="new_mobile">New Mobile</option>
              <option value="used_mobile">Used / Pre-Owned</option>
              <option value="part">Spare Part</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">
              Brand
            </label>
            <select
              className={selectClass}
              value={form.brandId}
              onChange={(e) => setField("brandId", e.target.value)}
            >
              <option value="">No brand / Generic</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">
              Category
            </label>
            <select
              className={selectClass}
              value={form.categoryId}
              onChange={(e) => setField("categoryId", e.target.value)}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="SKU (optional)"
            value={form.sku}
            onChange={(e) => setField("sku", e.target.value)}
            placeholder="Auto-generated if empty"
          />

          <div>
            <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">
              Status
            </label>
            <select
              className={selectClass}
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
            >
              <option value="active">Active (listed)</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-5">
        <h3 className="font-semibold text-[#1d1d1f] border-b pb-2">
          Pricing & stock
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Input
            label="MRP (₹) *"
            type="number"
            min="0"
            step="0.01"
            value={form.mrp}
            onChange={(e) => setField("mrp", e.target.value)}
            required={!enableVariants}
          />
          <Input
            label="Selling price (₹) *"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => setField("price", e.target.value)}
            required={!enableVariants}
          />
          <Input
            label="Stock *"
            type="number"
            min="0"
            step="1"
            value={form.stock}
            onChange={(e) => setField("stock", e.target.value)}
            required={!enableVariants}
          />
          <Input
            label="GST / tax %"
            type="number"
            min="0"
            max="28"
            step="0.01"
            value={form.taxRate}
            onChange={(e) => setField("taxRate", e.target.value)}
          />
        </div>
        {enableVariants && (
          <p className="text-xs text-[#6e6e73]">
            Base prices above are used as defaults for variants and as fallbacks.
          </p>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-5">
        <h3 className="font-semibold text-[#1d1d1f] border-b pb-2">Image</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-28 h-28 rounded-xl border bg-neutral-50 flex items-center justify-center overflow-hidden shrink-0">
            {previewImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-full object-contain p-2"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span className="text-neutral-400 flex flex-col items-center gap-1 text-[10px]">
                <ImageOff size={18} />
                Preview
              </span>
            )}
          </div>
          <div className="flex-1 w-full">
            <Input
              label="Main image URL"
              value={form.imageUrl}
              onChange={(e) => setField("imageUrl", e.target.value)}
              placeholder="https://…"
            />
            <p className="text-xs text-[#6e6e73] mt-1.5">
              Paste a brand image URL — it is uploaded to Cloudflare R2 and only
              the R2 link is saved in the database.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-5">
        <h3 className="font-semibold text-[#1d1d1f] border-b pb-2">
          Description
        </h3>
        <div>
          <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">
            Short description
          </label>
          <textarea
            value={form.shortDescription}
            onChange={(e) => setField("shortDescription", e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md outline-none focus:ring-2 focus:ring-black text-sm resize-none"
            placeholder="One-line pitch for cards and POS"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">
            Full description
          </label>
          <textarea
            value={form.fullDescription}
            onChange={(e) => setField("fullDescription", e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md outline-none focus:ring-2 focus:ring-black text-sm resize-y"
            placeholder="Specs, warranty, what’s in the box…"
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 border-b pb-2">
          <div>
            <h3 className="font-semibold text-[#1d1d1f]">Variants (optional)</h3>
            <p className="text-xs text-[#6e6e73]">
              Color / RAM / storage rows for phones or multi-SKU accessories.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={enableVariants}
              onChange={(e) => {
                setEnableVariants(e.target.checked);
                if (e.target.checked && variants.length === 0) {
                  setVariants([emptyVariant()]);
                }
              }}
              className="w-4 h-4 rounded border-gray-300"
            />
            Enable
          </label>
        </div>

        {enableVariants && (
          <div className="space-y-3">
            {variants.map((v, idx) => (
              <div
                key={v.key}
                className="border rounded-xl p-4 space-y-3 bg-neutral-50/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#1d1d1f]">
                    Variant {idx + 1}
                  </span>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setVariants((rows) => rows.filter((r) => r.key !== v.key))
                      }
                      className="text-red-600 text-xs inline-flex items-center gap-1 hover:underline"
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Color"
                    value={v.color}
                    onChange={(e) => updateVariant(v.key, "color", e.target.value)}
                    placeholder="Black"
                  />
                  <Input
                    label="RAM"
                    value={v.ram}
                    onChange={(e) => updateVariant(v.key, "ram", e.target.value)}
                    placeholder="8GB"
                  />
                  <Input
                    label="Storage"
                    value={v.storage}
                    onChange={(e) =>
                      updateVariant(v.key, "storage", e.target.value)
                    }
                    placeholder="128GB"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <Input
                    label="MRP"
                    type="number"
                    value={v.mrp}
                    onChange={(e) => updateVariant(v.key, "mrp", e.target.value)}
                    placeholder={form.mrp || "0"}
                  />
                  <Input
                    label="Sell price *"
                    type="number"
                    value={v.price}
                    onChange={(e) => updateVariant(v.key, "price", e.target.value)}
                    placeholder={form.price || "0"}
                    required
                  />
                  <Input
                    label="Stock"
                    type="number"
                    value={v.stock}
                    onChange={(e) => updateVariant(v.key, "stock", e.target.value)}
                  />
                  <Input
                    label="Image URL"
                    value={v.imageUrl}
                    onChange={(e) =>
                      updateVariant(v.key, "imageUrl", e.target.value)
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVariants((rows) => [...rows, emptyVariant()])}
              className="inline-flex items-center gap-1"
            >
              <Plus size={16} /> Add variant
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2"
        >
          {saving ? (
            "Saving..."
          ) : (
            <>
              <Save size={18} /> Create Product
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
