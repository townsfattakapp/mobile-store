"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash,
  CreditCard,
  Store,
  Percent,
  IndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { searchPosProducts, createWalkinOrderAndInvoice } from "./actions";

type DiscountMode = "none" | "percent" | "flat";

type CartItem = {
  product_id: string;
  variant_id: string | null;
  name: string;
  sku: string;
  /** Original unit selling price */
  list_price: number;
  quantity: number;
  stock: number;
  discount_mode: DiscountMode;
  discount_value: number;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function lineDiscount(item: CartItem) {
  const gross = item.list_price * item.quantity;
  if (item.discount_mode === "percent") {
    const pct = Math.min(100, Math.max(0, item.discount_value || 0));
    return round2((gross * pct) / 100);
  }
  if (item.discount_mode === "flat") {
    return round2(Math.min(gross, Math.max(0, item.discount_value || 0)));
  }
  return 0;
}

function lineNet(item: CartItem) {
  return round2(item.list_price * item.quantity - lineDiscount(item));
}

export default function POSPage() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "store_pickup" | "online">(
    "store_pickup"
  );
  const [billDiscountMode, setBillDiscountMode] = useState<DiscountMode>("none");
  const [billDiscountValue, setBillDiscountValue] = useState(0);
  const [discountNote, setDiscountNote] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        const res = await searchPosProducts(searchQuery);
        setSearchResults(res.products || []);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const totals = useMemo(() => {
    const subtotal = round2(cart.reduce((s, i) => s + i.list_price * i.quantity, 0));
    const lineDiscounts = round2(cart.reduce((s, i) => s + lineDiscount(i), 0));
    const afterLines = round2(cart.reduce((s, i) => s + lineNet(i), 0));

    let billDiscount = 0;
    if (billDiscountMode === "percent") {
      const pct = Math.min(100, Math.max(0, billDiscountValue || 0));
      billDiscount = round2((afterLines * pct) / 100);
    } else if (billDiscountMode === "flat") {
      billDiscount = round2(Math.min(afterLines, Math.max(0, billDiscountValue || 0)));
    }

    const grandTotal = round2(Math.max(0, afterLines - billDiscount));
    return { subtotal, lineDiscounts, afterLines, billDiscount, grandTotal };
  }, [cart, billDiscountMode, billDiscountValue]);

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find(
        (item) =>
          item.variant_id === product.variant_id && item.product_id === product.product_id
      );
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Only ${product.stock} in stock!`);
          return prev;
        }
        return prev.map((item) =>
          item.variant_id === product.variant_id && item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      const listPrice = Number(product.price) || Number(product.list_price) || 0;
      return [
        ...prev,
        {
          product_id: product.product_id,
          variant_id: product.variant_id,
          name: product.name,
          sku: product.sku,
          list_price: listPrice,
          quantity: 1,
          stock: product.stock,
          discount_mode: "none" as const,
          discount_value: 0,
        },
      ];
    });
    setSearchQuery("");
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const newCart = [...prev];
      const item = newCart[index];
      const newQ = item.quantity + delta;

      if (newQ > item.stock) {
        alert(`Only ${item.stock} in stock!`);
        return prev;
      }
      if (newQ <= 0) {
        newCart.splice(index, 1);
      } else {
        item.quantity = newQ;
      }
      return newCart;
    });
  };

  const updateLineDiscount = (
    index: number,
    patch: Partial<Pick<CartItem, "discount_mode" | "discount_value">>
  ) => {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (next.discount_mode === "none") next.discount_value = 0;
        return next;
      })
    );
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return alert("Cart is empty");

    setIsProcessing(true);
    const res = await createWalkinOrderAndInvoice({
      cart: cart.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        list_price: item.list_price,
        line_discount: lineDiscount(item),
        line_total: lineNet(item),
      })),
      customerName,
      customerPhone,
      paymentMethod,
      bill_discount: totals.billDiscount,
      discount_note: discountNote.trim(),
    });

    if (res.error) {
      alert(res.error);
      setIsProcessing(false);
    } else if (res.invoiceId) {
      router.push(`/admin/invoices/${res.invoiceId}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Walk-in POS Billing</h1>
        <p className="text-[#6e6e73] text-sm mt-1">
          Instant invoice for walk-in customers — including item or bill discounts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm relative">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Search size={20} /> Add Products
            </h2>
            <Input
              placeholder="Search by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-lg h-12"
            />

            {(searchResults.length > 0 || isSearching) && (
              <div className="absolute left-6 right-6 mt-2 bg-white border shadow-xl rounded-xl z-20 max-h-80 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-center text-gray-500">Searching...</div>
                ) : (
                  searchResults.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => addToCart(p)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium text-[#1d1d1f]">{p.name}</div>
                        <div className="text-xs text-gray-500">
                          SKU: {p.sku} · Stock: {p.stock}
                        </div>
                      </div>
                      <div className="font-semibold text-[#1d1d1f]">
                        ₹{Number(p.price).toLocaleString("en-IN")}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Customer Details (Optional)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Customer Name"
                placeholder="e.g. Rahul Sharma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <Input
                label="Phone Number"
                placeholder="e.g. 9876543210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm h-fit sticky top-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart size={20} /> Current Bill
          </h2>

          <div className="min-h-48 space-y-4 mb-6">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <ShoppingCart size={40} className="mb-2 opacity-50" />
                <p>No items in bill yet</p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const disc = lineDiscount(item);
                const net = lineNet(item);
                return (
                  <div key={idx} className="flex flex-col gap-2 p-3 bg-gray-50 border rounded-lg">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-sm leading-tight text-[#1d1d1f]">
                        {item.name}
                      </span>
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-red-500 hover:bg-red-50 p-1 rounded shrink-0"
                      >
                        <Trash size={14} />
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        ₹{item.list_price.toLocaleString("en-IN")} each
                      </span>
                      <div className="flex items-center gap-3 bg-white border rounded px-2 py-1">
                        <button
                          onClick={() => updateQuantity(idx, -1)}
                          className="hover:text-black text-gray-500"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(idx, 1)}
                          className="hover:text-black text-gray-500"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Line discount */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Item discount
                      </span>
                      <div className="flex rounded-md border overflow-hidden text-xs">
                        {(["none", "percent", "flat"] as DiscountMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              updateLineDiscount(idx, {
                                discount_mode: mode,
                                discount_value: mode === "none" ? 0 : item.discount_value,
                              })
                            }
                            className={`px-2 py-1 ${
                              item.discount_mode === mode
                                ? "bg-[#1d1d1f] text-white"
                                : "bg-white text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {mode === "none" ? "None" : mode === "percent" ? "%" : "₹"}
                          </button>
                        ))}
                      </div>
                      {item.discount_mode !== "none" && (
                        <div className="relative w-24">
                          <input
                            type="number"
                            min={0}
                            max={item.discount_mode === "percent" ? 100 : undefined}
                            step={item.discount_mode === "percent" ? 1 : 1}
                            value={item.discount_value || ""}
                            onChange={(e) =>
                              updateLineDiscount(idx, {
                                discount_value: Number(e.target.value) || 0,
                              })
                            }
                            className="w-full h-8 pl-6 pr-2 text-sm border rounded-md bg-white"
                            placeholder="0"
                          />
                          <span className="absolute left-2 top-1.5 text-gray-400">
                            {item.discount_mode === "percent" ? (
                              <Percent size={12} />
                            ) : (
                              <IndianRupee size={12} />
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-500">
                        {disc > 0 ? (
                          <>
                            Save ₹{disc.toLocaleString("en-IN")}
                          </>
                        ) : (
                          "Line total"
                        )}
                      </span>
                      <span>₹{net.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal (MRP/list)</span>
              <span>₹{totals.subtotal.toLocaleString("en-IN")}</span>
            </div>
            {totals.lineDiscounts > 0 && (
              <div className="flex justify-between text-sm text-emerald-700">
                <span>Item discounts</span>
                <span>− ₹{totals.lineDiscounts.toLocaleString("en-IN")}</span>
              </div>
            )}

            {/* Bill discount */}
            <div className="rounded-lg border bg-gray-50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Bill discount
                </span>
                <div className="flex rounded-md border overflow-hidden text-xs bg-white">
                  {(["none", "percent", "flat"] as DiscountMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setBillDiscountMode(mode);
                        if (mode === "none") setBillDiscountValue(0);
                      }}
                      className={`px-2.5 py-1 ${
                        billDiscountMode === mode
                          ? "bg-[#1d1d1f] text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {mode === "none" ? "None" : mode === "percent" ? "%" : "₹"}
                    </button>
                  ))}
                </div>
              </div>
              {billDiscountMode !== "none" && (
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={billDiscountMode === "percent" ? 100 : undefined}
                    value={billDiscountValue || ""}
                    onChange={(e) => setBillDiscountValue(Number(e.target.value) || 0)}
                    className="w-full h-9 pl-7 pr-3 text-sm border rounded-md bg-white"
                    placeholder={billDiscountMode === "percent" ? "e.g. 5" : "e.g. 500"}
                  />
                  <span className="absolute left-2.5 top-2.5 text-gray-400">
                    {billDiscountMode === "percent" ? (
                      <Percent size={14} />
                    ) : (
                      <IndianRupee size={14} />
                    )}
                  </span>
                </div>
              )}
              {totals.billDiscount > 0 && (
                <div className="flex justify-between text-sm text-emerald-700 font-medium">
                  <span>Bill savings</span>
                  <span>− ₹{totals.billDiscount.toLocaleString("en-IN")}</span>
                </div>
              )}
              {(totals.lineDiscounts > 0 || totals.billDiscount > 0) && (
                <Input
                  placeholder="Discount reason (optional)"
                  value={discountNote}
                  onChange={(e) => setDiscountNote(e.target.value)}
                />
              )}
            </div>

            <div className="flex justify-between items-center text-lg font-bold pt-1">
              <span>Grand Total</span>
              <span>₹{totals.grandTotal.toLocaleString("en-IN")}</span>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium text-gray-700">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod("store_pickup")}
                  className={`py-2 flex flex-col items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-colors ${
                    paymentMethod === "store_pickup"
                      ? "bg-black text-white border-black"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Store size={16} /> Cash
                </button>
                <button
                  onClick={() => setPaymentMethod("online")}
                  className={`py-2 flex flex-col items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-colors ${
                    paymentMethod === "online"
                      ? "bg-black text-white border-black"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <CreditCard size={16} /> Card/UPI
                </button>
              </div>
            </div>

            <Button
              className="w-full mt-4 h-12 text-lg font-semibold"
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing}
            >
              {isProcessing ? "Processing..." : "Generate Invoice"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
