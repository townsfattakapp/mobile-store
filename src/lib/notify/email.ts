import {
  formatOrderAlertHtml,
  formatOrderAlertSubject,
  formatOrderAlertText,
} from "./formatOrderAlert";
import type { OrderNotifyPayload, StoreNotifyContact } from "./types";

/**
 * Send owner email via Resend HTTP API.
 * Requires RESEND_API_KEY. Optional ORDER_NOTIFY_FROM_EMAIL, ORDER_NOTIFY_TO_EMAIL.
 */
export async function sendOwnerOrderEmail(opts: {
  payload: OrderNotifyPayload;
  store: StoreNotifyContact;
  adminOrderUrl?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    return { ok: false, skipped: true, error: "RESEND_API_KEY not set" };
  }

  const to =
    (process.env.ORDER_NOTIFY_TO_EMAIL || "").trim() ||
    String(opts.store.email || "").trim();
  if (!to || !to.includes("@")) {
    return {
      ok: false,
      skipped: true,
      error: "No owner email (set store email or ORDER_NOTIFY_TO_EMAIL)",
    };
  }

  const from =
    (process.env.ORDER_NOTIFY_FROM_EMAIL || "").trim() ||
    "Mahadev Mobiles <onboarding@resend.dev>";

  const subject = formatOrderAlertSubject(opts.payload);
  const text = formatOrderAlertText(opts.payload);
  const html = formatOrderAlertHtml(opts.payload, opts.adminOrderUrl);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Email send failed" };
  }
}
