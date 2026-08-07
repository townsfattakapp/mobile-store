"use server";

import { createClient } from "@/utils/supabase/server";

export async function placeOrder(formData: any, cartItems: any[], subtotal: number) {
  const supabase = await createClient();
  
  try {
    // 1. Verify Stock
    for (const item of cartItems) {
      // We check if the item is a variant or a base product
      if (item.variantId) {
        const { data: v } = await supabase.from('product_variants').select('stock_quantity').eq('id', item.variantId).single();
        if (!v || v.stock_quantity < item.quantity) {
          return { error: `Item ${item.name} is out of stock or insufficient quantity.` };
        }
      } else {
        const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', item.productId).single();
        if (!p || p.stock_quantity < item.quantity) {
          return { error: `Item ${item.name} is out of stock or insufficient quantity.` };
        }
      }
    }

    // 2. Create Order
    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
    
    // Check if user is logged in (optional for guest checkout)
    const { data: { user } } = await supabase.auth.getUser();

    const orderPayload = {
      order_number: orderNumber,
      user_id: user ? user.id : null,
      address_snapshot: {
        full_name: formData.get("fullName"),
        mobile_number: formData.get("phone"),
        email: formData.get("email"),
        address_line: formData.get("address"),
        city: formData.get("city"),
        state: formData.get("state"),
        pin_code: formData.get("pinCode"),
      },
      subtotal: subtotal,
      discount: 0,
      tax_total: 0,
      shipping_charge: subtotal > 50000 ? 0 : 500, // Example shipping logic
      grand_total: subtotal + (subtotal > 50000 ? 0 : 500),
      payment_method: formData.get("paymentMethod") || "cod",
      // Online stays pending until Razorpay (or demo) verify marks paid
      payment_status: "pending",
      status: "pending",
      notes:
        formData.get("paymentMethod") === "online"
          ? "Awaiting online payment"
          : null,
    };

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select('id, order_number')
      .single();

    if (orderErr) throw new Error("Failed to create order: " + orderErr.message);

    // 3. Insert Order Items and Decrement Stock
    for (const item of cartItems) {
      // Fetch product tax_rate for invoice snapshots
      let taxRate = 18;
      if (item.productId) {
        const { data: prod } = await supabase
          .from("products")
          .select("tax_rate")
          .eq("id", item.productId)
          .maybeSingle();
        if (prod?.tax_rate != null) taxRate = Number(prod.tax_rate);
      }

      const itemPayload = {
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        product_name: item.name,
        variant_name: item.variantName,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.price,
        tax_rate: taxRate,
        total_price: item.price * item.quantity
      };
      
      await supabase.from('order_items').insert(itemPayload);

      // Decrement stock
      if (item.variantId) {
        const { data: v } = await supabase.from('product_variants').select('stock_quantity, product_id').eq('id', item.variantId).single();
        if (v) {
          await supabase.from('product_variants').update({ stock_quantity: v.stock_quantity - item.quantity }).eq('id', item.variantId);
          // Also decrement base product stock for aggregated view
          const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', v.product_id).single();
          if (p) await supabase.from('products').update({ stock_quantity: p.stock_quantity - item.quantity }).eq('id', v.product_id);
        }
      } else {
        const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', item.productId).single();
        if (p) await supabase.from('products').update({ stock_quantity: p.stock_quantity - item.quantity }).eq('id', item.productId);
      }
    }

    return {
      success: true,
      orderNumber: order.order_number,
      orderId: order.id,
      paymentMethod: String(formData.get("paymentMethod") || "cod"),
      grandTotal: orderPayload.grand_total,
    };
    
  } catch (err: any) {
    console.error("Checkout transaction error:", err);
    return { error: err.message || "An unknown error occurred during checkout." };
  }
}
