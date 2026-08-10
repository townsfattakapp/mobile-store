"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash,
  Power,
  TicketPercent,
} from "lucide-react";
import {
  deletePromoCodeAction,
  listPromoCodesAction,
  setPromoActiveAction,
  upsertPromoCodeAction,
  type PromoFormInput,
} from "./actions";

type PromoRow = PromoFormInput & {
  id: string;
  redemption_count?: number;
  created_at?: string;
};

const PRODUCT_TYPES = [
  { id: "all", label: "All products" },
  { id: "new_mobile", label: "New mobiles" },
  { id: "used_mobile", label: "Used mobiles" },
  { id: "accessory", label: "Accessories" },
  { id: "part", label: "Parts" },
] as const;

function emptyForm(): PromoFormInput {
  return {
    code: "",
    description: "",
    discount_type: "percent",
    discount_value: 10,
    min_order_amount: 0,
    max_discount_amount: null,
    starts_at: "",
    ends_at: "",
    usage_limit: null,
    per_customer_limit: 1,
    first_order_only: false,
    active: true,
    applies_to: ["all"],
  };
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusLabel(p: PromoRow): { text: string; className: string } {
  if (!p.active) return { text: "Inactive", className: "bg-gray-100 text-gray-600" };
  const now = Date.now();
  if (p.starts_at && new Date(p.starts_at).getTime() > now) {
    return { text: "Scheduled", className: "bg-amber-50 text-amber-800" };
  }
  if (p.ends_at && new Date(p.ends_at).getTime() < now) {
    return { text: "Expired", className: "bg-red-50 text-red-700" };
  }
  if (
    p.usage_limit != null &&
    (p.redemption_count || 0) >= p.usage_limit
  ) {
    return { text: "Limit reached", className: "bg-orange-50 text-orange-800" };
  }
  return { text: "Active", className: "bg-emerald-50 text-emerald-800" };
}

export default function PromoCodesPage() {
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PromoFormInput>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listPromoCodesAction();
    if (res.error) setError(res.error);
    setPromos((res.promos || []) as PromoRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const startEdit = (p: PromoRow) => {
    setEditingId(p.id);
    setForm({
      id: p.id,
      code: p.code,
      description: p.description || "",
      discount_type: p.discount_type,
      discount_value: Number(p.discount_value),
      min_order_amount: Number(p.min_order_amount || 0),
      max_discount_amount: p.max_discount_amount ?? null,
      starts_at: toLocalInput(p.starts_at),
      ends_at: toLocalInput(p.ends_at),
      usage_limit: p.usage_limit ?? null,
      per_customer_limit: p.per_customer_limit ?? null,
      first_order_only: Boolean(p.first_order_only),
      active: p.active !== false,
      applies_to: p.applies_to?.length ? p.applies_to : ["all"],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleType = (id: string) => {
    setForm((prev) => {
      let next = [...(prev.applies_to || [])];
      if (id === "all") return { ...prev, applies_to: ["all"] };
      next = next.filter((x) => x !== "all");
      if (next.includes(id)) next = next.filter((x) => x !== id);
      else next.push(id);
      if (!next.length) next = ["all"];
      return { ...prev, applies_to: next };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await upsertPromoCodeAction({
      ...form,
      id: editingId || undefined,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    resetForm();
    await load();
  };

  const handleToggle = async (p: PromoRow) => {
    const res = await setPromoActiveAction(p.id, !p.active);
    if (res.error) alert(res.error);
    else load();
  };

  const handleDelete = async (p: PromoRow) => {
    if (
      !confirm(
        `Delete promo ${p.code}? Codes with past redemptions are deactivated instead.`
      )
    ) {
      return;
    }
    const res = await deletePromoCodeAction(p.id);
    if (res.error) alert(res.error);
    else {
      if (res.deactivated) alert(res.message);
      if (editingId === p.id) resetForm();
      load();
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] flex items-center gap-2">
            <TicketPercent className="h-6 w-6" /> Promo Codes
          </h1>
          <p className="text-sm text-[#6e6e73] mt-1">
            Percent or fixed ₹ discounts for online checkout and Walk-in POS. One
            code per order; cancelled orders free the usage slot.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={load}
          className="flex items-center gap-2"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form
          onSubmit={handleSave}
          className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-5 space-y-4 h-fit"
        >
          <h2 className="text-lg font-semibold">
            {editingId ? "Edit promo" : "Create promo"}
          </h2>

          <Input
            label="Code"
            placeholder="e.g. SAVE100"
            value={form.code}
            onChange={(e) =>
              setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
            }
            required
          />
          <Input
            label="Description (internal)"
            placeholder="Festive offer for first order"
            value={form.description || ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount type
            </label>
            <div className="flex rounded-lg border overflow-hidden text-sm">
              {(["percent", "fixed"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, discount_type: t }))}
                  className={`flex-1 py-2 ${
                    form.discount_type === t
                      ? "bg-[#1d1d1f] text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t === "percent" ? "Percentage %" : "Fixed ₹"}
                </button>
              ))}
            </div>
          </div>

          <Input
            label={form.discount_type === "percent" ? "Percent off" : "Amount off (₹)"}
            type="number"
            min={0.01}
            max={form.discount_type === "percent" ? 100 : undefined}
            step="0.01"
            value={form.discount_value}
            onChange={(e) =>
              setForm((f) => ({ ...f, discount_value: Number(e.target.value) || 0 }))
            }
            required
          />

          <Input
            label="Minimum eligible order (₹)"
            type="number"
            min={0}
            step="1"
            value={form.min_order_amount ?? 0}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                min_order_amount: Number(e.target.value) || 0,
              }))
            }
          />

          {form.discount_type === "percent" && (
            <Input
              label="Max discount cap (₹, optional)"
              type="number"
              min={0}
              step="1"
              placeholder="e.g. 2000"
              value={form.max_discount_amount ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  max_discount_amount: e.target.value
                    ? Number(e.target.value)
                    : null,
                }))
              }
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Starts at (optional)
              </label>
              <input
                type="datetime-local"
                className="w-full h-10 px-3 border rounded-lg text-sm"
                value={form.starts_at || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, starts_at: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ends at (optional)
              </label>
              <input
                type="datetime-local"
                className="w-full h-10 px-3 border rounded-lg text-sm"
                value={form.ends_at || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ends_at: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Total usage limit"
              type="number"
              min={1}
              placeholder="Unlimited"
              value={form.usage_limit ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  usage_limit: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
            <Input
              label="Per customer limit"
              type="number"
              min={1}
              placeholder="Unlimited"
              value={form.per_customer_limit ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  per_customer_limit: e.target.value
                    ? Number(e.target.value)
                    : null,
                }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applies to product types
            </label>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_TYPES.map((t) => {
                const selected = (form.applies_to || []).includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleType(t.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-md border ${
                      selected
                        ? "bg-[#1d1d1f] text-white border-[#1d1d1f]"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(form.first_order_only)}
              onChange={(e) =>
                setForm((f) => ({ ...f, first_order_only: e.target.checked }))
              }
            />
            First order only
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.active !== false}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
            />
            Active
          </label>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving…" : editingId ? "Update" : (
                <span className="inline-flex items-center gap-1">
                  <Plus size={16} /> Create
                </span>
              )}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>

        <div className="lg:col-span-3 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600">Code</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Offer</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Usage</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : promos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      No promo codes yet. Create one on the left.
                    </td>
                  </tr>
                ) : (
                  promos.map((p) => {
                    const st = statusLabel(p);
                    const offer =
                      p.discount_type === "percent"
                        ? `${p.discount_value}%${
                            p.max_discount_amount
                              ? ` (max ₹${Number(p.max_discount_amount).toLocaleString("en-IN")})`
                              : ""
                          }`
                        : `₹${Number(p.discount_value).toLocaleString("en-IN")}`;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3">
                          <div className="font-semibold tracking-wide">{p.code}</div>
                          {p.description && (
                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                              {p.description}
                            </div>
                          )}
                          {p.min_order_amount && Number(p.min_order_amount) > 0 ? (
                            <div className="text-xs text-gray-400 mt-0.5">
                              Min ₹{Number(p.min_order_amount).toLocaleString("en-IN")}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{offer}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {p.redemption_count || 0}
                          {p.usage_limit != null ? ` / ${p.usage_limit}` : ""}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-md ${st.className}`}
                          >
                            {st.text}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => startEdit(p)}
                              className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              title={p.active ? "Deactivate" : "Activate"}
                              onClick={() => handleToggle(p)}
                              className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
                            >
                              <Power size={15} />
                            </button>
                            <button
                              type="button"
                              title="Delete"
                              onClick={() => handleDelete(p)}
                              className="p-2 rounded-md hover:bg-red-50 text-red-600"
                            >
                              <Trash size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
