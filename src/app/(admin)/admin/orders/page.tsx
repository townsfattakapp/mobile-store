"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/Button";
import { Eye, Search, Filter } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { normalizeAddress } from "@/lib/invoice/types";

type Order = {
  id: string;
  order_number: string;
  address_snapshot: any;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
  order_items: { id: string }[];
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const supabase = createClient();

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items(id)
      `)
      .order("created_at", { ascending: false });
      
    if (error) {
      console.error("Error fetching orders:", error);
    } else {
      setOrders(data as any || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'shipped': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredOrders = orders.filter(o => {
    const addr = normalizeAddress(o.address_snapshot);
    return (
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      addr.full_name.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and track customer orders.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b bg-gray-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by order ID or customer name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" className="gap-2 flex-1 sm:flex-none">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b">
              <tr>
                <th className="px-6 py-4 font-semibold">Order ID</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Payment</th>
                <th className="px-6 py-4 font-semibold text-right">Total</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      Loading orders...
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium">
                      {order.order_number}
                      <div className="text-xs text-gray-400 mt-1">{order.order_items.length} items</div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {format(new Date(order.created_at), "dd MMM yyyy")}
                      <div className="text-xs mt-1">{format(new Date(order.created_at), "hh:mm a")}</div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const addr = normalizeAddress(order.address_snapshot);
                        return (
                          <>
                            <div className="font-medium text-gray-900">{addr.full_name}</div>
                            <div className="text-gray-500 text-xs mt-1">{addr.city}, {addr.state}</div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)} capitalize`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="capitalize font-medium text-gray-900">
                        {order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method}
                      </div>
                      <div className={`text-xs mt-1 font-medium ${order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'} capitalize`}>
                        {order.payment_status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">
                      ₹{order.grand_total.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/orders/${order.id}`}>
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
