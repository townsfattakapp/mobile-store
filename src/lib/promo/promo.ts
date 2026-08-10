import { normalizePhoneKey } from "@/lib/customers/phone";

export type PromoDiscountType = "percent" | "fixed";

export type PromoCodeRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: PromoDiscountType;
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  first_order_only: boolean;
  active: boolean;
  applies_to: string[] | null;
  created_at?: string;
  updated_at?: string;
};

export type PromoCartLine = {
  productId: string;
  variantId?: string | null;
  name: string;
  quantity: number;
  price: number;
  productType?: string | null;
};

export type PromoCustomer = {
  userId?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type PromoValidationOk = {
  ok: true;
  promo: PromoCodeRow;
  eligibleSubtotal: number;
  cartSubtotal: number;
  discountAmount: number;
  message: string;
};

export type PromoValidationErr = {
  ok: false;
  error: string;
};

export type PromoValidationResult = PromoValidationOk | PromoValidationErr;

export function normalizePromoCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function appliesToLine(promo: PromoCodeRow, productType: string | null | undefined): boolean {
  const rules = (promo.applies_to || ["all"]).map((r) => String(r).toLowerCase());
  if (!rules.length || rules.includes("all")) return true;
  const t = String(productType || "").toLowerCase();
  if (!t) return true; // unknown type: allow (avoid false denies on sparse data)
  return rules.includes(t);
}

export function eligibleSubtotalForPromo(
  promo: PromoCodeRow,
  lines: PromoCartLine[]
): { cartSubtotal: number; eligibleSubtotal: number } {
  let cartSubtotal = 0;
  let eligibleSubtotal = 0;
  for (const line of lines) {
    const qty = Math.max(0, Number(line.quantity) || 0);
    const price = Math.max(0, Number(line.price) || 0);
    const lineTotal = roundMoney(qty * price);
    cartSubtotal = roundMoney(cartSubtotal + lineTotal);
    if (appliesToLine(promo, line.productType)) {
      eligibleSubtotal = roundMoney(eligibleSubtotal + lineTotal);
    }
  }
  return { cartSubtotal, eligibleSubtotal };
}

export function computePromoDiscount(
  promo: PromoCodeRow,
  eligibleSubtotal: number
): number {
  const base = Math.max(0, eligibleSubtotal);
  if (base <= 0) return 0;

  let discount = 0;
  if (promo.discount_type === "percent") {
    const pct = Math.min(100, Math.max(0, Number(promo.discount_value) || 0));
    discount = roundMoney((base * pct) / 100);
    if (promo.max_discount_amount != null) {
      discount = Math.min(discount, roundMoney(Number(promo.max_discount_amount)));
    }
  } else {
    discount = roundMoney(Number(promo.discount_value) || 0);
  }

  return Math.min(discount, base);
}

type CountFn = {
  countActiveRedemptions: (promoId: string) => Promise<number>;
  countCustomerRedemptions: (promoId: string, customer: PromoCustomer) => Promise<number>;
  countPriorOrders: (customer: PromoCustomer) => Promise<number>;
};

export async function validatePromoCode(input: {
  promo: PromoCodeRow | null;
  codeInput: string;
  lines: PromoCartLine[];
  customer: PromoCustomer;
  now?: Date;
  counters: CountFn;
}): Promise<PromoValidationResult> {
  const code = normalizePromoCode(input.codeInput);
  if (!code) return { ok: false, error: "Enter a promo code." };

  const promo = input.promo;
  if (!promo || normalizePromoCode(promo.code) !== code) {
    return { ok: false, error: "This promo code is not valid." };
  }

  if (!promo.active) {
    return { ok: false, error: "This promo code is no longer active." };
  }

  const now = input.now || new Date();
  if (promo.starts_at && new Date(promo.starts_at) > now) {
    return { ok: false, error: "This promo code is not active yet." };
  }
  if (promo.ends_at && new Date(promo.ends_at) < now) {
    return { ok: false, error: "This promo code has expired." };
  }

  const { cartSubtotal, eligibleSubtotal } = eligibleSubtotalForPromo(promo, input.lines);
  const minOrder = roundMoney(Number(promo.min_order_amount) || 0);
  if (eligibleSubtotal < minOrder) {
    return {
      ok: false,
      error: `Add items worth at least ₹${minOrder.toLocaleString("en-IN")} that qualify for this offer.`,
    };
  }

  if (eligibleSubtotal <= 0) {
    return {
      ok: false,
      error: "No items in your cart qualify for this promo.",
    };
  }

  if (promo.usage_limit != null) {
    const used = await input.counters.countActiveRedemptions(promo.id);
    if (used >= promo.usage_limit) {
      return { ok: false, error: "This promo code has reached its usage limit." };
    }
  }

  if (promo.per_customer_limit != null) {
    const usedByCustomer = await input.counters.countCustomerRedemptions(
      promo.id,
      input.customer
    );
    if (usedByCustomer >= promo.per_customer_limit) {
      return { ok: false, error: "You have already used this promo code the maximum times." };
    }
  }

  if (promo.first_order_only) {
    const prior = await input.counters.countPriorOrders(input.customer);
    if (prior > 0) {
      return { ok: false, error: "This promo is only for first-time customers." };
    }
  }

  const discountAmount = computePromoDiscount(promo, eligibleSubtotal);
  if (discountAmount <= 0) {
    return { ok: false, error: "This promo does not reduce your total." };
  }

  const label =
    promo.discount_type === "percent"
      ? `${promo.discount_value}% off`
      : `₹${roundMoney(promo.discount_value).toLocaleString("en-IN")} off`;

  return {
    ok: true,
    promo,
    cartSubtotal,
    eligibleSubtotal,
    discountAmount,
    message: `${normalizePromoCode(promo.code)} applied — ${label} (₹${discountAmount.toLocaleString("en-IN")} saved).`,
  };
}

export function customerPhoneKey(phone?: string | null): string | null {
  return normalizePhoneKey(phone || "") || null;
}
