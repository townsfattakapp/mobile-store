"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { notifyOwnerOfOrder } from "@/lib/notify/notifyOwner";
import { roundMoney } from "@/lib/promo/promo";
import {
  enrichCartLinesForPromo,
  recordPromoRedemption,
  resolvePromoForCheckout,
} from "@/lib/promo/server";

export async function placeOrder(
  formData: any,
  cartItems: any[],
  subtotalFromClient: number
) {
  const supabase = await createClient();

  try {
    if (!cartItems?.length) {
      return { error: "Your cart is empty." };
    }

    // 1. Verify stock (public/read RLS)
    for (const item of cartItems) {
      if (item.variantId) {
        const { data: v } = await supabase
          .from("product_variants")
          .select("stock_quantity, status")
          .eq("id", item.variantId)
          .single();
        if (!v || v.status === false || v.stock_quantity < item.quantity) {
          return { error: `Item ${item.name} is out of stock or insufficient quantity.` };
        }
      } else {
        const { data: p } = await supabase
          .from("products")
          .select("stock_quantity")
          .eq("id", item.productId)
          .single();
        if (!p || p.stock_quantity < item.quantity) {
          return { error: `Item ${item.name} is out of stock or insufficient quantity.` };
        }
      }
    }

    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userId: string | null = null;
    if (user?.id) {
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (existing?.id) {
        userId = existing.id;
      } else {
        const fullName =
          String(formData.get("fullName") || "").trim() ||
          (user.user_metadata?.full_name as string | undefined) ||
          null;
        const phone =
          String(formData.get("phone") || "").trim() || user.phone || null;

        const { data: created, error: profileErr } = await admin
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email:
                user.email ||
                String(formData.get("email") || "") ||
                `user-${user.id.slice(0, 8)}@guest.local`,
              full_name: fullName,
              phone_number: phone,
              role: "customer",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )
          .select("id")
          .single();

        if (profileErr) {
          console.warn("Profile upsert failed; guest order:", profileErr.message);
          userId = null;
        } else {
          userId = created.id;
        }
      }
    }

    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const promoCodeRaw = String(formData.get("promoCode") || "").trim();

    const enriched = await enrichCartLinesForPromo(
      cartItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || null,
        name: String(item.name || "Item"),
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0,
      }))
    );

    const serverSubtotal = roundMoney(
      enriched.reduce((s, l) => s + l.price * l.quantity, 0)
    );
    // Prefer server math; tolerate 1 ₹ client drift
    const subtotal =
      Math.abs(serverSubtotal - Number(subtotalFromClient || 0)) < 1
        ? serverSubtotal
        : serverSubtotal;

    let discount = 0;
    let promoId: string | null = null;
    let promoCodeApplied: string | null = null;
    let promoNote = "";

    if (promoCodeRaw) {
      const promoRes = await resolvePromoForCheckout({
        code: promoCodeRaw,
        lines: enriched,
        customer: { userId, phone, email: email || user?.email || null },
      });
      if (!promoRes.ok) {
        return { error: promoRes.error };
      }
      if (!("skipped" in promoRes)) {
        discount = promoRes.discountAmount;
        promoId = promoRes.promo.id;
        promoCodeApplied = promoRes.promo.code;
        promoNote = `Promo ${promoRes.promo.code}: −₹${discount}`;
      }
    }

    const shipping = subtotal > 50000 ? 0 : 500;
    const grandTotal = roundMoney(Math.max(0, subtotal - discount + shipping));
    const paymentMethod = formData.get("paymentMethod") || "cod";

    const notesParts = [
      paymentMethod === "online" ? "Awaiting online payment" : null,
      promoNote || null,
    ].filter(Boolean);

    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0")}`;

    const orderPayload: Record<string, unknown> = {
      order_number: orderNumber,
      user_id: userId,
      address_snapshot: {
        full_name: formData.get("fullName"),
        mobile_number: formData.get("phone"),
        email: formData.get("email"),
        address_line: formData.get("address"),
        city: formData.get("city"),
        state: formData.get("state"),
        pin_code: formData.get("pinCode"),
      },
      subtotal,
      discount,
      tax_total: 0,
      shipping_charge: shipping,
      grand_total: grandTotal,
      payment_method: paymentMethod,
      payment_status: "pending",
      status: "pending",
      notes: notesParts.length ? notesParts.join(" · ") : null,
    };

    if (promoId) orderPayload.promo_code_id = promoId;

    let { data: order, error: orderErr } = await admin
      .from("orders")
      .insert(orderPayload)
      .select("id, order_number")
      .single();

    // Migration not applied: retry without promo_code_id
    if (orderErr && /promo_code_id|column|schema cache/i.test(orderErr.message) && promoId) {
      delete orderPayload.promo_code_id;
      ({ data: order, error: orderErr } = await admin
        .from("orders")
        .insert(orderPayload)
        .select("id, order_number")
        .single());
    }

    if (orderErr || !order) {
      throw new Error("Failed to create order: " + (orderErr?.message || "unknown"));
    }

    if (promoId && promoCodeApplied && discount > 0) {
      await recordPromoRedemption({
        promoId,
        orderId: order.id,
        userId,
        phone,
        email: email || user?.email || null,
        code: promoCodeApplied,
        discountAmount: discount,
      });
    }

    for (const item of cartItems) {
      let taxRate = 18;
      if (item.productId) {
        const { data: prod } = await admin
          .from("products")
          .select("tax_rate")
          .eq("id", item.productId)
          .maybeSingle();
        if (prod?.tax_rate != null) taxRate = Number(prod.tax_rate);
      }

      const { error: itemErr } = await admin.from("order_items").insert({
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId || null,
        product_name: item.name,
        variant_name: item.variantName || null,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.price,
        tax_rate: taxRate,
        total_price: item.price * item.quantity,
      });
      if (itemErr) {
        throw new Error("Failed to save order items: " + itemErr.message);
      }

      if (item.variantId) {
        const { data: v } = await admin
          .from("product_variants")
          .select("stock_quantity, product_id")
          .eq("id", item.variantId)
          .single();
        if (v) {
          await admin
            .from("product_variants")
            .update({ stock_quantity: Math.max(0, v.stock_quantity - item.quantity) })
            .eq("id", item.variantId);
          const { data: p } = await admin
            .from("products")
            .select("stock_quantity")
            .eq("id", v.product_id)
            .single();
          if (p) {
            await admin
              .from("products")
              .update({ stock_quantity: Math.max(0, p.stock_quantity - item.quantity) })
              .eq("id", v.product_id);
          }
        }
      } else {
        const { data: p } = await admin
          .from("products")
          .select("stock_quantity")
          .eq("id", item.productId)
          .single();
        if (p) {
          await admin
            .from("products")
            .update({ stock_quantity: Math.max(0, p.stock_quantity - item.quantity) })
            .eq("id", item.productId);
        }
      }
    }

    await notifyOwnerOfOrder({
      event: "order_created",
      orderId: order.id,
      orderNumber: order.order_number,
      paymentMethod: String(paymentMethod),
      paymentStatus: "pending",
      status: "pending",
      grandTotal,
      shippingCharge: shipping,
      subtotal,
      customer: {
        full_name: String(formData.get("fullName") || "") || null,
        mobile_number: String(formData.get("phone") || "") || null,
        email: String(formData.get("email") || "") || null,
        address_line: String(formData.get("address") || "") || null,
        city: String(formData.get("city") || "") || null,
        state: String(formData.get("state") || "") || null,
        pin_code: String(formData.get("pinCode") || "") || null,
      },
      items: cartItems.map((item) => ({
        product_name: String(item.name || "Item"),
        variant_name: item.variantName || null,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.price) || 0,
      })),
    });

    return {
      success: true,
      orderNumber: order.order_number,
      orderId: order.id,
      paymentMethod: String(paymentMethod),
      grandTotal,
      discount,
      promoCode: promoCodeApplied,
    };
  } catch (err: any) {
    console.error("Checkout transaction error:", err);
    return { error: err.message || "An unknown error occurred during checkout." };
  }
}
