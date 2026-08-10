"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Package,
  Smartphone,
  Users,
  IndianRupee,
  ArrowRight,
  Store,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { normalizeAddress } from "@/lib/invoice/types";

type Stats = {
  sales: number;
  orders: number;
  products: number;
  customers: number;
  walkins: number;
};

type RecentOrder = {
  id: string;
  order_number: string;
  grand_total: number;
  status: string;
  created_at: string;
  address_snapshot: any;
  user_id: string | null;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const [
        ordersRes,
        productsRes,
        profilesRes,
        guestRes,
      ] = await Promise.all([
        sb
          .from("orders")
          .select("id, order_number, grand_total, status, created_at, address_snapshot, user_id")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(8),
        sb
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        sb
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "customer")
          .is("deleted_at", null),
        sb
          .from("orders")
          .select("id", { count: "exact", head: true })
          .is("user_id", null)
          .is("deleted_at", null),
      ]);

      if (cancelled) return;

      let orders = (ordersRes.data || []) as RecentOrder[];
      if (ordersRes.error && /deleted_at|column|schema cache/i.test(ordersRes.error.message)) {
        const fb = await sb
          .from("orders")
          .select("id, order_number, grand_total, status, created_at, address_snapshot, user_id")
          .order("created_at", { ascending: false })
          .limit(8);
        orders = (fb.data || []) as RecentOrder[];
      }

      const sales = orders
        .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
        .reduce((s, o) => s + (Number(o.grand_total) || 0), 0);

      // Approximate totals from limited fetch — also get full counts
      let { count: orderCount } = await sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);

      const { data: paidOrders } = await sb
        .from("orders")
        .select("grand_total, status")
        .neq("status", "cancelled")
        .limit(500);

      const totalSales = (paidOrders || [])
        .filter((o) => o.status !== "refunded")
        .reduce((s, o) => s + (Number(o.grand_total) || 0), 0);

      setStats({
        sales: totalSales || sales,
        orders: orderCount || orders.length,
        products: productsRes.count || 0,
        customers: profilesRes.count || 0,
        walkins: guestRes.count || 0,
      });
      setRecent(orders);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    {
      title: "Total Sales",
      value: loading
        ? "…"
        : `₹${Math.round(stats?.sales || 0).toLocaleString("en-IN")}`,
      icon: IndianRupee,
      href: "/admin/orders",
    },
    {
      title: "Orders",
      value: loading ? "…" : String(stats?.orders || 0),
      icon: Package,
      href: "/admin/orders",
    },
    {
      title: "Active Products",
      value: loading ? "…" : String(stats?.products || 0),
      icon: Smartphone,
      href: "/admin/products",
    },
    {
      title: "Customers",
      value: loading
        ? "…"
        : `${stats?.customers || 0} + ${stats?.walkins || 0} walk-in`,
      icon: Users,
      href: "/admin/customers",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Live snapshot of your store.
          </p>
        </div>
        <Link
          href="/admin/pos"
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-black text-white hover:bg-neutral-800 transition-colors active:scale-[0.98]"
        >
          <Store className="w-4 h-4" />
          Walk-in POS
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.title}
              href={stat.href}
              prefetch
              className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-sm flex items-center gap-4 hover:border-neutral-300 transition-[border-color,transform] duration-150 active:scale-[0.99]"
            >
              <div className="h-11 w-11 bg-neutral-100 rounded-full flex items-center justify-center text-black shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  {stat.title}
                </p>
                <p className="text-xl font-bold text-black truncate">
                  {stat.value}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-base font-bold">Recent Orders</h2>
          <Link
            href="/admin/orders"
            className="text-sm font-medium text-neutral-600 hover:text-black inline-flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-sm text-neutral-500">Loading orders…</div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-sm text-neutral-500">
            No orders yet. Try storefront checkout or{" "}
            <Link href="/admin/pos" className="underline">
              POS
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-neutral-500 uppercase bg-neutral-50/80 border-b">
                <tr>
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((o) => {
                  const addr = normalizeAddress(o.address_snapshot);
                  return (
                    <tr
                      key={o.id}
                      className="hover:bg-neutral-50/80 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {o.order_number}
                        </Link>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {format(new Date(o.created_at), "dd MMM, hh:mm a")}
                          {!o.user_id && (
                            <span className="ml-2 text-sky-600">Walk-in</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-medium">
                        {addr.full_name}
                      </td>
                      <td className="px-5 py-3 capitalize text-neutral-600">
                        {o.status.replace(/_/g, " ")}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">
                        ₹{Number(o.grand_total).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
