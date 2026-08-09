"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Save, Trash2 } from "lucide-react";
import { createManualProduct } from "./actions";
import { pickSmartCategoryId } from "@/lib/catalog/categorySmart";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";
import {
  PRODUCT_TYPE_OPTIONS,
  productTypeFromCategory,
  type ProductTypeValue,
} from "@/lib/catalog/productTypes";
import { groupCategoriesForSelect } from "@/lib/catalog/storeCategories";

type Category = { id: string; name: string; slug?: string | null };
type Brand = { id: string; name: string };

type VariantDraft = {
  key: string;
  color: string;
  ram: string;
  storage: string;
  cpu: string;
  display_size: string;
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
    cpu: "",
    display_size: "",
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
    type: "accessory" as ProductTypeValue,
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

  const categoryGroups = useMemo(
    () => groupCategoriesForSelect(categories),
    [categories]
  );

  const selectedTypeMeta = PRODUCT_TYPE_OPTIONS.find((o) => o.value === form.type);

  const isLaptopCategory = useMemo(() => {
    const cat = categories.find((c) => c.id === form.categoryId);
    const slug = String(cat?.slug || cat?.name || "").toLowerCase();
    return /laptop|macbook|notebook/.test(slug) || /laptop|macbook|notebook/i.test(form.name);
  }, [categories, form.categoryId, form.name]);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "type") {
        next.categoryId =
          pickSmartCategoryId(categories, value, prev.name) || prev.categoryId;
      }

      if (key === "categoryId") {
        const cat = categories.find((c) => c.id === value);
        const inferred = productTypeFromCategory(cat);
        if (inferred) next.type = inferred;
      }

      if (key === "name" && value.trim()) {
        // Soft-suggest category for accessories/parts when name changes
        const smart = pickSmartCategoryId(
          categories,
          next.type,
          value,
        );
        if (smart && (!prev.categoryId || prev.name.trim().length < 3)) {
          next.categoryId = smart;
          const cat = categories.find((c) => c.id === smart);
          const inferred = productTypeFromCategory(cat);
          if (inferred) next.type = inferred;
        }
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

  const uploadPrefix = useMemo(() => {
    const base =
      form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "product";
    return `manual/${base}`;
  }, [form.name]);

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
            cpu: v.cpu,
            display_size: v.display_size,
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
              Condition / listing type *
            </label>
            <select
              className={selectClass}
              value={form.type}
              onChange={(e) => setField("type", e.target.value)}
            >
              {PRODUCT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#6e6e73] mt-1.5">
              {selectedTypeMeta?.hint}. Phones, tablets, and laptops all use New or
              Pre-Owned — pick the exact department in Store category below.
            </p>
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

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">
              Store category *
            </label>
            <select
              className={selectClass}
              value={form.categoryId}
              onChange={(e) => setField("categoryId", e.target.value)}
              required
            >
              <option value="">Select category (phones, tablets, laptops, accessories…)</option>
              {categoryGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-[#6e6e73] mt-1.5">
              This is where tablets, laptops, wearables, mobile & computer accessories
              live. Choosing a category auto-sets the listing type above.
            </p>
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
        <AdminImageUploader
          label="Main product image"
          value={form.imageUrl}
          onChange={(url) => setField("imageUrl", url)}
          prefix={uploadPrefix}
          helpText="Upload from your computer — converted to WebP, resized under ~200KB, and stored on Cloudflare R2. Only the R2 URL is saved."
        />
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
              {isLaptopCategory
                ? "Laptop config matrix: CPU · RAM · SSD · display size · color."
                : "Color / RAM / storage rows for phones or multi-SKU accessories."}
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
                {isLaptopCategory && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="CPU / chipset"
                      value={v.cpu}
                      onChange={(e) => updateVariant(v.key, "cpu", e.target.value)}
                      placeholder="Intel Core Ultra 7"
                    />
                    <Input
                      label="Display size"
                      value={v.display_size}
                      onChange={(e) =>
                        updateVariant(v.key, "display_size", e.target.value)
                      }
                      placeholder='15.6"'
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Color"
                    value={v.color}
                    onChange={(e) => updateVariant(v.key, "color", e.target.value)}
                    placeholder="Silver"
                  />
                  <Input
                    label={isLaptopCategory ? "RAM" : "RAM"}
                    value={v.ram}
                    onChange={(e) => updateVariant(v.key, "ram", e.target.value)}
                    placeholder={isLaptopCategory ? "16GB" : "8GB"}
                  />
                  <Input
                    label={isLaptopCategory ? "SSD storage" : "Storage"}
                    value={v.storage}
                    onChange={(e) =>
                      updateVariant(v.key, "storage", e.target.value)
                    }
                    placeholder={isLaptopCategory ? "512GB" : "128GB"}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                </div>
                <AdminImageUploader
                  label="Variant image (optional)"
                  value={v.imageUrl}
                  onChange={(url) => updateVariant(v.key, "imageUrl", url)}
                  prefix={`${uploadPrefix}-v${idx + 1}`}
                  compact
                  helpText="Optional color-specific shot. Same WebP + R2 pipeline as the main image."
                />
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
