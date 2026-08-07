"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  generateInvoice,
  getOrderForInvoice,
  getStoreSettings,
  listOrdersWithoutInvoice,
} from "../actions";
import { formatINRPlain, resolveState } from "@/lib/invoice/gst";
import { normalizeAddress, type StoreSettings } from "@/lib/invoice/types";

function GenerateInvoiceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedOrderId = searchParams.get("orderId") || "";

  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderId, setOrderId] = useState(preselectedOrderId);
  const [order, setOrder] = useState<any>(null);
  const [existingInvoice, setExistingInvoice] = useState<any>(null);
  const [mode, setMode] = useState<"auto" | "gst" | "nongst">("auto");
  const [buyerGstin, setBuyerGstin] = useState("");
  const [notes, setNotes] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, o] = await Promise.all([getStoreSettings(), listOrdersWithoutInvoice()]);
      setSettings(s);
      setOrders(o.orders || []);
      if (s.gst_registered) setMode("auto");
      else setMode("nongst");
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (preselectedOrderId && !orderId) setOrderId(preselectedOrderId);
  }, [preselectedOrderId, orderId]);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setExistingInvoice(null);
      return;
    }
    (async () => {
      const res = await getOrderForInvoice(orderId);
      if (res.error) {
        setError(res.error);
        setOrder(null);
      } else {
        setError("");
        setOrder(res.order);
        setExistingInvoice(res.existingInvoice);
      }
    })();
  }, [orderId]);

  const addr = order ? normalizeAddress(order.address_snapshot) : null;
  const buyerState = addr ? resolveState(addr.state) : null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) {
      setError("Select an order first.");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await generateInvoice({
      orderId,
      mode,
      buyerGstin: buyerGstin || undefined,
      notes: notes || undefined,
      reverseCharge,
    });
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    router.push(`/admin/invoices/${res.invoiceId}`);
  };

  if (loading) {
    return <div className="p-8 text-center text-[#6e6e73]">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/invoices")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Generate Invoice</h1>
          <p className="text-sm text-[#6e6e73]">Create GST Tax Invoice or Non-GST retail bill from an order.</p>
        </div>
      </div>

      {settings && !settings.gst_registered && mode === "gst" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl p-4">
          GST is not enabled in store settings.{" "}
          <Link href="/admin/settings" className="underline font-medium">
            Configure GSTIN
          </Link>{" "}
          to issue Tax Invoices.
        </div>
      )}

      <form onSubmit={handleGenerate} className="bg-white border rounded-xl shadow-sm p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
            {existingInvoice && (
              <div className="mt-2">
                <Link href={`/admin/invoices/${existingInvoice.id}`} className="underline font-medium">
                  Open existing invoice {existingInvoice.invoice_number}
                </Link>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#1d1d1f] mb-1.5">Select Order</label>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[#1d1d1f] bg-white focus:ring-2 focus:ring-black outline-none"
            required
          >
            <option value="">Choose an order without invoice...</option>
            {preselectedOrderId && !orders.find((o) => o.id === preselectedOrderId) && order && (
              <option value={order.id}>
                {order.order_number} — ₹{formatINRPlain(order.grand_total)}
              </option>
            )}
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.order_number} · {format(new Date(o.created_at), "dd MMM yyyy")} · ₹
                {formatINRPlain(o.grand_total)} · {normalizeAddress(o.address_snapshot).full_name}
              </option>
            ))}
          </select>
        </div>

        {order && (
          <div className="rounded-xl border bg-neutral-50 p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-[#6e6e73]">Customer</span>
              <span className="font-medium">{addr?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e6e73]">Ship to</span>
              <span className="text-right font-medium">
                {addr?.city}, {addr?.state} {addr?.pin_code}
                {buyerState ? ` (${buyerState.code})` : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e6e73]">Items</span>
              <span className="font-medium">{order.order_items?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e6e73]">Grand Total</span>
              <span className="font-bold">₹{formatINRPlain(order.grand_total)}</span>
            </div>
            {existingInvoice && (
              <p className="text-amber-700 pt-2 border-t">
                Active invoice already exists:{" "}
                <Link href={`/admin/invoices/${existingInvoice.id}`} className="underline">
                  {existingInvoice.invoice_number}
                </Link>
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#1d1d1f] mb-2">Invoice Mode</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                {
                  key: "auto" as const,
                  title: "Auto",
                  desc: settings?.gst_registered
                    ? settings.composition_scheme
                      ? "Bill of Supply"
                      : "Tax Invoice (GST)"
                    : "Non-GST retail bill",
                },
                {
                  key: "gst" as const,
                  title: "GST",
                  desc: "Tax Invoice with CGST/SGST or IGST",
                },
                {
                  key: "nongst" as const,
                  title: "Non-GST",
                  desc: "Retail invoice without tax breakup",
                },
              ]
            ).map((opt) => (
              <label
                key={opt.key}
                className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${
                  mode === opt.key ? "border-black bg-black/5" : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={opt.key}
                  checked={mode === opt.key}
                  onChange={() => setMode(opt.key)}
                  className="sr-only"
                />
                <p className="font-bold text-[#1d1d1f]">{opt.title}</p>
                <p className="text-xs text-[#6e6e73] mt-1">{opt.desc}</p>
              </label>
            ))}
          </div>
        </div>

        {(mode === "gst" || (mode === "auto" && settings?.gst_registered)) && (
          <div className="space-y-4 border-t pt-4">
            <Input
              label="Buyer GSTIN (optional — for B2B)"
              value={buyerGstin}
              onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
              placeholder="e.g. 27AAAAA0000A1Z5"
              maxLength={15}
            />
            <label className="flex items-center gap-2 text-sm text-[#1d1d1f] cursor-pointer">
              <input
                type="checkbox"
                checked={reverseCharge}
                onChange={(e) => setReverseCharge(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              Reverse charge applicable
            </label>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#1d1d1f] mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-[#1d1d1f] bg-white placeholder:text-[#6e6e73] focus:ring-2 focus:ring-black outline-none resize-none"
            placeholder="e.g. IMEI noted on delivery challan"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" className="gap-2 flex-1" isLoading={submitting} disabled={!!existingInvoice}>
            <FileText className="w-4 h-4" />
            Issue Invoice
          </Button>
          <Link href="/admin/settings">
            <Button type="button" variant="outline">
              Settings
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function GenerateInvoicePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#6e6e73]">Loading...</div>}>
      <GenerateInvoiceInner />
    </Suspense>
  );
}
