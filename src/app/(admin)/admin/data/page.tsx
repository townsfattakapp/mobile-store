"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Archive, AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  archiveAllCustomers,
  archiveAllOrdersAndInvoices,
  getOpsCounts,
  listTrash,
  restoreInvoice,
  restoreOrder,
  restoreRegisteredCustomer,
  restoreWalkInCustomer,
} from "./actions";
import { normalizeAddress } from "@/lib/invoice/types";

type Counts = {
  activeOrders: number;
  activeInvoices: number;
  activeCustomers: number;
  trashOrders: number;
};

type Trash = {
  orders: any[];
  invoices: any[];
  profiles: any[];
  walkins: any[];
};

export default function AdminDataPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [trash, setTrash] = useState<Trash | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    const [c, t] = await Promise.all([getOpsCounts(), listTrash()]);
    if (c.error) setError(c.error);
    if (t.error) setError(t.error);
    if (c.counts) setCounts(c.counts);
    if (t.trash) setTrash(t.trash as Trash);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const runBulk = async (kind: "orders" | "customers" | "all") => {
    const label =
      kind === "orders"
        ? "Archive ALL active orders and invoices into Trash?"
        : kind === "customers"
          ? "Archive ALL registered + walk-in customers into Trash?"
          : "Archive ALL orders, invoices, AND customers into Trash?\n\nThis clears the active lists. Data is kept and can be restored.";

    if (!window.confirm(label + "\n\nThis cannot be undone except via Restore from Trash.")) return;
    const reason = window.prompt("Reason (saved on each archived row):", "Bulk test data clear");
    if (reason == null) return;

    setBusy(kind);
    setMessage(null);
    try {
      const parts: string[] = [];
      if (kind === "orders" || kind === "all") {
        const res = await archiveAllOrdersAndInvoices(reason.trim() || "Bulk test data clear");
        if (res.error) {
          alert(res.error);
          setBusy(null);
          return;
        }
        parts.push(
          `Archived ${res.ordersArchived ?? 0} orders and ${res.invoicesArchived ?? 0} invoices.`
        );
      }
      if (kind === "customers" || kind === "all") {
        const res = await archiveAllCustomers(reason.trim() || "Bulk test data clear");
        if (res.error) {
          alert(res.error);
          setBusy(null);
          return;
        }
        parts.push(
          `Archived ${res.profilesArchived ?? 0} customers and ${res.walkinsArchived ?? 0} walk-ins.`
        );
      }
      setMessage(parts.join(" "));
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async (fn: () => Promise<{ error?: string }>) => {
    const res = await fn();
    if (res.error) alert(res.error);
    else await reload();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Data & Trash</h1>
        <p className="text-sm text-[#6e6e73] mt-1">
          Soft-delete mistakes or clear test data. Archived rows stay in Trash and can be restored —
          nothing is permanently wiped from here.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold">Setup needed</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 text-xs">
              File: <code className="bg-white/80 px-1 rounded">supabase/migrations/APPLY_NOW_soft_delete.sql</code>
            </p>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {message}
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active orders", value: counts?.activeOrders },
          { label: "Active invoices", value: counts?.activeInvoices },
          { label: "Active customers", value: counts?.activeCustomers },
          { label: "Orders in trash", value: counts?.trashOrders },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6e6e73]">
              {card.label}
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums">
              {loading ? "…" : card.value ?? "—"}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border bg-white shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Trash2 className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold">Clear test data</h2>
            <p className="text-sm text-[#6e6e73] mt-1">
              Moves everything into Trash (soft-delete). Use this to wipe trial POS orders, invoices,
              and customers from the active admin lists.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 text-red-700 border-red-200 hover:bg-red-50"
            isLoading={busy === "orders"}
            disabled={!!busy}
            onClick={() => runBulk("orders")}
          >
            <Archive className="w-4 h-4" />
            Archive all orders & invoices
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-red-700 border-red-200 hover:bg-red-50"
            isLoading={busy === "customers"}
            disabled={!!busy}
            onClick={() => runBulk("customers")}
          >
            <Archive className="w-4 h-4" />
            Archive all customers
          </Button>
          <Button
            className="gap-2 bg-red-600 hover:bg-red-700 text-white"
            isLoading={busy === "all"}
            disabled={!!busy}
            onClick={() => runBulk("all")}
          >
            <Archive className="w-4 h-4" />
            Archive everything (orders + customers)
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Trash</h2>
            <p className="text-sm text-[#6e6e73]">Restore anything archived by mistake.</p>
          </div>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="p-8 text-center text-[#6e6e73]">Loading trash…</p>
        ) : !trash ? (
          <p className="p-8 text-center text-[#6e6e73]">Trash unavailable until migration is applied.</p>
        ) : (
          <div className="divide-y">
            <TrashBlock
              title="Orders"
              empty="No archived orders."
              rows={trash.orders}
              render={(o) => {
                const addr = normalizeAddress(o.address_snapshot);
                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-5">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-medium text-[#1d1d1f] hover:underline"
                      >
                        {o.order_number}
                      </Link>
                      <p className="text-xs text-[#6e6e73] mt-0.5">
                        {addr.full_name} · ₹{Number(o.grand_total || 0).toLocaleString("en-IN")} ·{" "}
                        {o.deleted_at
                          ? format(new Date(o.deleted_at), "dd MMM yyyy, hh:mm a")
                          : ""}
                      </p>
                      {o.delete_reason ? (
                        <p className="text-xs text-[#6e6e73]">Reason: {o.delete_reason}</p>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0"
                      onClick={() => doRestore(() => restoreOrder(o.id))}
                    >
                      <RotateCcw className="w-4 h-4" /> Restore
                    </Button>
                  </div>
                );
              }}
            />
            <TrashBlock
              title="Invoices"
              empty="No archived invoices."
              rows={trash.invoices}
              render={(inv) => (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="font-medium text-[#1d1d1f] hover:underline"
                    >
                      {inv.invoice_number}
                    </Link>
                    <p className="text-xs text-[#6e6e73] mt-0.5">
                      {inv.customer_snapshot?.full_name || "—"} ·{" "}
                      {inv.deleted_at
                        ? format(new Date(inv.deleted_at), "dd MMM yyyy, hh:mm a")
                        : ""}
                    </p>
                    {inv.delete_reason ? (
                      <p className="text-xs text-[#6e6e73]">Reason: {inv.delete_reason}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0"
                    onClick={() => doRestore(() => restoreInvoice(inv.id))}
                  >
                    <RotateCcw className="w-4 h-4" /> Restore
                  </Button>
                </div>
              )}
            />
            <TrashBlock
              title="Registered customers"
              empty="No archived customers."
              rows={trash.profiles}
              render={(p) => (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/customers/${p.id}`}
                      className="font-medium text-[#1d1d1f] hover:underline"
                    >
                      {p.full_name || p.email || p.id}
                    </Link>
                    <p className="text-xs text-[#6e6e73] mt-0.5">
                      {p.phone_number || p.email || "—"}
                      {p.deleted_at
                        ? ` · ${format(new Date(p.deleted_at), "dd MMM yyyy, hh:mm a")}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0"
                    onClick={() => doRestore(() => restoreRegisteredCustomer(p.id))}
                  >
                    <RotateCcw className="w-4 h-4" /> Restore
                  </Button>
                </div>
              )}
            />
            <TrashBlock
              title="Walk-in customers"
              empty="No archived walk-ins."
              rows={trash.walkins}
              render={(w) => (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/customers/walk-in/${w.phone_key}`}
                      className="font-medium text-[#1d1d1f] hover:underline"
                    >
                      {w.full_name || w.display_phone || w.phone_key}
                    </Link>
                    <p className="text-xs text-[#6e6e73] mt-0.5">
                      {w.display_phone || w.phone_key}
                      {w.deleted_at
                        ? ` · ${format(new Date(w.deleted_at), "dd MMM yyyy, hh:mm a")}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0"
                    onClick={() => doRestore(() => restoreWalkInCustomer(w.phone_key))}
                  >
                    <RotateCcw className="w-4 h-4" /> Restore
                  </Button>
                </div>
              )}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function TrashBlock({
  title,
  empty,
  rows,
  render,
}: {
  title: string;
  empty: string;
  rows: any[];
  render: (row: any) => React.ReactNode;
}) {
  return (
    <div>
      <div className="px-5 py-3 bg-neutral-50 border-b">
        <h3 className="text-sm font-semibold text-[#1d1d1f]">
          {title}{" "}
          <span className="text-[#6e6e73] font-normal">({rows.length})</span>
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[#6e6e73]">{empty}</p>
      ) : (
        <div className="divide-y">{rows.map((row, i) => <div key={i}>{render(row)}</div>)}</div>
      )}
    </div>
  );
}
