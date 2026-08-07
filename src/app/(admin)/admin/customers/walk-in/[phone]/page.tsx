"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, FileText, Package, Save, Store } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { normalizeAddress } from "@/lib/invoice/types";
import {
  formatPhoneDisplay,
  normalizePhoneKey,
} from "@/lib/customers/phone";
import {
  updateWalkInCustomer,
  type CustomerStatus,
} from "../../actions";

function statusBadge(status: string) {
  switch (status) {
    case "vip":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "blocked":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
}

function orderStatusColor(status: string) {
  switch (status) {
    case "delivered":
      return "bg-green-100 text-green-800 border-green-200";
    case "cancelled":
    case "refunded":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-blue-100 text-blue-800 border-blue-200";
  }
}

export default function WalkInCustomerPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone: phoneParam } = use(params);
  const phoneKey = normalizePhoneKey(decodeURIComponent(phoneParam)) || "";
  const router = useRouter();

  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crmReady, setCrmReady] = useState(true);

  const [fullName, setFullName] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("active");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!phoneKey) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    setLoading(true);
    setError(null);

    const { data: guestOrders } = await supabase
      .from("orders")
      .select(
        "id, order_number, grand_total, payment_method, payment_status, status, created_at, notes, address_snapshot"
      )
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1000);

    const matched = (guestOrders || []).filter((o) => {
      const addr = normalizeAddress(o.address_snapshot);
      return normalizePhoneKey(addr.mobile_number) === phoneKey;
    });

    setOrders(matched);

    // Defaults from latest order
    if (matched[0]) {
      const addr = normalizeAddress(matched[0].address_snapshot);
      setFullName((prev) => prev || addr.full_name || "Walk-in Customer");
      setDisplayPhone(
        (prev) => prev || formatPhoneDisplay(phoneKey, addr.mobile_number)
      );
    } else {
      setDisplayPhone((prev) => prev || formatPhoneDisplay(phoneKey));
    }

    const orderIds = matched.map((o) => o.id);
    if (orderIds.length) {
      const { data: inv } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, order_id, created_at, customer_snapshot")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });
      setInvoices(inv || []);
    } else {
      setInvoices([]);
    }

    const { data: crm, error: crmErr } = await supabase
      .from("walk_in_customers")
      .select("*")
      .eq("phone_key", phoneKey)
      .maybeSingle();

    if (crmErr && /walk_in_customers|relation|does not exist/i.test(crmErr.message)) {
      setCrmReady(false);
    } else if (crm) {
      setCrmReady(true);
      setFullName(crm.full_name || "");
      setDisplayPhone(crm.display_phone || formatPhoneDisplay(phoneKey));
      setStatus((crm.customer_status || "active") as CustomerStatus);
      setNotes(crm.admin_notes || "");
    } else {
      setCrmReady(true);
    }

    setLoading(false);
  }, [phoneKey]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const spent = orders
      .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
      .reduce((s, o) => s + (Number(o.grand_total) || 0), 0);
    return { count: orders.length, spent };
  }, [orders]);

  const onSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    const res = await updateWalkInCustomer(phoneKey, {
      full_name: fullName,
      display_phone: displayPhone,
      customer_status: status,
      admin_notes: notes,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setMessage("Walk-in customer updated.");
    await load();
  };

  if (!phoneKey) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-red-600">Invalid walk-in phone.</p>
        <Button variant="outline" onClick={() => router.push("/admin/customers")}>
          Back
        </Button>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading walk-in customer…</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/admin/customers")}
            className="rounded-full p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                {fullName || "Walk-in Customer"}
              </h1>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-sky-50 text-sky-800 border-sky-200">
                Walk-in
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${statusBadge(
                  status
                )}`}
              >
                {status}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              {displayPhone || formatPhoneDisplay(phoneKey)} · {totals.count}{" "}
              visits · ₹{Math.round(totals.spent).toLocaleString("en-IN")} spent
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/pos">
            <Button variant="outline" className="gap-2">
              <Store className="w-4 h-4" />
              New POS sale
            </Button>
          </Link>
          <Button onClick={onSave} isLoading={saving} className="gap-2" disabled={!crmReady}>
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      {!crmReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Run <code className="font-mono">supabase/migrations/03_walk_in_customers.sql</code>{" "}
          to save status and admin notes for walk-ins. Orders below still work.
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {orders.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          No guest / POS orders found for this phone yet.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
            <h2 className="font-semibold text-lg">Walk-in profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Display name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!crmReady}
              />
              <Input
                label="Phone"
                value={displayPhone}
                onChange={(e) => setDisplayPhone(e.target.value)}
                disabled={!crmReady}
              />
              <div className="w-full flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1d1d1f]">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                  disabled={!crmReady}
                  className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-neutral-100"
                >
                  <option value="active">Active</option>
                  <option value="vip">VIP</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <Input label="Phone key" value={phoneKey} disabled />
            </div>
            <div className="w-full flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1d1d1f]">
                Admin notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!crmReady}
                rows={4}
                placeholder="Preferred models, warranty reminders, etc."
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-neutral-100"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50/50 flex items-center gap-2">
              <Package className="w-4 h-4" />
              <h2 className="font-semibold">Visits / orders</h2>
            </div>
            {orders.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No orders.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase border-b">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Order</th>
                      <th className="px-6 py-3 font-semibold">Date</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold text-right">Total</th>
                      <th className="px-6 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3 font-medium">{o.order_number}</td>
                        <td className="px-6 py-3 text-gray-500">
                          {format(new Date(o.created_at), "dd MMM yyyy")}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${orderStatusColor(
                              o.status
                            )}`}
                          >
                            {o.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right font-semibold">
                          ₹{Number(o.grand_total).toLocaleString("en-IN")}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="text-sm font-medium underline underline-offset-2"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50/50 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <h2 className="font-semibold">Invoices</h2>
            </div>
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No invoices linked.
              </div>
            ) : (
              <ul className="divide-y">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="px-6 py-3 flex items-center justify-between text-sm"
                  >
                    <div>
                      <div className="font-medium">{inv.invoice_number}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {format(
                          new Date(inv.invoice_date || inv.created_at),
                          "dd MMM yyyy"
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="font-medium underline underline-offset-2"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3 text-sm">
            <h2 className="font-semibold">Snapshot</h2>
            <div className="flex justify-between">
              <span className="text-gray-500">Visits</span>
              <span className="font-medium">{totals.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Lifetime spend</span>
              <span className="font-medium">
                ₹{Math.round(totals.spent).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Invoices</span>
              <span className="font-medium">{invoices.length}</span>
            </div>
            <p className="text-xs text-gray-500 pt-2 border-t">
              Walk-ins are grouped by the last 10 digits of the phone entered at
              POS. Enter a phone on every walk-in bill to keep history together.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
