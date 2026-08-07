"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Eye, FilePlus, Filter, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { listInvoices } from "./actions";
import { formatINRPlain } from "@/lib/invoice/gst";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  is_gst: boolean;
  status: string;
  financial_year: string | null;
  buyer_gstin: string | null;
  totals_snapshot: { grand_total?: number };
  customer_snapshot: { full_name?: string };
  orders?: { order_number?: string } | null;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "gst" | "nongst" | "cancelled">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await listInvoices();
      if (res.error) {
        setError(res.error);
        setInvoices([]);
      } else {
        setInvoices((res.invoices as InvoiceRow[]) || []);
        setError("");
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (filter === "gst" && (!inv.is_gst || inv.status === "cancelled")) return false;
      if (filter === "nongst" && (inv.is_gst || inv.status === "cancelled")) return false;
      if (filter === "cancelled" && inv.status !== "cancelled") return false;
      if (filter === "all" && inv.status === "cancelled") {
        // still show cancelled in all
      }
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.customer_snapshot?.full_name?.toLowerCase().includes(q) ||
        inv.orders?.order_number?.toLowerCase().includes(q) ||
        false
      );
    });
  }, [invoices, search, filter]);

  const typeLabel = (inv: InvoiceRow) => {
    if (inv.status === "cancelled") return "Cancelled";
    if (inv.invoice_type === "tax_invoice") return "Tax Invoice (GST)";
    if (inv.invoice_type === "bill_of_supply") return "Bill of Supply";
    return "Retail / Non-GST";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Invoices</h1>
          <p className="text-[#6e6e73] text-sm mt-1">
            Indian GST Tax Invoices, Bills of Supply, and Non-GST retail bills.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link href="/admin/settings">
            <Button variant="outline">Store / GST Settings</Button>
          </Link>
          <Link href="/admin/pos">
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <FilePlus className="w-4 h-4" />
              Walk-in POS Billing
            </Button>
          </Link>
          <Link href="/admin/invoices/new">
            <Button className="gap-2" variant="outline">
              Online Order Invoice
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl p-4">
          <p className="font-semibold mb-1">Could not load invoices</p>
          <p>{error}</p>
          <p className="mt-2 text-xs">
            If this is a schema error, run{" "}
            <code className="bg-amber-100 px-1 rounded">supabase/migrations/01_invoices_gst.sql</code>{" "}
            in the Supabase SQL editor.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50/50 flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e6e73]" />
            <input
              type="text"
              placeholder="Search invoice, order, or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-[#6e6e73]" />
            {(
              [
                ["all", "All"],
                ["gst", "GST"],
                ["nongst", "Non-GST"],
                ["cancelled", "Cancelled"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  filter === key
                    ? "bg-black text-white border-black"
                    : "bg-white text-[#424245] border-gray-200 hover:border-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-[#6e6e73] uppercase bg-gray-50/50 border-b">
              <tr>
                <th className="px-6 py-4 font-semibold">Invoice</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Order</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#6e6e73]">
                    Loading invoices...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#6e6e73]">
                    No invoices yet. Generate one from an order.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#1d1d1f]">{inv.invoice_number}</div>
                      {inv.financial_year && (
                        <div className="text-xs text-[#6e6e73] mt-0.5">FY {inv.financial_year}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[#424245]">
                      {format(new Date(inv.invoice_date), "dd MMM yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{inv.customer_snapshot?.full_name || "—"}</div>
                      {inv.buyer_gstin && (
                        <div className="text-xs text-[#6e6e73] mt-0.5">{inv.buyer_gstin}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${
                          inv.status === "cancelled"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : inv.is_gst
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : "bg-neutral-100 text-neutral-800 border-neutral-200"
                        }`}
                      >
                        {typeLabel(inv)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[#424245]">{inv.orders?.order_number || "—"}</div>
                      {inv.orders?.order_number?.startsWith("POS-") ? (
                        <div className="text-[10px] font-semibold text-blue-600 uppercase mt-0.5 tracking-wider">Walk-in POS</div>
                      ) : (
                        <div className="text-[10px] font-semibold text-emerald-600 uppercase mt-0.5 tracking-wider">Online Order</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">
                      ₹{formatINRPlain(inv.totals_snapshot?.grand_total || 0)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/invoices/${inv.id}`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Eye className="w-3.5 h-3.5" /> View
                          </Button>
                        </Link>
                        <Link href={`/admin/invoices/${inv.id}?print=1`}>
                          <Button variant="ghost" size="sm" className="gap-1">
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
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
  );
}
