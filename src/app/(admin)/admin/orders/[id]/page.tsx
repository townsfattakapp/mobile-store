"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Printer, Truck, CheckCircle, Package } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { use } from "react";
import { normalizeAddress } from "@/lib/invoice/types";
import { normalizePhoneKey } from "@/lib/customers/phone";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  const fetchOrder = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items(*)
      `)
      .eq("id", id)
      .single();
      
    if (error) {
      console.error("Error fetching order:", error);
    } else {
      setOrder(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", order.id);
      
    if (!error) {
      fetchOrder();
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading order details...</div>;
  }

  if (!order) {
    return <div className="p-8 text-center text-red-500">Order not found.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()} className="rounded-full p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Order {order.order_number}</h1>
            <p className="text-gray-500 text-sm mt-1">Placed on {format(new Date(order.created_at), "dd MMM yyyy, hh:mm a")}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link href={`/admin/invoices/new?orderId=${order.id}`}>
            <Button variant="outline" className="gap-2 flex-1 sm:flex-none">
              <Printer className="w-4 h-4" />
              Generate Invoice
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Items & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50/50">
              <h3 className="font-semibold">Items Ordered</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase border-b bg-white">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Product</th>
                    <th className="px-6 py-3 font-semibold text-center">Qty</th>
                    <th className="px-6 py-3 font-semibold text-right">Price</th>
                    <th className="px-6 py-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {order.order_items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-gray-500 text-xs mt-1">{item.variant_name}</div>
                        <div className="text-gray-400 text-xs mt-1">SKU: {item.sku}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium">{item.quantity}</td>
                      <td className="px-6 py-4 text-right">₹{item.unit_price.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-right font-semibold">₹{item.total_price.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-gray-50/50 border-t flex flex-col items-end gap-2 text-sm">
              <div className="flex justify-between w-64">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">₹{order.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between w-64">
                <span className="text-gray-500">Shipping</span>
                <span className="font-medium text-green-600">
                  {(order.shipping_charge || 0) > 0
                    ? `₹${Number(order.shipping_charge).toLocaleString("en-IN")}`
                    : "Free"}
                </span>
              </div>
              <div className="flex justify-between w-64 pt-2 border-t mt-2 text-lg">
                <span className="font-bold text-gray-900">Grand Total</span>
                <span className="font-bold text-black">₹{order.grand_total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Admin Actions */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold mb-4">Update Order Status</h3>
            <div className="flex flex-wrap gap-3">
              <Button 
                variant={order.status === 'confirmed' ? 'primary' : 'outline'} 
                onClick={() => updateStatus('confirmed')}
                className="gap-2"
              >
                <Package className="w-4 h-4" /> Confirmed
              </Button>
              <Button 
                variant={order.status === 'shipped' ? 'primary' : 'outline'} 
                onClick={() => updateStatus('shipped')}
                className="gap-2"
              >
                <Truck className="w-4 h-4" /> Shipped
              </Button>
              <Button 
                variant={order.status === 'delivered' ? 'primary' : 'outline'} 
                onClick={() => updateStatus('delivered')}
                className="gap-2 bg-green-500 hover:bg-green-600 border-none text-white"
              >
                <CheckCircle className="w-4 h-4" /> Delivered
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold mb-4 border-b pb-2">Customer & Shipping</h3>
            {(() => {
              const addr = normalizeAddress(order.address_snapshot);
              return (
            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-gray-500 text-xs uppercase font-medium mb-1">Name</span>
                <span className="font-medium text-gray-900">{addr.full_name}</span>
                {order.user_id ? (
                  <div className="mt-2">
                    <Link
                      href={`/admin/customers/${order.user_id}`}
                      className="text-xs font-medium underline underline-offset-2 text-gray-700"
                    >
                      Open customer CRM
                    </Link>
                  </div>
                ) : normalizePhoneKey(addr.mobile_number) ? (
                  <div className="mt-2">
                    <Link
                      href={`/admin/customers/walk-in/${normalizePhoneKey(addr.mobile_number)}`}
                      className="text-xs font-medium underline underline-offset-2 text-gray-700"
                    >
                      Open walk-in CRM
                    </Link>
                  </div>
                ) : null}
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase font-medium mb-1">Contact</span>
                <span className="font-medium text-gray-900">{addr.mobile_number || "—"}</span>
              </div>
              <div>
                <span className="block text-gray-500 text-xs uppercase font-medium mb-1">Shipping Address</span>
                <span className="text-gray-900 leading-relaxed block">
                  {addr.address_line}<br/>
                  {addr.city}, {addr.state}<br/>
                  {addr.pin_code}
                </span>
              </div>
            </div>
              );
            })()}
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold mb-4 border-b pb-2">Payment Details</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Method</span>
                <span className="font-medium capitalize">{order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold capitalize ${order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {order.payment_status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
