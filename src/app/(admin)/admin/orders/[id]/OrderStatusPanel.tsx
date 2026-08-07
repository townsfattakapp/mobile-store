"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
} from "./orderStatus";
import {
  updateOrderNotesAction,
  updateOrderStatusAction,
  updatePaymentStatusAction,
} from "./actions";

export function OrderStatusPanel({
  orderId,
  status,
  paymentStatus,
  notes,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
  notes: string | null;
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [noteDraft, setNoteDraft] = useState(notes || "");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>, okMsg: string) => {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await fn();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMessage(okMsg);
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-1 font-semibold">Order status</h3>
        <p className="mb-4 text-xs text-gray-500">
          Current:{" "}
          <span className="font-medium text-gray-800">
            {ORDER_STATUS_LABEL[status as keyof typeof ORDER_STATUS_LABEL] || status}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={status === s ? "primary" : "outline"}
              disabled={pending || status === s}
              onClick={() =>
                run(
                  () => updateOrderStatusAction(orderId, s),
                  `Status set to ${ORDER_STATUS_LABEL[s]}`
                )
              }
            >
              {ORDER_STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-1 font-semibold">Payment status</h3>
        <p className="mb-4 text-xs text-gray-500">
          Current:{" "}
          <span className="font-medium text-gray-800">
            {PAYMENT_STATUS_LABEL[paymentStatus as keyof typeof PAYMENT_STATUS_LABEL] ||
              paymentStatus}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={paymentStatus === s ? "primary" : "outline"}
              disabled={pending || paymentStatus === s}
              onClick={() =>
                run(
                  () => updatePaymentStatusAction(orderId, s),
                  `Payment marked ${PAYMENT_STATUS_LABEL[s].toLowerCase()}`
                )
              }
            >
              {PAYMENT_STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-3 font-semibold">Internal notes</h3>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={4}
          placeholder="Staff notes for this order…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-black"
        />
        <Button
          type="button"
          className="mt-3"
          size="sm"
          disabled={pending}
          isLoading={pending}
          onClick={() =>
            run(() => updateOrderNotesAction(orderId, noteDraft), "Notes saved")
          }
        >
          Save notes
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
    </div>
  );
}
