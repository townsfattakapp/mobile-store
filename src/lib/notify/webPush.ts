import webpush from "web-push";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  formatOrderAlertSubject,
  formatOrderAlertText,
} from "./formatOrderAlert";
import type { OrderNotifyPayload } from "./types";

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function vapidConfigured() {
  return Boolean(
    (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim() &&
      (process.env.VAPID_PRIVATE_KEY || "").trim()
  );
}

export function getVapidPublicKey(): string | null {
  const key = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  return key || null;
}

function configureWebPush() {
  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject =
    (process.env.VAPID_SUBJECT || "").trim() || "mailto:owner@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function sendOwnerOrderWebPush(opts: {
  payload: OrderNotifyPayload;
  adminOrderUrl?: string;
}): Promise<{ ok: boolean; skipped?: boolean; sent?: number; error?: string }> {
  if (!vapidConfigured()) {
    return { ok: false, skipped: true, error: "VAPID keys not set" };
  }
  if (!configureWebPush()) {
    return { ok: false, skipped: true, error: "VAPID configure failed" };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e: any) {
    return { ok: false, error: e?.message || "Admin client failed" };
  }

  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("enabled", true);

  if (error) {
    // Table missing — treat as skipped until migration applied
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      return { ok: false, skipped: true, error: error.message };
    }
    return { ok: false, error: error.message };
  }

  if (!rows?.length) {
    return { ok: true, skipped: true, sent: 0, error: "No push subscriptions" };
  }

  const title = formatOrderAlertSubject(opts.payload);
  const body = formatOrderAlertText(opts.payload).slice(0, 180);
  const notification = JSON.stringify({
    title,
    body,
    url: opts.adminOrderUrl || "/admin/orders",
    orderId: opts.payload.orderId,
    orderNumber: opts.payload.orderNumber,
  });

  let sent = 0;
  const staleIds: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          notification,
          { TTL: 60 * 60 }
        );
        sent += 1;
      } catch (e: any) {
        const status = e?.statusCode || e?.status;
        if (status === 404 || status === 410) {
          staleIds.push(row.id);
        } else {
          console.warn("web-push failed", row.endpoint.slice(0, 48), e?.message);
        }
      }
    })
  );

  if (staleIds.length) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { ok: sent > 0, sent };
}
