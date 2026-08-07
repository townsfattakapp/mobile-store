"use client";

import React, { useEffect, useState } from "react";
import { useCartStore } from "@/store/useCartStore";
import { useRouter } from "next/navigation";
import { placeOrder } from "./actions";
import { Lock, CreditCard, Banknote, ShieldCheck } from "lucide-react";
import Link from "next/link";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const { items, getSubtotal, clearCart } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("online");
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-gray-50 px-4">
        <h1 className="text-3xl font-black mb-4 text-center">Your Cart is Empty</h1>
        <p className="text-[#6e6e73] mb-8 text-center max-w-md">
          Looks like you haven&apos;t added anything to your cart yet.
        </p>
        <Link
          href="/new-mobiles"
          className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:bg-gray-900 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  const subtotal = getSubtotal();
  const shipping = subtotal > 50000 ? 0 : 500;
  const grandTotal = subtotal + shipping;

  const finishSuccess = (orderNumber: string) => {
    clearCart();
    router.push(`/checkout/success?order_number=${orderNumber}`);
  };

  const payOnline = async (dbOrderId: string, orderNumber: string) => {
    const createRes = await fetch("/api/payments/razorpay/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: dbOrderId }),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      throw new Error(created.error || "Could not start payment");
    }

    // Demo mode (no Razorpay keys): verify immediately with signed demo payment
    if (created.mode === "demo") {
      const verifyRes = await fetch("/api/payments/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dbOrderId,
          razorpayOrderId: created.razorpayOrderId,
          demo: true,
        }),
      });
      const verified = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verified.error || "Demo payment failed");
      finishSuccess(verified.orderNumber || orderNumber);
      return;
    }

    const ok = await loadRazorpayScript();
    if (!ok || !window.Razorpay) {
      throw new Error("Failed to load Razorpay checkout");
    }

    await new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay!({
        key: created.keyId,
        amount: created.amount,
        currency: created.currency || "INR",
        name: "MobiStore",
        description: `Order ${orderNumber}`,
        order_id: created.razorpayOrderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dbOrderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const verified = await verifyRes.json();
            if (!verifyRes.ok) {
              reject(new Error(verified.error || "Payment verification failed"));
              return;
            }
            finishSuccess(verified.orderNumber || orderNumber);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        modal: {
          ondismiss: () =>
            reject(new Error("Payment cancelled. You can retry from support.")),
        },
        theme: { color: "#111111" },
      });
      rzp.open();
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("paymentMethod", paymentMethod);

    try {
      const result = await placeOrder(formData, items, subtotal);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (result.success && result.orderNumber) {
        if (paymentMethod === "online" && result.orderId) {
          await payOnline(result.orderId, result.orderNumber);
        } else {
          finishSuccess(result.orderNumber);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <div className="flex items-center gap-2 mb-8 text-sm font-medium text-gray-500">
          <Lock size={16} className="text-green-600" />
          <span className="text-green-700">Secure Checkout</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col-reverse lg:flex-row gap-8 lg:gap-12 items-start"
        >
          <div className="w-full lg:w-2/3 space-y-8">
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border">
              <h2 className="text-2xl font-bold mb-6">Delivery Details</h2>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm font-medium border border-red-100">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-semibold text-[#1d1d1f] mb-2">
                    Full Name
                  </label>
                  <input
                    required
                    name="fullName"
                    type="text"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-[#1d1d1f] placeholder:text-[#6e6e73] focus:ring-2 focus:ring-black outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1d1d1f] mb-2">
                    Email Address
                  </label>
                  <input
                    required
                    name="email"
                    type="email"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-[#1d1d1f] placeholder:text-[#6e6e73] focus:ring-2 focus:ring-black outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1d1d1f] mb-2">
                    Phone Number
                  </label>
                  <input
                    required
                    name="phone"
                    type="tel"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-[#1d1d1f] placeholder:text-[#6e6e73] focus:ring-2 focus:ring-black outline-none transition-all"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-semibold text-[#1d1d1f] mb-2">
                    Full Address
                  </label>
                  <textarea
                    required
                    name="address"
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-[#1d1d1f] placeholder:text-[#6e6e73] focus:ring-2 focus:ring-black outline-none transition-all resize-none"
                    placeholder="123 Main Street, Appt 4B"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1d1d1f] mb-2">
                    City
                  </label>
                  <input
                    required
                    name="city"
                    type="text"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-[#1d1d1f] placeholder:text-[#6e6e73] focus:ring-2 focus:ring-black outline-none transition-all"
                    placeholder="Mumbai"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#1d1d1f] mb-2">
                      State
                    </label>
                    <input
                      required
                      name="state"
                      type="text"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-[#1d1d1f] placeholder:text-[#6e6e73] focus:ring-2 focus:ring-black outline-none transition-all"
                      placeholder="MH"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1d1d1f] mb-2">
                      PIN Code
                    </label>
                    <input
                      required
                      name="pinCode"
                      type="text"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-[#1d1d1f] placeholder:text-[#6e6e73] focus:ring-2 focus:ring-black outline-none transition-all"
                      placeholder="400001"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border">
              <h2 className="text-2xl font-bold mb-2">Payment Method</h2>
              <p className="text-sm text-[#6e6e73] mb-6">
                Online payments use Razorpay (UPI / cards / netbanking). Without
                API keys, demo mode completes a signed test payment locally.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label
                  className={`relative flex flex-col p-5 border-2 cursor-pointer rounded-2xl transition-colors ${
                    paymentMethod === "online"
                      ? "border-black bg-black/5"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethodRadio"
                    className="absolute opacity-0"
                    checked={paymentMethod === "online"}
                    onChange={() => setPaymentMethod("online")}
                  />
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-black">Pay Online</span>
                    <CreditCard className="text-gray-400" />
                  </div>
                  <span className="text-sm text-[#6e6e73]">
                    Razorpay — UPI, Cards, Netbanking
                  </span>
                </label>

                <label
                  className={`relative flex flex-col p-5 border-2 cursor-pointer rounded-2xl transition-colors ${
                    paymentMethod === "cod"
                      ? "border-black bg-black/5"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethodRadio"
                    className="absolute opacity-0"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                  />
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-black">Cash on Delivery</span>
                    <Banknote className="text-gray-400" />
                  </div>
                  <span className="text-sm text-[#6e6e73]">
                    Pay when your order arrives
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/3 bg-white p-6 md:p-8 rounded-3xl shadow-sm border sticky top-24">
            <h2 className="text-xl font-bold mb-6 flex items-center justify-between">
              Order Summary
              <span className="bg-gray-100 text-gray-600 text-sm py-1 px-3 rounded-full">
                {items.length} Items
              </span>
            </h2>

            <div className="space-y-4 mb-6 max-h-64 overflow-y-auto pr-2">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantId}`}
                  className="flex gap-4"
                >
                  <div className="w-16 h-20 bg-gray-50 rounded-lg flex items-center justify-center p-2 border shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.name}
                      className="object-contain max-h-full mix-blend-multiply"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                    <p className="text-xs text-[#6e6e73] mb-1 truncate">
                      {item.variantName}
                    </p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs font-medium text-gray-600">
                        Qty: {item.quantity}
                      </span>
                      <span className="font-bold text-sm">
                        ₹{(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium text-black">
                  ₹{subtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className="font-medium text-black">
                  {shipping === 0 ? "Free" : `₹${shipping.toLocaleString()}`}
                </span>
              </div>
              <div className="border-t pt-4 flex justify-between items-end mt-2">
                <span className="font-bold text-lg">Total</span>
                <div className="text-right">
                  <span className="font-black text-2xl">
                    ₹{grandTotal.toLocaleString()}
                  </span>
                  <p className="text-xs text-[#6e6e73] mt-1">
                    Inclusive of all taxes
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-900 transition-colors shadow-lg shadow-black/10 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={20} />
                  {paymentMethod === "online"
                    ? "Pay Securely"
                    : "Place Order Securely"}
                </>
              )}
            </button>
            <p className="text-center text-xs text-[#6e6e73] mt-4">
              By placing your order, you agree to our Terms of Service and Privacy
              Policy.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
