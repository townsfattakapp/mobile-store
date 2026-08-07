"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function placeOrder(formData: any, cartItems: any[], subtotal: number) {
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
          .select("stock_quantity")
          .eq("id", item.variantId)
          .single();
        if (!v || v.stock_quantity < item.quantity) {
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

    // Service role: create/link profile + insert order (avoids profiles RLS + FK issues)
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

    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0")}`;

    const shipping = subtotal > 50000 ? 0 : 500;
    const paymentMethod = formData.get("paymentMethod") || "cod";

    const orderPayload = {
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
      discount: 0,
      tax_total: 0,
      shipping_charge: shipping,
      grand_total: subtotal + shipping,
      payment_method: paymentMethod,
      payment_status: "pending",
      status: "pending",
      notes: paymentMethod === "online" ? "Awaiting online payment" : null,
    };

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert(orderPayload)
      .select("id, order_number")
      .single();

    if (orderErr) throw new Error("Failed to create order: " + orderErr.message);

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

    return {
      success: true,
      orderNumber: order.order_number,
      orderId: order.id,
      paymentMethod: String(paymentMethod),
      grandTotal: orderPayload.grand_total,
    };
  } catch (err: any) {
    console.error("Checkout transaction error:", err);
    return { error: err.message || "An unknown error occurred during checkout." };
  }
}
