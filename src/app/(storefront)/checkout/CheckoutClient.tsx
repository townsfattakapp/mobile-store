"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useCartStore } from "@/store/useCartStore";
import { useRouter } from "next/navigation";
import { placeOrder } from "./actions";
import { previewPromoForCart } from "@/lib/promo/server";
import { Lock, CreditCard, Banknote, ShieldCheck, Tag } from "lucide-react";
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

export default function CheckoutClient({
  defaults,
}: {
  defaults: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pinCode: string;
  };
}) {
  const { items, getSubtotal, clearCart } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("online");
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<{
    code: string;
    discount: number;
    message: string;
  } | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [phonePreview, setPhonePreview] = useState(defaults.phone);
  const [emailPreview, setEmailPreview] = useState(defaults.email);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Always land at top when opening checkout (soft nav can preserve scroll)
  useEffect(() => {
    if (!mounted) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [mounted]);

  const subtotal = useMemo(() => (mounted ? getSubtotal() : 0), [mounted, items, getSubtotal]);
  const discount = promoApplied?.discount || 0;
  const shipping = subtotal > 50000 ? 0 : 500;
  const grandTotal = Math.max(0, subtotal - discount + shipping);

  const cartKey = useMemo(
    () =>
      items
        .map((i) => `${i.productId}:${i.variantId}:${i.quantity}:${i.price}`)
        .join("|"),
    [items]
  );

  useEffect(() => {
    setPromoApplied((prev) => {
      if (!prev) return prev;
      setPromoInput(prev.code);
      setPromoError(null);
      return null;
    });
  }, [cartKey]);

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="ms-page min-h-[55vh] flex flex-col items-center justify-center px-5 py-16 text-center">
        <h1 className="ms-display ms-display--md mb-3">Your cart is empty</h1>
        <p className="ms-lede ms-lede--narrow mb-8">
          Add a phone or accessory, then come back to checkout.
        </p>
        <Link href="/new-mobiles" className="ms-btn ms-btn--primary">
          Continue shopping
        </Link>
      </div>
    );
  }

  const finishSuccess = (orderNumber: string) => {
    clearCart();
    router.push(`/checkout/success?order_number=${orderNumber}`);
  };

  const applyPromo = async () => {
    setPromoBusy(true);
    setPromoError(null);
    const res = await previewPromoForCart({
      code: promoInput,
      lines: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      phone: phonePreview,
      email: emailPreview,
    });
    setPromoBusy(false);
    if (!res.ok) {
      setPromoApplied(null);
      setPromoError(res.error);
      return;
    }
    setPromoApplied({
      code: res.promo.code,
      discount: res.discountAmount,
      message: res.message,
    });
    setPromoInput(res.promo.code);
  };

  const clearPromo = () => {
    setPromoApplied(null);
    setPromoError(null);
    setPromoInput("");
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
      throw new Error("Failed to load payment checkout");
    }

    await new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay!({
        key: created.keyId,
        amount: created.amount,
        currency: created.currency || "INR",
        name: "Mahadev Mobiles",
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
            reject(new Error("Payment cancelled. You can try again.")),
        },
        theme: { color: "#3b2f7c" },
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
    if (promoApplied?.code) {
      formData.set("promoCode", promoApplied.code);
    }

    try {
      const result = await placeOrder(formData, items, subtotal);

      if (result.error) {
        if ((result as { requireLogin?: boolean }).requireLogin) {
          router.push("/login?next=/checkout");
          return;
        }
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

  const submitLabel =
    paymentMethod === "online" ? "Pay securely" : "Place order";

  return (
    <div className="ms-page ms-checkout">
      <div className="ms-shell ms-checkout-shell">
        <div className="ms-checkout-badge">
          <Lock size={14} aria-hidden />
          <span>Secure checkout</span>
        </div>

        <form onSubmit={handleSubmit} className="ms-checkout-layout" id="checkout-form">
          {/* Order summary — top on mobile, side on desktop */}
          <aside className="ms-checkout-summary" aria-label="Order summary">
            <div className="ms-checkout-card">
              <div className="ms-checkout-summary-head">
                <h2>Order summary</h2>
                <span>
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </div>

              <ul className="ms-checkout-items">
                {items.map((item) => (
                  <li key={`${item.productId}-${item.variantId}`}>
                    <div className="ms-checkout-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image} alt="" />
                    </div>
                    <div className="ms-checkout-item-meta">
                      <p className="ms-checkout-item-name">{item.name}</p>
                      {item.variantName ? (
                        <p className="ms-checkout-item-variant">{item.variantName}</p>
                      ) : null}
                      <div className="ms-checkout-item-row">
                        <span>Qty {item.quantity}</span>
                        <strong>
                          ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                        </strong>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="ms-checkout-totals">
                <div>
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                {discount > 0 ? (
                  <div>
                    <span>Promo ({promoApplied?.code})</span>
                    <span className="text-emerald-700">
                      −₹{discount.toLocaleString("en-IN")}
                    </span>
                  </div>
                ) : null}
                <div>
                  <span>Shipping</span>
                  <span>
                    {shipping === 0 ? "Free" : `₹${shipping.toLocaleString("en-IN")}`}
                  </span>
                </div>
                <div className="ms-checkout-grand">
                  <span>Total</span>
                  <div>
                    <strong>₹{grandTotal.toLocaleString("en-IN")}</strong>
                    <small>Inclusive of taxes</small>
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-black/5 pt-4 space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#1d1d1f]">
                  <Tag size={14} aria-hidden /> Promo code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="SAVE100"
                    disabled={!!promoApplied}
                    className="flex-1 min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono uppercase tracking-wide"
                  />
                  {promoApplied ? (
                    <button
                      type="button"
                      onClick={clearPromo}
                      className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={applyPromo}
                      disabled={promoBusy || !promoInput.trim()}
                      className="shrink-0 rounded-lg bg-[#1d1d1f] text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      {promoBusy ? "…" : "Apply"}
                    </button>
                  )}
                </div>
                {promoError ? (
                  <p className="text-xs text-red-600">{promoError}</p>
                ) : null}
                {promoApplied ? (
                  <p className="text-xs text-emerald-700">{promoApplied.message}</p>
                ) : (
                  <p className="text-[11px] text-[#6e6e73]">
                    Offers with per-customer limits apply to your signed-in account.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="ms-checkout-submit ms-checkout-submit--desktop"
              >
                {loading ? (
                  <span className="ms-checkout-spinner" aria-hidden />
                ) : (
                  <>
                    <ShieldCheck size={18} aria-hidden />
                    {submitLabel}
                  </>
                )}
              </button>
              <p className="ms-checkout-legal ms-checkout-legal--desktop">
                By ordering you agree to our Terms and Privacy Policy.
              </p>
            </div>
          </aside>

          <div className="ms-checkout-main">
            <section className="ms-checkout-card">
              <h2>Delivery details</h2>
              <p className="ms-checkout-hint">
                Signed in as <strong>{defaults.email || "your account"}</strong>
                {" · "}
                <Link href="/account/addresses" className="underline underline-offset-2">
                  Manage addresses
                </Link>
              </p>

              {error ? (
                <div className="ms-checkout-error" role="alert">
                  {error}
                </div>
              ) : null}

              <div className="ms-checkout-fields">
                <label className="ms-checkout-field ms-checkout-field--full">
                  <span>Full name</span>
                  <input
                    required
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Your full name"
                    defaultValue={defaults.fullName}
                  />
                </label>

                <label className="ms-checkout-field">
                  <span>Email</span>
                  <input
                    required
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    defaultValue={defaults.email}
                    onChange={(e) => setEmailPreview(e.target.value)}
                  />
                </label>

                <label className="ms-checkout-field">
                  <span>Phone</span>
                  <input
                    required
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="98765 43210"
                    defaultValue={defaults.phone}
                    onChange={(e) => setPhonePreview(e.target.value)}
                  />
                </label>

                <label className="ms-checkout-field ms-checkout-field--full">
                  <span>Address</span>
                  <textarea
                    required
                    name="address"
                    rows={3}
                    autoComplete="street-address"
                    placeholder="House / street / landmark"
                    defaultValue={defaults.address}
                  />
                </label>

                <label className="ms-checkout-field">
                  <span>City</span>
                  <input
                    required
                    name="city"
                    type="text"
                    autoComplete="address-level2"
                    placeholder="Tiroda"
                    defaultValue={defaults.city}
                  />
                </label>

                <label className="ms-checkout-field">
                  <span>State</span>
                  <input
                    required
                    name="state"
                    type="text"
                    autoComplete="address-level1"
                    placeholder="Maharashtra"
                    defaultValue={defaults.state}
                  />
                </label>

                <label className="ms-checkout-field">
                  <span>PIN code</span>
                  <input
                    required
                    name="pinCode"
                    type="text"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    placeholder="441911"
                    defaultValue={defaults.pinCode}
                  />
                </label>
              </div>
            </section>

            <section className="ms-checkout-card">
              <h2>Payment</h2>
              <p className="ms-checkout-hint">
                Pay online with UPI, card, or netbanking — or choose cash on delivery.
              </p>

              <div className="ms-checkout-pay-grid">
                <label
                  className={`ms-checkout-pay ${
                    paymentMethod === "online" ? "is-active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethodRadio"
                    checked={paymentMethod === "online"}
                    onChange={() => setPaymentMethod("online")}
                  />
                  <span className="ms-checkout-pay-top">
                    <strong>Pay online</strong>
                    <CreditCard size={18} aria-hidden />
                  </span>
                  <span className="ms-checkout-pay-sub">UPI · Cards · Netbanking</span>
                </label>

                <label
                  className={`ms-checkout-pay ${
                    paymentMethod === "cod" ? "is-active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethodRadio"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                  />
                  <span className="ms-checkout-pay-top">
                    <strong>Cash on delivery</strong>
                    <Banknote size={18} aria-hidden />
                  </span>
                  <span className="ms-checkout-pay-sub">Pay when your order arrives</span>
                </label>
              </div>
            </section>
          </div>
        </form>
      </div>

      {/* Mobile sticky pay bar */}
      <div className="ms-checkout-bar">
        <div className="ms-checkout-bar-total">
          <span>Total</span>
          <strong>₹{grandTotal.toLocaleString("en-IN")}</strong>
        </div>
        <button
          type="submit"
          form="checkout-form"
          disabled={loading}
          className="ms-checkout-submit"
        >
          {loading ? (
            <span className="ms-checkout-spinner" aria-hidden />
          ) : (
            <>
              <ShieldCheck size={18} aria-hidden />
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
