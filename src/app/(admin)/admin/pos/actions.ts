"use server";

import { createClient } from "@/utils/supabase/server";
import { generateInvoice } from "../invoices/actions";

export async function searchPosProducts(query: string) {
  const supabase = await createClient();

  if (!query || query.trim().length < 2) return { products: [] };

  const q = query.trim();

  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, sku, mrp, selling_price, stock_quantity,
      variants:product_variants(id, name, sku, mrp, selling_price, stock_quantity, attributes)
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

  const billDiscount = round2(
    Math.min(afterLines, Math.max(0, Number(data.bill_discount) || 0))
  );
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
    billDiscount > 0 ? `Bill discount ₹${billDiscount}` : "",
    data.discount_note ? `Reason: ${data.discount_note}` : "",
  ].filter(Boolean);

  const notes = ["Walk-in POS Sale", ...discountParts].join(" · ");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert([
      {
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
      },
    ])
    .select()
    .single();

  if (orderError) return { error: "Order creation failed: " + orderError.message };

  for (const item of data.cart) {
    let taxRate = 18;
    const { data: prod } = await supabase
      .from("products")
      .select("tax_rate")
      .eq("id", item.product_id)
      .maybeSingle();
    if (prod?.tax_rate != null) taxRate = Number(prod.tax_rate);

    await supabase.from("order_items").insert([
      {
        order_id: order.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.list_price,
        discount: item.line_discount,
        tax_rate: taxRate,
        total_price: item.line_total,
      },
    ]);

    if (item.variant_id) {
      const { data: vdata } = await supabase
        .from("product_variants")
        .select("stock_quantity")
        .eq("id", item.variant_id)
        .single();
      if (vdata) {
        await supabase
          .from("product_variants")
          .update({ stock_quantity: vdata.stock_quantity - item.quantity })
          .eq("id", item.variant_id);
      }
    } else {
      const { data: pdata } = await supabase
        .from("products")
        .select("stock_quantity")
        .eq("id", item.product_id)
        .single();
      if (pdata) {
        await supabase
          .from("products")
          .update({ stock_quantity: pdata.stock_quantity - item.quantity })
          .eq("id", item.product_id);
      }
    }
  }

  const invRes = await generateInvoice({
    orderId: order.id,
    mode: "auto",
    notes: notes,
  });

  if (invRes.error) {
    return {
      error: "Order placed, but invoice generation failed: " + invRes.error,
      orderId: order.id,
    };
  }

  return { invoiceId: invRes.invoiceId, orderId: order.id };
}
