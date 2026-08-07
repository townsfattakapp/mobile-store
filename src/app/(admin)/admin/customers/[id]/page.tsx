"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  MapPin,
  Package,
  FileText,
  Save,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { normalizeAddress } from "@/lib/invoice/types";
import {
  updateCustomerProfile,
  type CustomerStatus,
} from "../actions";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  customer_status: CustomerStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

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
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "confirmed":
    case "processing":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "shipped":
    case "out_for_delivery":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "delivered":
      return "bg-green-100 text-green-800 border-green-200";
    case "cancelled":
    case "refunded":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crmEnabled, setCrmEnabled] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("active");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    let prof: any = null;
    const full = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, phone_number, customer_status, admin_notes, created_at, updated_at, role"
      )
      .eq("id", id)
      .maybeSingle();

    if (full.error && /customer_status|admin_notes/i.test(full.error.message)) {
      setCrmEnabled(false);
      const legacy = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, phone_number, created_at, updated_at, role"
        )
        .eq("id", id)
        .maybeSingle();
      if (legacy.error || !legacy.data) {
        setProfile(null);
        setLoading(false);
        return;
      }
      prof = {
        ...legacy.data,
        customer_status: "active",
        admin_notes: null,
      };
    } else if (full.error || !full.data) {
      setProfile(null);
      setLoading(false);
      return;
    } else {
      prof = full.data;
      setCrmEnabled(true);
    }

    if (prof.role && prof.role !== "customer") {
      // Still allow viewing staff/admin profiles if linked, but note it
    }

    setProfile({
      id: prof.id,
      email: prof.email,
      full_name: prof.full_name,
      phone_number: prof.phone_number,
      customer_status: (prof.customer_status || "active") as CustomerStatus,
      admin_notes: prof.admin_notes ?? null,
      created_at: prof.created_at,
      updated_at: prof.updated_at,
    });
    setFullName(prof.full_name || "");
    setPhone(prof.phone_number || "");
    setStatus((prof.customer_status || "active") as CustomerStatus);
    setNotes(prof.admin_notes || "");

    const [ordersRes, addrRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, grand_total, payment_method, payment_status, status, created_at, address_snapshot"
        )
        .eq("user_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("addresses")
        .select("*")
        .eq("user_id", id)
        .order("is_default", { ascending: false }),
    ]);

    setOrders(ordersRes.data || []);
    setAddresses(addrRes.data || []);

    const orderIds = (ordersRes.data || []).map((o) => o.id);
    if (orderIds.length) {
      const inv = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, order_id, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });
      setInvoices(inv.data || []);
    } else {
      setInvoices([]);
    }

    setLoading(false);
  }, [id]);

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
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    const res = await updateCustomerProfile(profile.id, {
      full_name: fullName,
      phone_number: phone,
      customer_status: status,
      admin_notes: notes,
    });
    setSaving(false);
    if (res.error && !("partial" in res && res.partial)) {
      setError(res.error);
      return;
    }
    if ("partial" in res && res.partial) {
      setMessage(res.error || "Saved with limited fields.");
    } else {
      setMessage("Customer updated.");
    }
    await load();
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading customer…</div>;
  }

  if (!profile) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-red-600">Customer not found.</p>
        <Button variant="outline" onClick={() => router.push("/admin/customers")}>
          Back to customers
        </Button>
      </div>
    );
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
                {profile.full_name || "Unnamed customer"}
              </h1>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${statusBadge(
                  profile.customer_status
                )}`}
              >
                {profile.customer_status}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              Joined {format(new Date(profile.created_at), "dd MMM yyyy")} ·{" "}
              {totals.count} orders · ₹
              {Math.round(totals.spent).toLocaleString("en-IN")} lifetime
            </p>
          </div>
        </div>
        <Button onClick={onSave} isLoading={saving} className="gap-2">
          <Save className="w-4 h-4" />
          Save changes
        </Button>
      </div>

      {!crmEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Run <code className="font-mono">supabase/migrations/02_customer_crm.sql</code>{" "}
          to enable status and admin notes in the database.
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
            <h2 className="font-semibold text-lg">Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Customer name"
              />
              <Input
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 …"
              />
              <Input label="Email" value={profile.email} disabled />
              <div className="w-full flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1d1d1f]">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as CustomerStatus)
                  }
                  disabled={!crmEnabled}
                  className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-neutral-100"
                >
                  <option value="active">Active</option>
                  <option value="vip">VIP</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
            <div className="w-full flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1d1d1f]">
                Admin notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!crmEnabled}
                rows={4}
                placeholder="Internal notes (not visible to customer)…"
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-neutral-100"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50/50 flex items-center gap-2">
              <Package className="w-4 h-4" />
              <h2 className="font-semibold">Orders</h2>
            </div>
            {orders.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No orders yet for this customer.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase border-b bg-white">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Order</th>
                      <th className="px-6 py-3 font-semibold">Date</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold text-right">
                        Total
                      </th>
                      <th className="px-6 py-3 font-semibold text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3 font-medium">
                          {o.order_number}
                        </td>
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
                No invoices linked yet.
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
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
            <h2 className="font-semibold">Snapshot</h2>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Orders</dt>
                <dd className="font-medium">{totals.count}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Lifetime spend</dt>
                <dd className="font-medium">
                  ₹{Math.round(totals.spent).toLocaleString("en-IN")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Addresses</dt>
                <dd className="font-medium">{addresses.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Last updated</dt>
                <dd className="font-medium">
                  {format(new Date(profile.updated_at), "dd MMM yyyy")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50/50 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <h2 className="font-semibold">Addresses</h2>
            </div>
            {addresses.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">
                No saved addresses. Shipping snapshots may still exist on
                individual orders.
              </div>
            ) : (
              <ul className="divide-y">
                {addresses.map((a) => (
                  <li key={a.id} className="p-4 text-sm space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{a.full_name}</span>
                      <span className="text-xs uppercase tracking-wide text-gray-500">
                        {a.type}
                        {a.is_default ? " · default" : ""}
                      </span>
                    </div>
                    <p className="text-gray-600">{a.address_line}</p>
                    <p className="text-gray-600">
                      {a.city}, {a.state} — {a.pin_code}
                    </p>
                    <p className="text-gray-500 text-xs">{a.mobile_number}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {orders[0] && (
            <div className="bg-white rounded-xl shadow-sm border p-4 text-sm">
              <h3 className="font-semibold mb-2">Latest shipping snapshot</h3>
              {(() => {
                const addr = normalizeAddress(orders[0].address_snapshot);
                return (
                  <div className="text-gray-600 space-y-1">
                    <p className="font-medium text-gray-900">{addr.full_name}</p>
                    <p>{addr.address_line}</p>
                    <p>
                      {addr.city}, {addr.state} — {addr.pin_code}
                    </p>
                    <p className="text-xs">{addr.mobile_number}</p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
