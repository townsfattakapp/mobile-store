"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  customerPhoneKey,
  normalizePromoCode,
  validatePromoCode,
  type PromoCartLine,
  type PromoCodeRow,
  type PromoCustomer,
  type PromoValidationResult,
} from "@/lib/promo/promo";

function mapPromo(row: any): PromoCodeRow {
  return {
    id: row.id,
    code: row.code,
    description: row.description ?? null,
    discount_type: row.discount_type,
    discount_value: Number(row.discount_value),
    min_order_amount: Number(row.min_order_amount || 0),
    max_discount_amount:
      row.max_discount_amount == null ? null : Number(row.max_discount_amount),
    starts_at: row.starts_at ?? null,
    ends_at: row.ends_at ?? null,
    usage_limit: row.usage_limit == null ? null : Number(row.usage_limit),
    per_customer_limit:
      row.per_customer_limit == null ? null : Number(row.per_customer_limit),
    first_order_only: Boolean(row.first_order_only),
    active: Boolean(row.active),
    applies_to: row.applies_to || ["all"],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadPromoByCode(code: string): Promise<PromoCodeRow | null> {
  const admin = createAdminClient();
  const normalized = normalizePromoCode(code);
  const { data, error } = await admin
    .from("promo_codes")
    .select("*")
    .ilike("code", normalized)
    .maybeSingle();

  if (error) {
    if (/promo_codes|relation|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Promo codes are not set up yet. Run supabase/migrations/APPLY_NOW_promo_codes.sql"
      );
    }
    throw new Error(error.message);
  }
  return data ? mapPromo(data) : null;
}

function makeCounters(admin: ReturnType<typeof createAdminClient>) {
  return {
    async countActiveRedemptions(promoId: string) {
      const { count, error } = await admin
        .from("promo_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("promo_code_id", promoId)
        .is("voided_at", null);
      if (error) return 0;
      return count || 0;
    },
    async countCustomerRedemptions(promoId: string, customer: PromoCustomer) {
      let q = admin
        .from("promo_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("promo_code_id", promoId)
        .is("voided_at", null);

      const phone = customerPhoneKey(customer.phone);
      if (customer.userId) {
        q = q.eq("user_id", customer.userId);
      } else if (phone) {
        q = q.eq("customer_phone", phone);
      } else if (customer.email) {
        q = q.ilike("customer_email", customer.email.trim());
      } else {
        return 0;
      }

      const { count } = await q;
      return count || 0;
    },
    async countPriorOrders(customer: PromoCustomer) {
      let q = admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .neq("status", "cancelled");

      if (customer.userId) {
        q = q.eq("user_id", customer.userId);
      } else {
        const phone = customerPhoneKey(customer.phone);
        if (!phone) return 0;
        // Guest: approximate via address_snapshot phone digits — fallback scan limited
        const { data } = await admin
          .from("orders")
          .select("id, address_snapshot, status, deleted_at")
          .is("user_id", null)
          .is("deleted_at", null)
          .neq("status", "cancelled")
          .limit(500);
        let n = 0;
        for (const o of data || []) {
          const snapPhone =
            o.address_snapshot?.mobile_number ||
            o.address_snapshot?.phone ||
            "";
          if (customerPhoneKey(snapPhone) === phone) n += 1;
        }
        return n;
      }

      const { count } = await q;
      return count || 0;
    },
  };
}

/** Enrich cart lines with product.type for applies_to rules + optional DB price check. */
export async function enrichCartLinesForPromo(
  lines: {
    productId: string;
    variantId?: string | null;
    name: string;
    quantity: number;
    price: number;
  }[]
): Promise<PromoCartLine[]> {
  if (!lines.length) return [];
  const admin = createAdminClient();
  const productIds = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
  const { data: products } = await admin
    .from("products")
    .select("id, type, selling_price, status")
    .in("id", productIds);

  const byId = new Map((products || []).map((p) => [p.id, p]));
  return lines.map((line) => {
    const p = byId.get(line.productId);
    return {
      ...line,
      productType: p?.type || null,
      // Keep client price for display consistency; stock/status still enforced at placeOrder
      price: Number(line.price),
    };
  });
}

export async function previewPromoForCart(input: {
  code: string;
  lines: {
    productId: string;
    variantId?: string | null;
    name: string;
    quantity: number;
    price: number;
  }[];
  phone?: string | null;
  email?: string | null;
}): Promise<PromoValidationResult> {
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();

    const promo = await loadPromoByCode(input.code);
    const lines = await enrichCartLinesForPromo(input.lines);
    return validatePromoCode({
      promo,
      codeInput: input.code,
      lines,
      customer: {
        userId: user?.id || null,
        phone: input.phone || null,
        email: input.email || user?.email || null,
      },
      counters: makeCounters(createAdminClient()),
    });
  } catch (e: any) {
    return { ok: false, error: e?.message || "Could not validate promo code." };
  }
}

export async function resolvePromoForCheckout(input: {
  code: string | null | undefined;
  lines: PromoCartLine[];
  customer: PromoCustomer;
}): Promise<PromoValidationResult | { ok: true; skipped: true }> {
  const code = normalizePromoCode(input.code || "");
  if (!code) return { ok: true, skipped: true };

  const promo = await loadPromoByCode(code);
  return validatePromoCode({
    promo,
    codeInput: code,
    lines: input.lines,
    customer: input.customer,
    counters: makeCounters(createAdminClient()),
  });
}

export async function recordPromoRedemption(input: {
  promoId: string;
  orderId: string;
  userId?: string | null;
  phone?: string | null;
  email?: string | null;
  code: string;
  discountAmount: number;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("promo_redemptions").insert({
    promo_code_id: input.promoId,
    order_id: input.orderId,
    user_id: input.userId || null,
    customer_phone: customerPhoneKey(input.phone),
    customer_email: input.email?.trim().toLowerCase() || null,
    code_snapshot: normalizePromoCode(input.code),
    discount_amount: input.discountAmount,
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.warn("promo redemption insert failed:", error.message);
  }
}

export async function voidPromoRedemptionForOrder(orderId: string) {
  try {
    const admin = createAdminClient();
    await admin
      .from("promo_redemptions")
      .update({ voided_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .is("voided_at", null);
  } catch {
    // non-fatal
  }
}

export async function voidPromoRedemptionsForOrders(orderIds: string[]) {
  if (!orderIds.length) return;
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    for (let i = 0; i < orderIds.length; i += 100) {
      const chunk = orderIds.slice(i, i + 100);
      await admin
        .from("promo_redemptions")
        .update({ voided_at: now })
        .in("order_id", chunk)
        .is("voided_at", null);
    }
  } catch {
    // non-fatal
  }
}
