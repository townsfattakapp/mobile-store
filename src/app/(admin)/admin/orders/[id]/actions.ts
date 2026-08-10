"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentStatus,
} from "./orderStatus";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { error: "Unauthorized." as const };
  }

  return { error: null, supabase, user } as const;
}

async function appendHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  orderStatus: string,
  notes: string,
  createdBy: string
) {
  const { error } = await supabase.from("order_status_history").insert({
    order_id: orderId,
    status: orderStatus,
    notes,
    created_by: createdBy,
  });
  // History is best-effort — don't fail the status update if insert is blocked
  if (error) {
    console.error("order_status_history insert failed:", error.message);
  }
}

export async function updateOrderStatusAction(orderId: string, status: string) {
  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    return { error: "Invalid order status." };
  }

  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { supabase, user } = auth;

  const { data: current, error: fetchError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError || !current) {
    return { error: fetchError?.message || "Order not found." };
  }

  if (current.status === status) return { success: true };

  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) return { error: error.message };

  await appendHistory(
    supabase,
    orderId,
    status,
    `Status changed from ${current.status} to ${status}`,
    user.id
  );

  // Free promo usage when an order is cancelled
  if (status === "cancelled") {
    const { voidPromoRedemptionForOrder } = await import("@/lib/promo/server");
    await voidPromoRedemptionForOrder(orderId);
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { success: true };
}

export async function updatePaymentStatusAction(orderId: string, paymentStatus: string) {
  if (!PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)) {
    return { error: "Invalid payment status." };
  }

  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { supabase, user } = auth;

  const { data: current, error: fetchError } = await supabase
    .from("orders")
    .select("id, status, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError || !current) {
    return { error: fetchError?.message || "Order not found." };
  }

  if (current.payment_status === paymentStatus) return { success: true };

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) return { error: error.message };

  await appendHistory(
    supabase,
    orderId,
    current.status,
    `Payment status changed from ${current.payment_status} to ${paymentStatus}`,
    user.id
  );

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { success: true };
}

export async function updateOrderNotesAction(orderId: string, notes: string) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { supabase } = auth;

  const { error } = await supabase
    .from("orders")
    .update({
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}
