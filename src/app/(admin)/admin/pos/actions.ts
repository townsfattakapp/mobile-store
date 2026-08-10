"use server";

import { createClient } from "@/utils/supabase/server";
import { generateInvoice } from "../invoices/actions";
import {
  enrichCartLinesForPromo,
  recordPromoRedemption,
  resolvePromoForCheckout,
} from "@/lib/promo/server";

export async function searchPosProducts(query: string) {
  const supabase = await createClient();

  if (!query || query.trim().length < 2) return { products: [] };

  const q = query.trim();

  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, sku, mrp, selling_price, stock_quantity,
      variants:product_variants(id, name, sku, mrp, selling_price, stock_quantity, attributes, status)
    `)
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
    .eq("status", "active")
    .limit(20);

  if (error) {
    console.error("Error searching POS products:", error);
    return { error: error.message };
  }

  const results: any[] = [];

  for (const p of data || []) {
    if (p.variants && p.variants.length > 0) {
      for (const v of p.variants) {
        if (v.status === false) continue;
        if (v.stock_quantity > 0) {
          const color = v.attributes?.color || "";
          const storage = v.attributes?.storage || "";
          const ram = v.attributes?.ram || "";
          const variantDesc = [ram, storage, color].filter(Boolean).join(" ");

          results.push({
            product_id: p.id,
            variant_id: v.id,
            name: `${p.name} ${variantDesc ? `(${variantDesc})` : ""}`.replace(/  +/g, " ").trim(),
            sku: v.sku || p.sku,
            price: Number(v.selling_price) || Number(p.selling_price) || 0,
            stock: Number(v.stock_quantity) || 0,
          });
        }
      }
    } else if (p.stock_quantity > 0) {
      results.push({
        product_id: p.id,
        variant_id: null,
        name: p.name,
        sku: p.sku,
        price: Number(p.selling_price) || 0,
        stock: Number(p.stock_quantity) || 0,
      });
    }
  }

  return { products: results };
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function createWalkinOrderAndInvoice(data: {
  cart: {
    product_id: string;
    variant_id: string | null;
    name: string;
    sku: string;
    quantity: number;
    list_price: number;
    line_discount: number;
    line_total: number;
  }[];
  customerName: string;
  customerPhone: string;
  paymentMethod: "cod" | "store_pickup" | "online";
  bill_discount?: number;
  discount_note?: string;
  /** When set, server re-validates and sets bill discount to promo amount (no stack with manual bill %). */
  promo_code?: string;
}) {
  const supabase = await createClient();

  if (!data.cart?.length) return { error: "Cart is empty" };

  let subtotal = 0;
  let lineDiscountTotal = 0;
  let afterLines = 0;

  for (const item of data.cart) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const list = Math.max(0, Number(item.list_price) || 0);
    const disc = Math.min(list * qty, Math.max(0, Number(item.line_discount) || 0));
    const net = Math.max(0, Number(item.line_total) ?? list * qty - disc);

    // Prefer recomputed values for integrity
    const safeNet = round2(list * qty - disc);
    const useNet = Math.abs(safeNet - net) < 1 ? safeNet : round2(net);

    subtotal += round2(list * qty);
    lineDiscountTotal += round2(disc);
    afterLines += useNet;

    item.quantity = qty;
    item.list_price = list;
    item.line_discount = round2(disc);
    item.line_total = useNet;
  }

  subtotal = round2(subtotal);
  lineDiscountTotal = round2(lineDiscountTotal);
  afterLines = round2(afterLines);

  let billDiscount = round2(
    Math.min(afterLines, Math.max(0, Number(data.bill_discount) || 0))
  );
  let promoId: string | null = null;
  let promoCodeApplied: string | null = null;

  const promoRaw = String(data.promo_code || "").trim();
    if (promoRaw) {
      const enriched = await enrichCartLinesForPromo(
        data.cart.map((item) => ({
          productId: item.product_id,
          variantId: item.variant_id,
          name: item.name,
          quantity: item.quantity,
          price: round2(item.line_total / Math.max(1, item.quantity)),
        }))
      );
      const promoRes = await resolvePromoForCheckout({
        code: promoRaw,
        lines: enriched,
        customer: {
          userId: null,
          phone: data.customerPhone || null,
          email: null,
        },
      });
      if (!promoRes.ok) {
        return { error: promoRes.error };
      }
      if (!("skipped" in promoRes)) {
        billDiscount = promoRes.discountAmount;
        promoId = promoRes.promo.id;
        promoCodeApplied = promoRes.promo.code;
      }
    }

  const grandTotal = round2(Math.max(0, afterLines - billDiscount));

  const { data: settings } = await supabase.from("store_settings").select("state").single();
  const storeState = settings?.state || "Maharashtra";

  const orderNumber = `POS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const addressSnapshot = {
    full_name: data.customerName || "Walk-in Customer",
    mobile_number: data.customerPhone || "N/A",
    address_line: "Store Walk-in",
    city: "Local",
    state: storeState,
    pin_code: "000000",
    type: "walkin",
  };

  const discountParts = [
    lineDiscountTotal > 0 ? `Item discounts ₹${lineDiscountTotal}` : "",
    promoCodeApplied
      ? `Promo ${promoCodeApplied} ₹${billDiscount}`
      : billDiscount > 0
        ? `Bill discount ₹${billDiscount}`
        : "",
    data.discount_note ? `Reason: ${data.discount_note}` : "",
  ].filter(Boolean);

  const notes = ["Walk-in POS Sale", ...discountParts].join(" · ");

  const orderPayload: Record<string, unknown> = {
    order_number: orderNumber,
    address_snapshot: addressSnapshot,
    subtotal,
    discount: billDiscount,
    tax_total: 0,
    shipping_charge: 0,
    grand_total: grandTotal,
    payment_method: data.paymentMethod,
    payment_status: "paid",
    status: "delivered",
    notes,
  };
  if (promoId) orderPayload.promo_code_id = promoId;

  let { data: order, error: orderError } = await supabase
    .from("orders")
    .insert([orderPayload])
    .select()
    .single();

  if (orderError && /promo_code_id|column|schema cache/i.test(orderError.message) && promoId) {
    delete orderPayload.promo_code_id;
    ({ data: order, error: orderError } = await supabase
      .from("orders")
      .insert([orderPayload])
      .select()
      .single());
  }

  if (orderError || !order) {
    return { error: "Order creation failed: " + (orderError?.message || "unknown") };
  }

  if (promoId && promoCodeApplied && billDiscount > 0) {
    await recordPromoRedemption({
      promoId,
      orderId: order.id,
      userId: null,
      phone: data.customerPhone || null,
      email: null,
      code: promoCodeApplied,
      discountAmount: billDiscount,
    });
  }

  // Batch product tax + stock reads (was ~4 DB round-trips per cart line)
  const productIds = [...new Set(data.cart.map((i) => i.product_id).filter(Boolean))];
  const variantIds = [
    ...new Set(
      data.cart.map((i) => i.variant_id).filter((id): id is string => Boolean(id))
    ),
  ];

  const [productsRes, variantsRes] = await Promise.all([
    productIds.length
      ? supabase
          .from("products")
          .select("id, tax_rate, stock_quantity")
          .in("id", productIds)
      : Promise.resolve({ data: [] as { id: string; tax_rate: number | null; stock_quantity: number }[] }),
    variantIds.length
      ? supabase
          .from("product_variants")
          .select("id, stock_quantity")
          .in("id", variantIds)
      : Promise.resolve({ data: [] as { id: string; stock_quantity: number }[] }),
  ]);

  const taxByProduct = new Map<string, number>();
  const stockByProduct = new Map<string, number>();
  for (const p of productsRes.data || []) {
    taxByProduct.set(p.id, p.tax_rate != null ? Number(p.tax_rate) : 18);
    stockByProduct.set(p.id, Number(p.stock_quantity) || 0);
  }
  const stockByVariant = new Map<string, number>();
  for (const v of variantsRes.data || []) {
    stockByVariant.set(v.id, Number(v.stock_quantity) || 0);
  }

  const orderItemRows = data.cart.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    variant_id: item.variant_id,
    product_name: item.name,
    sku: item.sku,
    quantity: item.quantity,
    unit_price: item.list_price,
    discount: item.line_discount,
    tax_rate: taxByProduct.get(item.product_id) ?? 18,
    total_price: item.line_total,
  }));

  const { error: itemsErr } = await supabase.from("order_items").insert(orderItemRows);
  if (itemsErr) {
    return { error: "Failed to save order items: " + itemsErr.message, orderId: order.id };
  }

  // Stock updates don't block invoice numbering — run alongside invoice gen
  const stockPromise = Promise.all(
    data.cart.map(async (item) => {
      if (item.variant_id) {
        const current = stockByVariant.get(item.variant_id);
        if (current == null) return;
        const next = Math.max(0, current - item.quantity);
        stockByVariant.set(item.variant_id, next);
        await supabase
          .from("product_variants")
          .update({ stock_quantity: next })
          .eq("id", item.variant_id);
      } else {
        const current = stockByProduct.get(item.product_id);
        if (current == null) return;
        const next = Math.max(0, current - item.quantity);
        stockByProduct.set(item.product_id, next);
        await supabase
          .from("products")
          .update({ stock_quantity: next })
          .eq("id", item.product_id);
      }
    })
  );

  const [invRes] = await Promise.all([
    generateInvoice({
      orderId: order.id,
      mode: "auto",
      notes: notes,
    }),
    stockPromise,
  ]);

  if (invRes.error) {
    return {
      error: "Order placed, but invoice generation failed: " + invRes.error,
      orderId: order.id,
      invoiceId: invRes.invoiceId,
    };
  }

  return { invoiceId: invRes.invoiceId, orderId: order.id };
}
