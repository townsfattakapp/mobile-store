"use client";

import React, { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function OrderPushEnableCard() {
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    (async () => {
      try {
        const res = await fetch("/api/admin/push");
        const json = await res.json().catch(() => ({}));
        setConfigured(Boolean(json.configured && json.publicKey));

        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setEnabled(Boolean(sub));
      } catch {
        setConfigured(false);
      }
    })();
  }, []);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const keyRes = await fetch("/api/admin/push");
      const keyJson = await keyRes.json();
      if (!keyJson.publicKey) {
        throw new Error(
          "Browser push is not configured yet (missing VAPID keys on the server)."
        );
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission was not granted on this device.");
      }

      const reg =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ||
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey),
        });
      }

      const raw = sub.toJSON();
      const save = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: raw.endpoint,
          keys: raw.keys,
          userAgent: navigator.userAgent,
        }),
      });
      const saved = await save.json().catch(() => ({}));
      if (!save.ok) throw new Error(saved.error || "Failed to save subscription");

      setEnabled(true);
      setMessage("This device will get order alerts even when the admin tab is in the background.");
    } catch (e: any) {
      setMessage(e?.message || "Could not enable push alerts");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/admin/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
      setMessage("Push alerts disabled on this device.");
    } catch (e: any) {
      setMessage(e?.message || "Could not disable push");
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <div className="rounded-xl border bg-neutral-50 p-4 text-sm text-[#6e6e73]">
        Browser push is not supported on this browser. Use email / WhatsApp alerts instead,
        or open Admin Settings on Chrome/Safari on your phone.
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-[#0071e3]">
          {enabled ? <Bell size={20} /> : <BellOff size={20} />}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-[#1d1d1f]">Phone / browser order alerts</h3>
          <p className="text-xs text-[#6e6e73] mt-1">
            Enable on this device (recommended: Chrome on Android, or Safari iOS 16.4+ with the
            site added to Home Screen). You’ll get a notification when a website order is placed
            or paid.
          </p>
          {!configured && (
            <p className="text-xs text-amber-700 mt-2">
              Server VAPID keys are not set yet — email/WhatsApp can still work. Ask your developer
              to add NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!enabled ? (
          <Button type="button" onClick={enable} disabled={busy || !configured}>
            {busy ? "Enabling…" : "Enable alerts on this device"}
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={disable} disabled={busy}>
            {busy ? "Updating…" : "Disable on this device"}
          </Button>
        )}
      </div>
      {message && <p className="text-xs text-[#6e6e73]">{message}</p>}
    </div>
  );
}
