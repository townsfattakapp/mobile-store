"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { normalizePhoneKey } from "@/lib/customers/phone";
import { normalizeAddress } from "@/lib/invoice/types";

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
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { error: "Forbidden" as const, supabase, user: null };
  }

  return { error: null, supabase, user };
}

function archivePatch(userId: string, reason: string) {
  return {
    deleted_at: new Date().toISOString(),
    deleted_by: userId,
    delete_reason: reason.trim() || "Archived by admin",
  };
}

function restorePatch() {
  return {
    deleted_at: null,
    deleted_by: null,
    delete_reason: null,
  };
}

function missingCol(err: { message?: string } | null) {
  return Boolean(
    err?.message &&
      /deleted_at|delete_reason|deleted_by|column|schema cache/i.test(err.message)
  );
}

function migrationHint() {
  return "Run supabase/migrations/APPLY_NOW_soft_delete.sql in Supabase, then try again.";
}

function revalidateOps() {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/data");
}

/** Soft-delete an order (+ linked invoices). Keeps rows for audit. */
export async function softDeleteOrder(orderId: string, reason = "Archived by admin") {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const patch = archivePatch(auth.user.id, reason);
  const { error } = await auth.supabase.from("orders").update(patch).eq("id", orderId);
  if (error) {
    if (missingCol(error)) return { error: migrationHint() };
    return { error: error.message };
  }

  try {
    const { voidPromoRedemptionForOrder } = await import("@/lib/promo/server");
    await voidPromoRedemptionForOrder(orderId);
  } catch {
    // non-fatal
  }

  try {
    const { reverseGiveawayEntriesForOrder } = await import("@/lib/giveaway/server");
    await reverseGiveawayEntriesForOrder(orderId);
  } catch {
    // non-fatal
  }

  // Cancel issued invoices so a new invoice can be issued later if needed, then archive
  await auth.supabase
    .from("invoices")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: `Order archived: ${reason.trim() || "Archived by admin"}`,
    })
    .eq("order_id", orderId)
    .eq("status", "issued");

  const inv = await auth.supabase
    .from("invoices")
    .update(patch)
    .eq("order_id", orderId)
    .is("deleted_at", null);

  if (inv.error && !missingCol(inv.error)) {
    // order archived; invoice archive failed — surface soft warning
    revalidateOps();
    return {
      success: true,
      warning: `Order archived, but invoices: ${inv.error.message}`,
    };
  }

  revalidateOps();
  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

export async function restoreOrder(orderId: string) {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const { error } = await auth.supabase
    .from("orders")
    .update(restorePatch())
    .eq("id", orderId);

  if (error) {
    if (missingCol(error)) return { error: migrationHint() };
    return { error: error.message };
  }

  // Restore linked invoices that were archived with the order (leave cancel status as-is)
  await auth.supabase.from("invoices").update(restorePatch()).eq("order_id", orderId);

  revalidateOps();
  revalidatePath(`/admin/orders/${orderId}`);
  return { success: true };
}

export async function softDeleteInvoice(invoiceId: string, reason = "Archived by admin") {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const patch = archivePatch(auth.user.id, reason);

  // Ensure cancelled so unique active-invoice-per-order stays correct
  await auth.supabase
    .from("invoices")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason.trim() || "Archived by admin",
    })
    .eq("id", invoiceId)
    .eq("status", "issued");

  const { error } = await auth.supabase.from("invoices").update(patch).eq("id", invoiceId);
  if (error) {
    if (missingCol(error)) return { error: migrationHint() };
    return { error: error.message };
  }

  revalidateOps();
  revalidatePath(`/admin/invoices/${invoiceId}`);
  return { success: true };
}

export async function restoreInvoice(invoiceId: string) {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const { error } = await auth.supabase
    .from("invoices")
    .update(restorePatch())
    .eq("id", invoiceId);

  if (error) {
    if (missingCol(error)) return { error: migrationHint() };
    return { error: error.message };
  }

  revalidateOps();
  revalidatePath(`/admin/invoices/${invoiceId}`);
  return { success: true };
}

export async function softDeleteRegisteredCustomer(
  profileId: string,
  reason = "Archived by admin"
) {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const { data: target } = await auth.supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .single();

  if (!target) return { error: "Customer not found" };
  if (target.role !== "customer") {
    return { error: "Only customer profiles can be archived (not admin/staff)." };
  }

  const { error } = await auth.supabase
    .from("profiles")
    .update(archivePatch(auth.user.id, reason))
    .eq("id", profileId);

  if (error) {
    if (missingCol(error)) return { error: migrationHint() };
    return { error: error.message };
  }

  revalidateOps();
  revalidatePath(`/admin/customers/${profileId}`);
  return { success: true };
}

