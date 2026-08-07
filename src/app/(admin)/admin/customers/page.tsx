"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/Button";
import {
  Eye,
  Search,
  Users,
  ShoppingBag,
  IndianRupee,
  Filter,
  Store,
} from "lucide-react";
import {
  formatPhoneDisplay,
  isWalkInOrder,
  normalizePhoneKey,
} from "@/lib/customers/phone";
import { normalizeAddress } from "@/lib/invoice/types";

type CustomerKind = "registered" | "walkin";

type CustomerRow = {
  id: string;
  kind: CustomerKind;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  phone_key: string | null;
  customer_status: "active" | "vip" | "blocked";
  created_at: string;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
  href: string;
};

type StatusFilter = "all" | "active" | "vip" | "blocked";
type KindFilter = "all" | "registered" | "walkin";

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

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [migrationHint, setMigrationHint] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setMigrationHint(null);

    // ── Registered customers ──────────────────────────────────────────
    let profiles: any[] | null = null;
    const full = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, phone_number, customer_status, admin_notes, created_at, role"
      )
      .eq("role", "customer")
      .order("created_at", { ascending: false });

    if (full.error && /customer_status|admin_notes/i.test(full.error.message)) {
      setMigrationHint(
        "Run supabase/migrations/02_customer_crm.sql for VIP/Blocked & notes on registered customers."
      );
      const legacy = await supabase
        .from("profiles")
        .select("id, email, full_name, phone_number, created_at, role")
        .eq("role", "customer")
        .order("created_at", { ascending: false });
      profiles = legacy.data;
    } else if (full.error) {
      console.error("Error fetching customers:", full.error);
      profiles = [];
    } else {
      profiles = full.data;
    }

    const registeredIds = (profiles || []).map((p) => p.id);
    const registeredPhoneKeys = new Set<string>();
    for (const p of profiles || []) {
      const key = normalizePhoneKey(p.phone_number);
      if (key) registeredPhoneKeys.add(key);
    }

    const orderStats = new Map<
      string,
      { count: number; spent: number; last: string | null }
    >();

    if (registeredIds.length) {
      const { data: orders } = await supabase
        .from("orders")
        .select("user_id, grand_total, created_at, status")
        .in("user_id", registeredIds);

      for (const o of orders || []) {
        if (!o.user_id) continue;
        const cur = orderStats.get(o.user_id) || {
          count: 0,
          spent: 0,
          last: null,
        };
        cur.count += 1;
        if (o.status !== "cancelled" && o.status !== "refunded") {
          cur.spent += Number(o.grand_total) || 0;
        }
        if (!cur.last || o.created_at > cur.last) cur.last = o.created_at;
        orderStats.set(o.user_id, cur);
      }
    }

    const registeredRows: CustomerRow[] = (profiles || []).map((p) => {
      const stats = orderStats.get(p.id) || {
        count: 0,
        spent: 0,
        last: null,
      };
      return {
        id: p.id,
        kind: "registered" as const,
        email: p.email,
        full_name: p.full_name,
        phone_number: p.phone_number,
        phone_key: normalizePhoneKey(p.phone_number),
        customer_status: (p.customer_status ||
          "active") as CustomerRow["customer_status"],
        created_at: p.created_at,
        order_count: stats.count,
        total_spent: stats.spent,
        last_order_at: stats.last,
        href: `/admin/customers/${p.id}`,
      };
    });

    // ── Walk-in / guest orders (no user_id) ───────────────────────────
    const { data: guestOrders, error: guestErr } = await supabase
      .from("orders")
      .select(
        "id, user_id, grand_total, created_at, status, notes, address_snapshot"
      )
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (guestErr) console.error("Error fetching walk-in orders:", guestErr);

    type WalkAgg = {
      phone_key: string;
      display_phone: string;
      full_name: string;
      count: number;
      spent: number;
      last: string;
      first: string;
    };
    const walkMap = new Map<string, WalkAgg>();

    for (const o of guestOrders || []) {
      if (!isWalkInOrder(o)) continue;
      const addr = normalizeAddress(o.address_snapshot);
      const phoneKey = normalizePhoneKey(addr.mobile_number);
      if (!phoneKey) continue;
      // Skip if this phone already belongs to a registered customer
      if (registeredPhoneKeys.has(phoneKey)) continue;

      const cur = walkMap.get(phoneKey) || {
        phone_key: phoneKey,
        display_phone: addr.mobile_number || phoneKey,
        full_name: addr.full_name || "Walk-in Customer",
        count: 0,
        spent: 0,
        last: o.created_at,
        first: o.created_at,
      };
      cur.count += 1;
      if (o.status !== "cancelled" && o.status !== "refunded") {
        cur.spent += Number(o.grand_total) || 0;
      }
      if (o.created_at > cur.last) {
        cur.last = o.created_at;
        if (addr.full_name) cur.full_name = addr.full_name;
        if (addr.mobile_number) cur.display_phone = addr.mobile_number;
      }
      if (o.created_at < cur.first) cur.first = o.created_at;
      walkMap.set(phoneKey, cur);
    }

    // CRM overlays (status / preferred name) for walk-ins
    const walkCrm = new Map<
      string,
      { full_name: string | null; customer_status: string; display_phone: string | null }
    >();
    if (walkMap.size) {
      const { data: crmRows, error: crmErr } = await supabase
        .from("walk_in_customers")
        .select("phone_key, full_name, customer_status, display_phone")
        .in("phone_key", [...walkMap.keys()]);

      if (crmErr && /walk_in_customers|relation|does not exist/i.test(crmErr.message)) {
        setMigrationHint((h) =>
          [
            h,
            "Run supabase/migrations/03_walk_in_customers.sql to save status & notes on walk-ins.",
          ]
            .filter(Boolean)
            .join(" ")
        );
      } else {
        for (const r of crmRows || []) {
          walkCrm.set(r.phone_key, r);
        }
      }
    }

    const walkinRows: CustomerRow[] = [...walkMap.values()].map((w) => {
      const crm = walkCrm.get(w.phone_key);
      return {
        id: `walkin:${w.phone_key}`,
        kind: "walkin" as const,
        email: null,
        full_name: crm?.full_name || w.full_name,
        phone_number:
          crm?.display_phone ||
          formatPhoneDisplay(w.phone_key, w.display_phone),
        phone_key: w.phone_key,
        customer_status: (crm?.customer_status ||
          "active") as CustomerRow["customer_status"],
        created_at: w.first,
        order_count: w.count,
        total_spent: w.spent,
        last_order_at: w.last,
        href: `/admin/customers/walk-in/${w.phone_key}`,
      };
    });

    setRows(
      [...registeredRows, ...walkinRows].sort((a, b) => {
        const aT = a.last_order_at || a.created_at;
        const bT = b.last_order_at || b.created_at;
        return bT.localeCompare(aT);
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (statusFilter !== "all" && r.customer_status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (r.full_name || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.phone_number || "").toLowerCase().includes(q) ||
        (r.phone_key || "").includes(q.replace(/\D/g, ""))
      );
    });
  }, [rows, search, statusFilter, kindFilter]);

  const stats = useMemo(() => {
    const registered = rows.filter((r) => r.kind === "registered").length;
    const walkin = rows.filter((r) => r.kind === "walkin").length;
    const withOrders = rows.filter((r) => r.order_count > 0).length;
    const revenue = rows.reduce((s, r) => s + r.total_spent, 0);
    return { registered, walkin, withOrders, revenue };
  }, [rows]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-gray-500 text-sm mt-1">
            Registered accounts and walk-in / POS customers (grouped by phone).
          </p>
        </div>
        <Link href="/admin/pos">
          <Button variant="outline" className="gap-2">
            <Store className="w-4 h-4" />
            Walk-in POS
          </Button>
        </Link>
      </div>

      {migrationHint && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {migrationHint}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Registered",
            value: stats.registered.toString(),
            icon: Users,
          },
          {
            label: "Walk-in",
            value: stats.walkin.toString(),
            icon: Store,
          },
          {
            label: "With orders",
            value: stats.withOrders.toString(),
            icon: ShoppingBag,
          },
          {
            label: "Lifetime value",
            value: `₹${Math.round(stats.revenue).toLocaleString("en-IN")}`,
            icon: IndianRupee,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white border rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium uppercase tracking-wide">
                {card.label}
                <Icon className="w-4 h-4 opacity-60" />
              </div>
              <div className="mt-2 text-xl font-semibold text-[#1d1d1f]">
                {card.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50/50 flex flex-col gap-3">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <Filter className="w-3.5 h-3.5" /> Type
            </span>
            {(["all", "registered", "walkin"] as KindFilter[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                  kindFilter === k
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {k === "walkin" ? "Walk-in" : k}
              </button>
            ))}
            <span className="mx-1 text-gray-300">|</span>
            <span className="text-xs text-gray-500">Status</span>
            {(["all", "active", "vip", "blocked"] as StatusFilter[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                    statusFilter === s
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {s}
                </button>
              )
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b">
              <tr>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Orders</th>
                <th className="px-6 py-4 font-semibold text-right">Spent</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Loading customers...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No customers found. Walk-ins appear after POS sales with a phone number.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {c.full_name || "Unnamed customer"}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {c.last_order_at
                          ? `Last visit ${format(new Date(c.last_order_at), "dd MMM yyyy")}`
                          : `Joined ${format(new Date(c.created_at), "dd MMM yyyy")}`}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">
                        {c.phone_number || "No phone"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {c.email || "No account email"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          c.kind === "walkin"
                            ? "bg-sky-50 text-sky-800 border-sky-200"
                            : "bg-neutral-50 text-neutral-700 border-neutral-200"
                        }`}
                      >
                        {c.kind === "walkin" ? "Walk-in" : "Registered"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${statusBadge(
                          c.customer_status
                        )}`}
                      >
                        {c.customer_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">{c.order_count}</td>
                    <td className="px-6 py-4 text-right font-semibold">
                      ₹{Math.round(c.total_spent).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={c.href}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </Link>
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
