"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { normalizePromoCode, type PromoDiscountType } from "@/lib/promo/promo";

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

export type PromoFormInput = {
  id?: string;
  code: string;
  description?: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  usage_limit?: number | null;
  per_customer_limit?: number | null;
  first_order_only?: boolean;
  active?: boolean;
  applies_to?: string[];
};

function parseOptionalDate(value?: string | null): string | null {
  if (!value || !String(value).trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function emptyToNullInt(n: unknown): number | null {
  if (n === "" || n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.floor(v);
}

export async function listPromoCodesAction() {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error, promos: [] as any[] };
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("promo_codes")
    .select(
      `
      *,
      redemptions:promo_redemptions(id, voided_at)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    if (/promo_codes|relation|schema cache|does not exist/i.test(error.message)) {
      return {
        error:
          "Promo tables missing. Run supabase/migrations/APPLY_NOW_promo_codes.sql in Supabase SQL Editor.",
        promos: [],
      };
    }
    return { error: error.message, promos: [] };
  }

  const promos = (data || []).map((row: any) => {
    const redemptions = row.redemptions || [];
    const used = redemptions.filter((r: any) => !r.voided_at).length;
    const { redemptions: _r, ...promo } = row;
    return { ...promo, redemption_count: used };
  });

  return { promos, error: null };
}

export async function upsertPromoCodeAction(input: PromoFormInput) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { supabase, user } = auth;

  const code = normalizePromoCode(input.code);
  if (!code || code.length < 2) {
    return { error: "Enter a promo code (at least 2 characters)." };
  }
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    return { error: "Code can only use letters, numbers, _ and -." };
  }

  const discountType = input.discount_type === "fixed" ? "fixed" : "percent";
  const discountValue = Number(input.discount_value);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return { error: "Discount value must be greater than 0." };
  }
  if (discountType === "percent" && discountValue > 100) {
    return { error: "Percentage cannot exceed 100." };
  }

  const minOrder = Math.max(0, Number(input.min_order_amount) || 0);
  let maxDiscount =
    input.max_discount_amount == null || input.max_discount_amount === ("" as any)
      ? null
      : Number(input.max_discount_amount);
  if (maxDiscount != null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) {
    maxDiscount = null;
  }
  if (discountType === "fixed") {
    maxDiscount = null; // not used for fixed ₹ codes
  }

  const startsAt = parseOptionalDate(input.starts_at);
  const endsAt = parseOptionalDate(input.ends_at);
  if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
    return { error: "End date must be after start date." };
  }

  const appliesTo =
    Array.isArray(input.applies_to) && input.applies_to.length
      ? input.applies_to
      : ["all"];

  const payload = {
    code,
    description: String(input.description || "").trim() || null,
    discount_type: discountType,
    discount_value: discountValue,
    min_order_amount: minOrder,
    max_discount_amount: maxDiscount,
    starts_at: startsAt,
    ends_at: endsAt,
    usage_limit: emptyToNullInt(input.usage_limit),
    per_customer_limit: emptyToNullInt(input.per_customer_limit),
    first_order_only: Boolean(input.first_order_only),
    active: input.active !== false,
    applies_to: appliesTo,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("promo_codes")
      .update(payload)
      .eq("id", input.id);
    if (error) {
      if (/unique|duplicate/i.test(error.message)) {
        return { error: "Another promo already uses this code." };
      }
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("promo_codes").insert({
      ...payload,
      created_by: user.id,
    });
    if (error) {
      if (/unique|duplicate/i.test(error.message)) {
        return { error: "This promo code already exists." };
      }
      if (/promo_codes|relation|schema cache|does not exist/i.test(error.message)) {
        return {
          error:
            "Promo tables missing. Run supabase/migrations/APPLY_NOW_promo_codes.sql in Supabase SQL Editor.",
        };
      }
      return { error: error.message };
    }
  }

  revalidatePath("/admin/promo-codes");
  return { success: true };
}

export async function setPromoActiveAction(id: string, active: boolean) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { supabase } = auth;

  const { error } = await supabase
    .from("promo_codes")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/promo-codes");
  return { success: true };
}

export async function deletePromoCodeAction(id: string) {
  const auth = await requireStaff();
  if (auth.error) return { error: auth.error };
  const { supabase } = auth;

  // Soft path: deactivate if redemptions exist (FK RESTRICT)
  const { count } = await supabase
    .from("promo_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("promo_code_id", id);

  if ((count || 0) > 0) {
    const { error } = await supabase
      .from("promo_codes")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/promo-codes");
    return {
      success: true,
      deactivated: true,
      message: "Code has redemptions — deactivated instead of deleted.",
    };
  }

  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/promo-codes");
  return { success: true };
}