export async function restoreRegisteredCustomer(profileId: string) {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const { error } = await auth.supabase
    .from("profiles")
    .update(restorePatch())
    .eq("id", profileId);

  if (error) {
    if (missingCol(error)) return { error: migrationHint() };
    return { error: error.message };
  }

  revalidateOps();
  return { success: true };
}

export async function softDeleteWalkInCustomer(
  phoneKey: string,
  reason = "Archived by admin"
) {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const patch = archivePatch(auth.user.id, reason);
  const { data: existing } = await auth.supabase
    .from("walk_in_customers")
    .select("phone_key")
    .eq("phone_key", phoneKey)
    .maybeSingle();

  if (existing) {
    const { error } = await auth.supabase
      .from("walk_in_customers")
      .update(patch)
      .eq("phone_key", phoneKey);
    if (error) {
      if (missingCol(error)) return { error: migrationHint() };
      return { error: error.message };
    }
  } else {
    const { error } = await auth.supabase.from("walk_in_customers").upsert({
      phone_key: phoneKey,
      full_name: "Walk-in Customer",
      customer_status: "blocked",
      ...patch,
    });
    if (error) {
      if (missingCol(error)) return { error: migrationHint() };
      return { error: error.message };
    }
  }

  // Also archive guest orders for this phone (keeps history, hides from active lists)
  const { data: guestOrders } = await auth.supabase
    .from("orders")
    .select("id, address_snapshot")
    .is("user_id", null)
    .is("deleted_at", null)
    .limit(2000);

  const ids: string[] = [];
  for (const o of guestOrders || []) {
    const addr = normalizeAddress(o.address_snapshot);
    const key = normalizePhoneKey(addr.mobile_number);
    if (key && key === phoneKey) ids.push(o.id);
  }

  if (ids.length) {
    await auth.supabase.from("orders").update(patch).in("id", ids);
    try {
      const { voidPromoRedemptionsForOrders } = await import("@/lib/promo/server");
      await voidPromoRedemptionsForOrders(ids);
    } catch {
      // non-fatal
    }
    await auth.supabase
      .from("invoices")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: `Walk-in customer archived: ${reason}`,
      })
      .in("order_id", ids)
      .eq("status", "issued");
    await auth.supabase.from("invoices").update(patch).in("order_id", ids);
  }

  revalidateOps();
  return { success: true, archivedOrders: ids.length };
}

export async function restoreWalkInCustomer(phoneKey: string) {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const { error } = await auth.supabase
    .from("walk_in_customers")
    .update(restorePatch())
    .eq("phone_key", phoneKey);

  if (error) {
    if (missingCol(error)) return { error: migrationHint() };
    return { error: error.message };
  }

  revalidateOps();
  return { success: true };
}

/** Archive ALL active orders + invoices (test data wipe). Rows are kept in Trash. */
export async function archiveAllOrdersAndInvoices(reason = "Bulk test data clear") {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const patch = archivePatch(auth.user.id, reason);

  const { data: orders, error: oErr } = await auth.supabase
    .from("orders")
    .select("id")
    .is("deleted_at", null);

  if (oErr) {
    if (missingCol(oErr)) return { error: migrationHint() };
    return { error: oErr.message };
  }

  const orderIds = (orders || []).map((o) => o.id);
  let ordersArchived = 0;
  let invoicesArchived = 0;

  // Chunk updates
  for (let i = 0; i < orderIds.length; i += 100) {
    const chunk = orderIds.slice(i, i + 100);
    const { error, count } = await auth.supabase
      .from("orders")
      .update(patch, { count: "exact" })
      .in("id", chunk);
    if (error) return { error: error.message };
    ordersArchived += count ?? chunk.length;
  }

  try {
    const { voidPromoRedemptionsForOrders } = await import("@/lib/promo/server");
    await voidPromoRedemptionsForOrders(orderIds);
  } catch {
    // non-fatal
  }

  await auth.supabase
    .from("invoices")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    })
    .is("deleted_at", null)
    .eq("status", "issued");

  const { data: invs, error: iErr } = await auth.supabase
    .from("invoices")
    .select("id")
    .is("deleted_at", null);

  if (iErr) return { error: iErr.message };
  const invIds = (invs || []).map((r) => r.id);
  for (let i = 0; i < invIds.length; i += 100) {
    const chunk = invIds.slice(i, i + 100);
    const { error, count } = await auth.supabase
      .from("invoices")
      .update(patch, { count: "exact" })
      .in("id", chunk);
    if (error) return { error: error.message };
    invoicesArchived += count ?? chunk.length;
  }

  revalidateOps();
  return { success: true, ordersArchived, invoicesArchived };
}

