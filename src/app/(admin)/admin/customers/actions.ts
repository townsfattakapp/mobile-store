"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { normalizePhoneKey } from "@/lib/customers/phone";

export type CustomerStatus = "active" | "vip" | "blocked";

export type CustomerProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  role: string;
  customer_status: CustomerStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, supabase, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return { error: "Forbidden" as const, supabase, user: null };
  }

  return { error: null, supabase, user };
}

export async function updateCustomerProfile(
  customerId: string,
  payload: {
    full_name?: string;
    phone_number?: string;
    customer_status?: CustomerStatus;
    admin_notes?: string;
  }
) {
  const auth = await requireStaff();
  if (auth.error || !auth.supabase)
    return { error: auth.error || "Unauthorized" };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof payload.full_name === "string") {
    updates.full_name = payload.full_name.trim() || null;
  }
  if (typeof payload.phone_number === "string") {
    updates.phone_number = payload.phone_number.trim() || null;
  }
  if (payload.customer_status) {
    if (!["active", "vip", "blocked"].includes(payload.customer_status)) {
      return { error: "Invalid customer status" };
    }
    updates.customer_status = payload.customer_status;
  }
  if (typeof payload.admin_notes === "string") {
    updates.admin_notes = payload.admin_notes.trim() || null;
  }

  const { error } = await auth.supabase
    .from("profiles")
    .update(updates)
    .eq("id", customerId)
    .eq("role", "customer");

  if (error) {
    if (/customer_status|admin_notes/i.test(error.message)) {
      const legacy: Record<string, unknown> = {
        updated_at: updates.updated_at,
      };
      if ("full_name" in updates) legacy.full_name = updates.full_name;
      if ("phone_number" in updates) legacy.phone_number = updates.phone_number;
      const { error: e2 } = await auth.supabase
        .from("profiles")
        .update(legacy)
        .eq("id", customerId)
        .eq("role", "customer");
      if (e2) return { error: e2.message };
      return {
        error:
          "Profile saved, but run migration 02_customer_crm.sql to enable status & notes.",
        partial: true,
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return { success: true };
}

/** Upsert CRM fields for a walk-in customer keyed by phone. */
export async function updateWalkInCustomer(
  phoneRaw: string,
  payload: {
    full_name?: string;
    display_phone?: string;
    customer_status?: CustomerStatus;
    admin_notes?: string;
  }
) {
  const auth = await requireStaff();
  if (auth.error || !auth.supabase)
    return { error: auth.error || "Unauthorized" };

  const phoneKey = normalizePhoneKey(phoneRaw);
  if (!phoneKey) return { error: "Valid phone number required for walk-in CRM" };

  if (
    payload.customer_status &&
    !["active", "vip", "blocked"].includes(payload.customer_status)
  ) {
    return { error: "Invalid customer status" };
  }

  const row = {
    phone_key: phoneKey,
    display_phone: payload.display_phone?.trim() || phoneKey,
    full_name: payload.full_name?.trim() || null,
    customer_status: payload.customer_status || "active",
    admin_notes:
      typeof payload.admin_notes === "string"
        ? payload.admin_notes.trim() || null
        : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await auth.supabase.from("walk_in_customers").upsert(row, {
    onConflict: "phone_key",
  });

  if (error) {
    if (/walk_in_customers|relation|does not exist/i.test(error.message)) {
      return {
        error:
          "Run supabase/migrations/03_walk_in_customers.sql to enable walk-in CRM notes/status.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/walk-in/${phoneKey}`);
  return { success: true, phoneKey };
}
