"use client";

import React, { Suspense } from "react";
import { CheckCircle, ArrowRight, Package } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order_number");

  return (
    <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl max-w-lg w-full text-center border">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 relative">
        <CheckCircle size={48} className="text-green-600" />
        <div className="absolute inset-0 border-4 border-green-200 rounded-full animate-ping opacity-20"></div>
      </div>

      <h1 className="text-3xl font-black mb-4 text-gray-900">Order Confirmed!</h1>
      <p className="text-gray-500 mb-2">Thank you for your purchase. We have received your order and will begin processing it right away.</p>
      
      {orderNumber && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 my-8 flex items-center justify-center gap-3">
          <Package className="text-gray-400" />
          <span className="text-sm font-medium text-gray-500">Order ID:</span>
          <span className="font-bold text-black tracking-wide">{orderNumber}</span>
        </div>
      )}

      <div className="text-sm text-gray-500 mb-10 text-left bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
        Our team has been notified of your order. You can track status anytime from your account
        dashboard. For questions, use Chat with Seller on the product page or call the store.
      </div>

      <div className="flex flex-col gap-3">
        <Link href="/account" className="w-full border-2 border-black text-black py-4 rounded-xl font-bold hover:bg-gray-50 transition-colors">
          View My Orders
        </Link>
        <Link href="/" className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-black font-medium py-4 transition-colors">
          Continue Shopping <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 px-4 py-12">
      <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading your order details...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