/** Archive all registered customers (role=customer) + walk-in CRM rows. */
export async function archiveAllCustomers(reason = "Bulk test data clear") {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const patch = archivePatch(auth.user.id, reason);

  const { data: customers, error: cErr } = await auth.supabase
    .from("profiles")
    .select("id")
    .eq("role", "customer")
    .is("deleted_at", null);

  if (cErr) {
    if (missingCol(cErr)) return { error: migrationHint() };
    return { error: cErr.message };
  }

  let profilesArchived = 0;
  const ids = (customers || []).map((c) => c.id);
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error, count } = await auth.supabase
      .from("profiles")
      .update(patch, { count: "exact" })
      .in("id", chunk);
    if (error) return { error: error.message };
    profilesArchived += count ?? chunk.length;
  }

  const { data: walkins, error: wErr } = await auth.supabase
    .from("walk_in_customers")
    .select("phone_key")
    .is("deleted_at", null);

  let walkinsArchived = 0;
  if (!wErr) {
    const keys = (walkins || []).map((w) => w.phone_key);
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100);
      const { error, count } = await auth.supabase
        .from("walk_in_customers")
        .update(patch, { count: "exact" })
        .in("phone_key", chunk);
      if (error) return { error: error.message };
      walkinsArchived += count ?? chunk.length;
    }
  }

  revalidateOps();
  return { success: true, profilesArchived, walkinsArchived };
}

export async function listTrash() {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized", trash: null };

  const [ordersRes, invoicesRes, profilesRes, walkinsRes] = await Promise.all([
    auth.supabase
      .from("orders")
      .select("id, order_number, grand_total, status, deleted_at, delete_reason, address_snapshot")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200),
    auth.supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, deleted_at, delete_reason, customer_snapshot, totals_snapshot"
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200),
    auth.supabase
      .from("profiles")
      .select("id, full_name, email, phone_number, deleted_at, delete_reason")
      .eq("role", "customer")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200),
    auth.supabase
      .from("walk_in_customers")
      .select("phone_key, full_name, display_phone, deleted_at, delete_reason")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200),
  ]);

  if (
    missingCol(ordersRes.error) ||
    missingCol(invoicesRes.error) ||
    missingCol(profilesRes.error)
  ) {
    return { error: migrationHint(), trash: null };
  }

  return {
    trash: {
      orders: ordersRes.data || [],
      invoices: invoicesRes.data || [],
      profiles: profilesRes.data || [],
      walkins: walkinsRes.error ? [] : walkinsRes.data || [],
    },
  };
}

export async function getOpsCounts() {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const [orders, invoices, customers, trashOrders] = await Promise.all([
    auth.supabase.from("orders").select("id", { count: "exact", head: true }).is("deleted_at", null),
    auth.supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    auth.supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")
      .is("deleted_at", null),
    auth.supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
  ]);

  if (missingCol(orders.error)) return { error: migrationHint() };

  return {
    counts: {
      activeOrders: orders.count ?? 0,
      activeInvoices: invoices.count ?? 0,
      activeCustomers: customers.count ?? 0,
      trashOrders: trashOrders.count ?? 0,
    },
  };
}

/** Hard-delete only rows already in Trash (deleted_at set). */
export async function permanentlyDeleteOrder(orderId: string) {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const { data: row, error: findErr } = await auth.supabase
    .from("orders")
    .select("id, deleted_at")
    .eq("id", orderId)
    .maybeSingle();

  if (findErr) {
    if (missingCol(findErr)) return { error: migrationHint() };
    return { error: findErr.message };
  }
  if (!row?.deleted_at) {
    return { error: "Archive this order to Trash first, then permanently delete." };
  }

  // Invoices / items / history cascade from orders when FK is ON DELETE CASCADE
  const { error } = await auth.supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .not("deleted_at", "is", null);

  if (error) return { error: error.message };
  revalidateOps();
  return { success: true };
}

export async function permanentlyDeleteInvoice(invoiceId: string) {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const { data: row, error: findErr } = await auth.supabase
    .from("invoices")
    .select("id, deleted_at")
    .eq("id", invoiceId)
    .maybeSingle();

  if (findErr) {
    if (missingCol(findErr)) return { error: migrationHint() };
    return { error: findErr.message };
  }
  if (!row?.deleted_at) {
    return { error: "Archive this invoice to Trash first, then permanently delete." };
  }

  const { error } = await auth.supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .not("deleted_at", "is", null);

  if (error) return { error: error.message };
  revalidateOps();
  return { success: true };
}

