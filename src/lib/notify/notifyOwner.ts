import { getSiteUrl } from "@/lib/seo/siteUrl";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendOwnerOrderWhatsApp } from "./callMeBotWhatsApp";
import { sendOwnerOrderEmail } from "./email";
import type { OrderNotifyPayload, StoreNotifyContact } from "./types";
import { sendOwnerOrderWebPush } from "./webPush";

async function loadStoreContact(): Promise<StoreNotifyContact> {
  try {
    const admin = createAdminClient();
    let { data, error } = await admin
      .from("store_settings")
      .select("email, phone, whatsapp_number, brand_name, trade_name, legal_name")
      .limit(1)
      .maybeSingle();

    if (error && /whatsapp_number|column|schema cache/i.test(error.message)) {
      ({ data, error } = await admin
        .from("store_settings")
        .select("email, phone, brand_name, trade_name, legal_name")
        .limit(1)
        .maybeSingle());
    }

    if (error || !data) return {};
    return {
      email: data.email,
      phone: data.phone,
      whatsapp_number: (data as any).whatsapp_number || null,
      brand_name:
        (data as any).brand_name || data.trade_name || data.legal_name || null,
    };
  } catch {
    return {};
  }
}

/**
 * Fire-and-forget owner alerts (email + WhatsApp CallMeBot + browser push).
 * Never throws — checkout must not fail because of notify errors.
 */
export async function notifyOwnerOfOrder(
  payload: OrderNotifyPayload
): Promise<void> {
  try {
    const store = await loadStoreContact();
    const adminOrderUrl = `${getSiteUrl()}/admin/orders/${payload.orderId}`;

    const results = await Promise.allSettled([
      sendOwnerOrderEmail({ payload, store, adminOrderUrl }),
      sendOwnerOrderWhatsApp({ payload, store }),
      sendOwnerOrderWebPush({ payload, adminOrderUrl }),
    ]);

    for (const r of results) {
      if (r.status === "fulfilled") {
        const v = r.value;
        if (!v.ok && !v.skipped) {
          console.warn("[notifyOwner]", v.error || "channel failed");
        } else if (v.skipped) {
          // Quiet skip when channel not configured
        } else {
          console.info("[notifyOwner] sent", payload.event, payload.orderNumber);
        }
      } else {
        console.warn("[notifyOwner] rejected", r.reason);
      }
    }
  } catch (e) {
    console.warn("[notifyOwner] unexpected", e);
  }
}

/**
 * Load order + items from DB and notify (used after payment verify).
 */
export async function notifyOwnerOfOrderById(
  orderId: string,
  event: OrderNotifyPayload["event"]
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: order, error } = await admin
      .from("orders")
      .select(
        "id, order_number, payment_method, payment_status, status, grand_total, shipping_charge, subtotal, address_snapshot"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      console.warn("[notifyOwner] order not found", orderId, error?.message);
      return;
    }

    const { data: items } = await admin
      .from("order_items")
      .select("product_name, variant_name, quantity, unit_price")
      .eq("order_id", orderId);

    const snap = (order.address_snapshot || {}) as Record<string, unknown>;

    await notifyOwnerOfOrder({
      event,
      orderId: order.id,
      orderNumber: order.order_number,
      paymentMethod: String(order.payment_method || ""),
      paymentStatus: String(order.payment_status || ""),
      status: String(order.status || ""),
      grandTotal: Number(order.grand_total) || 0,
      shippingCharge: Number(order.shipping_charge) || 0,
      subtotal: Number(order.subtotal) || 0,
      customer: {
        full_name: (snap.full_name as string) || null,
        mobile_number: (snap.mobile_number as string) || null,
        email: (snap.email as string) || null,
        address_line: (snap.address_line as string) || null,
        city: (snap.city as string) || null,
        state: (snap.state as string) || null,
        pin_code: (snap.pin_code as string) || null,
      },
      items: (items || []).map((i) => ({
        product_name: i.product_name,
        variant_name: i.variant_name,
        quantity: Number(i.quantity) || 0,
        unit_price: Number(i.unit_price) || 0,
      })),
    });
  } catch (e) {
    console.warn("[notifyOwnerById]", e);
  }
}
