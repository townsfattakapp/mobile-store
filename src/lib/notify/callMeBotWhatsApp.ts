import { resolveSellerWhatsAppNumber } from "@/lib/whatsapp/normalizeWhatsAppNumber";
import { formatOrderAlertText } from "./formatOrderAlert";
import type { OrderNotifyPayload, StoreNotifyContact } from "./types";

/**
 * CallMeBot personal WhatsApp ping.
 * Owner must activate once: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 * Env: CALLMEBOT_API_KEY
 * Phone: store whatsapp_number (or phone) — must match CallMeBot-registered number.
 */
export async function sendOwnerOrderWhatsApp(opts: {
  payload: OrderNotifyPayload;
  store: StoreNotifyContact;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = (process.env.CALLMEBOT_API_KEY || "").trim();
  if (!apiKey) {
    return { ok: false, skipped: true, error: "CALLMEBOT_API_KEY not set" };
  }

  const phone = resolveSellerWhatsAppNumber({
    whatsapp_number: opts.store.whatsapp_number,
    phone: opts.store.phone,
  });
  if (!phone) {
    return {
      ok: false,
      skipped: true,
      error: "No store WhatsApp/phone number for CallMeBot",
    };
  }

  const text = formatOrderAlertText(opts.payload);
  const url = new URL("https://api.callmebot.com/whatsapp.php");
  url.searchParams.set("phone", phone);
  url.searchParams.set("text", text);
  url.searchParams.set("apikey", apiKey);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      return { ok: false, error: `CallMeBot ${res.status}: ${body.slice(0, 200)}` };
    }
    // CallMeBot sometimes returns 200 with an error message in body
    if (/error|invalid|wrong/i.test(body) && !/message queued|success|sent/i.test(body)) {
      return { ok: false, error: body.slice(0, 200) };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "WhatsApp send failed" };
  }
}