export async function permanentlyDeleteWalkInCustomer(phoneKey: string) {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const { data: row, error: findErr } = await auth.supabase
    .from("walk_in_customers")
    .select("phone_key, deleted_at")
    .eq("phone_key", phoneKey)
    .maybeSingle();

  if (findErr) {
    if (missingCol(findErr)) return { error: migrationHint() };
    return { error: findErr.message };
  }
  if (!row?.deleted_at) {
    return { error: "Archive this walk-in to Trash first, then permanently delete." };
  }

  const { error } = await auth.supabase
    .from("walk_in_customers")
    .delete()
    .eq("phone_key", phoneKey)
    .not("deleted_at", "is", null);

  if (error) return { error: error.message };
  revalidateOps();
  return { success: true };
}

export async function permanentlyDeleteRegisteredCustomer(profileId: string) {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const { data: row, error: findErr } = await auth.supabase
    .from("profiles")
    .select("id, role, deleted_at")
    .eq("id", profileId)
    .maybeSingle();

  if (findErr) {
    if (missingCol(findErr)) return { error: migrationHint() };
    return { error: findErr.message };
  }
  if (!row || row.role !== "customer") {
    return { error: "Only archived customer accounts can be permanently deleted." };
  }
  if (!row.deleted_at) {
    return { error: "Archive this customer to Trash first, then permanently delete." };
  }

  try {
    const { createAdminClient } = await import("@/utils/supabase/admin");
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(profileId);
    if (error) return { error: error.message };
  } catch (e: any) {
    return {
      error:
        e?.message ||
        "Could not delete auth user. Ensure SUPABASE_SERVICE_ROLE_KEY is set, or keep the customer archived.",
    };
  }

  revalidateOps();
  return { success: true };
}

/** Permanently delete ALL items currently in Trash. */
export async function emptyTrash() {
  const auth = await requireStaff();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const [ordersRes, invoicesRes, walkinsRes, profilesRes] = await Promise.all([
    auth.supabase.from("orders").select("id").not("deleted_at", "is", null),
    auth.supabase.from("invoices").select("id").not("deleted_at", "is", null),
    auth.supabase.from("walk_in_customers").select("phone_key").not("deleted_at", "is", null),
    auth.supabase
      .from("profiles")
      .select("id")
      .eq("role", "customer")
      .not("deleted_at", "is", null),
  ]);

  if (missingCol(ordersRes.error)) return { error: migrationHint() };

  let ordersDeleted = 0;
  let invoicesDeleted = 0;
  let walkinsDeleted = 0;
  let profilesDeleted = 0;

  const orderIds = (ordersRes.data || []).map((o) => o.id);
  for (let i = 0; i < orderIds.length; i += 50) {
    const chunk = orderIds.slice(i, i + 50);
    const { error, count } = await auth.supabase
      .from("orders")
      .delete({ count: "exact" })
      .in("id", chunk)
      .not("deleted_at", "is", null);
    if (error) return { error: error.message };
    ordersDeleted += count ?? chunk.length;
  }

  const invIds = (invoicesRes.data || []).map((o) => o.id);
  for (let i = 0; i < invIds.length; i += 50) {
    const chunk = invIds.slice(i, i + 50);
    const { error, count } = await auth.supabase
      .from("invoices")
      .delete({ count: "exact" })
      .in("id", chunk)
      .not("deleted_at", "is", null);
    if (error) return { error: error.message };
    invoicesDeleted += count ?? chunk.length;
  }

  if (!walkinsRes.error) {
    const keys = (walkinsRes.data || []).map((w) => w.phone_key);
    for (let i = 0; i < keys.length; i += 50) {
      const chunk = keys.slice(i, i + 50);
      const { error, count } = await auth.supabase
        .from("walk_in_customers")
        .delete({ count: "exact" })
        .in("phone_key", chunk)
        .not("deleted_at", "is", null);
      if (error) return { error: error.message };
      walkinsDeleted += count ?? chunk.length;
    }
  }

  const profileIds = (profilesRes.data || []).map((p) => p.id);
  if (profileIds.length) {
    try {
      const { createAdminClient } = await import("@/utils/supabase/admin");
      const admin = createAdminClient();
      for (const id of profileIds) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (!error) profilesDeleted += 1;
      }
    } catch {
      // Leave archived profiles if service role missing
    }
  }

  revalidateOps();
  return {
    success: true,
    ordersDeleted,
    invoicesDeleted,
    walkinsDeleted,
    profilesDeleted,
  };
}
