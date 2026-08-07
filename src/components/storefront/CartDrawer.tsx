"use client";

import React, { useEffect, useState } from "react";
import { useCartStore } from "@/store/useCartStore";
import { X, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function scrollWindowToTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function CartDrawer() {
  const { items, isCartOpen, closeCart, updateQuantity, removeItem, getSubtotal } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isCartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isCartOpen, mounted]);

  if (!mounted) return null;

  const subtotal = getSubtotal();

  const goCheckout = (e: React.MouseEvent) => {
    e.preventDefault();
    closeCart();
    scrollWindowToTop();
    router.push("/checkout");
    requestAnimationFrame(() => scrollWindowToTop());
    setTimeout(scrollWindowToTop, 50);
  };

  return (
    <>
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 transition-opacity"
          onClick={closeCart}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag size={20} />
            Your Cart
          </h2>
          <button onClick={closeCart} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#6e6e73] space-y-4">
              <ShoppingBag size={48} className="opacity-40" />
              <p className="text-[#1d1d1f]">Your cart is empty.</p>
              <button onClick={closeCart} className="text-black font-medium underline">
                Continue Shopping
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="flex gap-4 border-b pb-6">
                <div className="w-20 h-24 bg-gray-50 rounded-lg flex items-center justify-center p-2 shrink-0 border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.name}
                    className="object-contain max-h-full mix-blend-multiply"
                  />
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-sm leading-tight text-gray-900">{item.name}</h3>
                    <button
                      onClick={() => removeItem(item.productId, item.variantId)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-[#6e6e73] mb-2">{item.variantName}</p>

                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center border rounded-lg overflow-hidden">
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.variantId, item.quantity - 1)
                        }
                        className="px-2 py-1 hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-50"
                        disabled={item.quantity <= 1}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="px-4 py-1 text-sm font-medium text-center min-w-[2rem] border-x">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.variantId, item.quantity + 1)
                        }
                        className="px-2 py-1 hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-50"
                        disabled={item.quantity >= item.stock_quantity}
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="font-bold text-gray-900">
                      ₹{(item.price * item.quantity).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 border-t bg-gray-50">
            <div className="flex justify-between items-center mb-4 text-lg">
              <span className="font-medium text-[#424245]">Subtotal</span>
              <span className="font-black text-black">₹{subtotal.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#6e6e73] mb-6 text-center">
              Shipping and taxes calculated at checkout.
            </p>

            <Link href="/checkout" onClick={goCheckout}>
              <button
                type="button"
                className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-900 transition-colors shadow-lg shadow-black/10"
              >
                Proceed to Checkout
              </button>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
