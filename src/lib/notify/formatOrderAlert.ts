import type { OrderNotifyPayload } from "./types";

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function eventTitle(event: OrderNotifyPayload["event"]) {
  return event === "payment_confirmed"
    ? "Payment confirmed"
    : "New website order";
}

export function formatOrderAlertText(payload: OrderNotifyPayload): string {
  const c = payload.customer || {};
  const lines = [
    `🛒 ${eventTitle(payload.event)}`,
    "",
    `Order: ${payload.orderNumber}`,
    `Total: ${inr(payload.grandTotal)}`,
    `Payment: ${payload.paymentMethod} (${payload.paymentStatus})`,
    `Status: ${payload.status}`,
    "",
    `Customer: ${c.full_name || "—"}`,
    `Phone: ${c.mobile_number || "—"}`,
  ];
  if (c.email) lines.push(`Email: ${c.email}`);
  const addr = [c.address_line, c.city, c.state, c.pin_code].filter(Boolean).join(", ");
  if (addr) lines.push(`Address: ${addr}`);

  if (payload.items?.length) {
    lines.push("", "Items:");
    for (const item of payload.items.slice(0, 12)) {
      const variant = item.variant_name ? ` (${item.variant_name})` : "";
      lines.push(
        `• ${item.product_name}${variant} × ${item.quantity} — ${inr(
          item.unit_price * item.quantity
        )}`
      );
    }
    if (payload.items.length > 12) {
      lines.push(`… +${payload.items.length - 12} more`);
    }
  }

  if (payload.event === "order_created" && payload.paymentMethod === "online") {
    lines.push("", "Note: Awaiting online payment.");
  }

  return lines.join("\n");
}

export function formatOrderAlertHtml(
  payload: OrderNotifyPayload,
  adminOrderUrl?: string
): string {
  const text = formatOrderAlertText(payload)
    .split("\n")
    .map((line) => line || "&nbsp;")
    .join("<br/>");
  const link = adminOrderUrl
    ? `<p style="margin-top:16px"><a href="${adminOrderUrl}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Open order in admin</a></p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#111">${text}${link}</div>`;
}

export function formatOrderAlertSubject(payload: OrderNotifyPayload): string {
  return `${eventTitle(payload.event)} ${payload.orderNumber} · ${inr(
    payload.grandTotal
  )}`;
}
