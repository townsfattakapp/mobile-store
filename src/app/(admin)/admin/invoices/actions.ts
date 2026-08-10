"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import {
  allocateProportionally,
  amountInWordsINR,
  calculateLineTax,
  formatInvoiceNumber,
  getFinancialYear,
  resolveState,
  round2,
} from "@/lib/invoice/gst";
import {
  DEFAULT_STORE_SETTINGS,
  documentTitle,
  normalizeAddress,
  type CustomerSnapshot,
  type InvoiceLineItem,
  type InvoiceTotals,
  type InvoiceType,
  type StoreSettings,
  type StoreSnapshot,
} from "@/lib/invoice/types";
import {
  sanitizeStorefrontProfile,
  parseInstagramReelUrls,
  writeStorefrontProfileToR2,
  type StorefrontProfile,
} from "@/lib/store/profile";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp/normalizeWhatsAppNumber";

export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.from("store_settings").select("*").limit(1).maybeSingle();
    if (error || !data) {
      return { ...DEFAULT_STORE_SETTINGS };
    }
    return {
      ...DEFAULT_STORE_SETTINGS,
      ...data,
      default_gst_rate: Number(data.default_gst_rate ?? 18),
      tax_inclusive_pricing: data.tax_inclusive_pricing ?? true,
      gst_registered: data.gst_registered ?? false,
      composition_scheme: data.composition_scheme ?? false,
      warranty_content:
        String(data.warranty_content || "").trim() || DEFAULT_STORE_SETTINGS.warranty_content,
      refund_policy_content:
        String(data.refund_policy_content || "").trim() ||
        DEFAULT_STORE_SETTINGS.refund_policy_content,
      shipping_policy_content:
        String(data.shipping_policy_content || "").trim() ||
        DEFAULT_STORE_SETTINGS.shipping_policy_content,
      contact_page_content:
        String(data.contact_page_content || "").trim() ||
        DEFAULT_STORE_SETTINGS.contact_page_content,
    };
  } catch {
    return { ...DEFAULT_STORE_SETTINGS };
  }
}

function profileFromSettings(merged: StoreSettings): StorefrontProfile {
  const addressLine =
    merged.address_line ||
    [merged.address_line1, merged.address_line2, merged.city, merged.state, merged.pin_code]
      .filter(Boolean)
      .join(", ");

  return sanitizeStorefrontProfile({
    brand_name: merged.brand_name || merged.trade_name || merged.legal_name || "Mahadev Mobiles",
    tagline: merged.tagline || undefined,
    business_hours: merged.business_hours || undefined,
    phone: merged.phone || undefined,
    email: merged.email || undefined,
    website: merged.website || undefined,
    address_line: addressLine || undefined,
    instagram_url: merged.instagram_url || undefined,
    whatsapp_url: merged.whatsapp_url || undefined,
    whatsapp_number: merged.whatsapp_number || undefined,
    instagram_reels: parseInstagramReelUrls(merged.instagram_reels),
    twitter_url: merged.twitter_url || undefined,
    facebook_url: merged.facebook_url || undefined,
    seo_title: merged.seo_title || undefined,
    seo_description: merged.seo_description || undefined,
    hero_eyebrow: merged.hero_eyebrow || undefined,
    hero_headline: merged.hero_headline || undefined,
    hero_subcopy: merged.hero_subcopy || undefined,
  });
}

export async function saveStoreSettings(payload: Partial<StoreSettings>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { error: "Forbidden" };
  }

  const current = await getStoreSettings();
  const merged = { ...current, ...payload };

  // Validate GSTIN if GST registered
  if (merged.gst_registered) {
    if (!merged.gstin || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(merged.gstin)) {
      return { error: "Enter a valid 15-character GSTIN when GST registered is enabled." };
    }
    if (merged.gstin.slice(0, 2) !== merged.state_code) {
      return { error: "GSTIN state code (first 2 digits) must match store state code." };
    }
  }

  const rawWhatsApp = String(merged.whatsapp_number || "").trim();
  let whatsapp_number: string | null = null;
  if (rawWhatsApp) {
    whatsapp_number = normalizeWhatsAppNumber(rawWhatsApp);
    if (!whatsapp_number) {
      return {
        error:
          "Enter a valid WhatsApp number with country code (e.g. 9876543210, +91 98765 43210, or 919876543210).",
      };
    }
  }
  merged.whatsapp_number = whatsapp_number;

  const coreRow: Record<string, unknown> = {
    legal_name: merged.legal_name,
    trade_name: merged.trade_name,
    address_line1: merged.address_line1,
    address_line2: merged.address_line2,
    city: merged.city,
    state: merged.state,
    state_code: merged.state_code,
    pin_code: merged.pin_code,
    phone: merged.phone,
    email: merged.email,
    website: merged.website,
    gstin: merged.gst_registered ? merged.gstin : null,
    pan: merged.pan,
    gst_registered: merged.gst_registered,
    composition_scheme: merged.composition_scheme,
    tax_inclusive_pricing: merged.tax_inclusive_pricing,
    default_hsn: merged.default_hsn,
    default_gst_rate: merged.default_gst_rate,
    invoice_prefix_gst: merged.invoice_prefix_gst,
    invoice_prefix_nongst: merged.invoice_prefix_nongst,
    bank_name: merged.bank_name,
    bank_account: merged.bank_account,
    bank_ifsc: merged.bank_ifsc,
    bank_branch: merged.bank_branch,
    terms: merged.terms,
    authorized_signatory: merged.authorized_signatory,
    logo_url: merged.logo_url,
    updated_at: new Date().toISOString(),
  };

  const brandingRow = {
    brand_name: merged.brand_name || merged.trade_name || merged.legal_name,
    tagline: merged.tagline,
    business_hours: merged.business_hours,
    address_line:
      merged.address_line ||
      [merged.address_line1, merged.address_line2, merged.city, merged.state, merged.pin_code]
        .filter(Boolean)
        .join(", "),
    instagram_url: merged.instagram_url,
    whatsapp_url: merged.whatsapp_url,
    whatsapp_number: merged.whatsapp_number || null,
    instagram_reels: Array.isArray(merged.instagram_reels)
      ? merged.instagram_reels.join("\n")
      : merged.instagram_reels,
    twitter_url: merged.twitter_url,
    facebook_url: merged.facebook_url,
    designed_by_name: "Evolw — Fattakse",
    designed_by_org: "A Unit of EVOLW",
    designed_by_url: "https://www.evolw.in",
    seo_title: merged.seo_title,
    seo_description: merged.seo_description,
    hero_eyebrow: merged.hero_eyebrow,
    hero_headline: merged.hero_headline,
    hero_subcopy: merged.hero_subcopy,
  };

  const cmsRow = {
    warranty_content: merged.warranty_content ?? null,
    refund_policy_content: merged.refund_policy_content ?? null,
    shipping_policy_content: merged.shipping_policy_content ?? null,
    contact_page_content: merged.contact_page_content ?? null,
  };

  // 1) Publish storefront profile to R2 (primary source for website)
  const published = await writeStorefrontProfileToR2(profileFromSettings(merged));
  if (!published.ok) {
    return { error: published.error };
  }

  // 2) Persist invoice/legal fields (+ branding / CMS columns when migration applied)
  const fullRow = { ...coreRow, ...brandingRow, ...cmsRow };

  if (current.id) {
    let { error } = await supabase.from("store_settings").update(fullRow).eq("id", current.id);
    if (error && /whatsapp_number/i.test(error.message)) {
      const { whatsapp_number: _wa, ...withoutWa } = brandingRow as any;
      ({ error } = await supabase
        .from("store_settings")
        .update({ ...coreRow, ...withoutWa, ...cmsRow })
        .eq("id", current.id));
    }
    if (error && /warranty_content|refund_policy_content|shipping_policy_content|contact_page_content/i.test(error.message)) {
      ({ error } = await supabase
        .from("store_settings")
        .update({ ...coreRow, ...brandingRow })
        .eq("id", current.id));
    }
    if (error && /column|brand_name|schema cache/i.test(error.message)) {
      // Branding columns not migrated yet — save core invoice fields only
      ({ error } = await supabase.from("store_settings").update(coreRow).eq("id", current.id));
    }
    if (error) return { error: error.message };
  } else {
    let { error } = await supabase.from("store_settings").insert(fullRow);
    if (error && /whatsapp_number/i.test(error.message)) {
      const { whatsapp_number: _wa, ...withoutWa } = brandingRow as any;
      ({ error } = await supabase
        .from("store_settings")
        .insert({ ...coreRow, ...withoutWa, ...cmsRow }));
    }
    if (error && /warranty_content|refund_policy_content|shipping_policy_content|contact_page_content/i.test(error.message)) {
      ({ error } = await supabase.from("store_settings").insert({ ...coreRow, ...brandingRow }));
    }
    if (error && /column|brand_name|schema cache/i.test(error.message)) {
      ({ error } = await supabase.from("store_settings").insert(coreRow));
    }
    if (error) return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/admin/settings");
  revalidatePath("/warranty");
  revalidatePath("/refund-policy");
  revalidatePath("/shipping-policy");
  revalidatePath("/contact");
  return { success: true };
}

async function nextSeq(supabase: any, fy: string, kind: "gst" | "nongst"): Promise<number> {
  // Prefer DB function for atomicity
  const { data, error } = await supabase.rpc("next_invoice_number", {
    p_fy: fy,
    p_kind: kind,
  });
  if (!error && typeof data === "number") return data;

  // Fallback: read/update sequence table
  const { data: existing } = await supabase
    .from("invoice_sequences")
    .select("last_number")
    .eq("financial_year", fy)
    .eq("invoice_kind", kind)
    .maybeSingle();

  const next = (existing?.last_number || 0) + 1;
  if (existing) {
    await supabase
      .from("invoice_sequences")
      .update({ last_number: next })
      .eq("financial_year", fy)
      .eq("invoice_kind", kind);
  } else {
    await supabase.from("invoice_sequences").insert({
      financial_year: fy,
      invoice_kind: kind,
      last_number: next,
    });
  }
  return next;
}

export type GenerateInvoiceInput = {
  orderId: string;
  mode: "gst" | "nongst" | "auto";
  buyerGstin?: string;
  notes?: string;
  reverseCharge?: boolean;
};

export async function generateInvoice(input: GenerateInvoiceInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Parallel auth + order + settings (was sequential round-trips)
  const [profileRes, orderRes, settingsRes, existingRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("orders").select("*, order_items(*)").eq("id", input.orderId).single(),
    supabase.from("store_settings").select("*").limit(1).maybeSingle(),
    supabase
      .from("invoices")
      .select("id, invoice_number, status")
      .eq("order_id", input.orderId)
      .neq("status", "cancelled")
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { error: "Forbidden" };
  }

  const { data: order, error: orderErr } = orderRes;
  if (orderErr || !order) return { error: "Order not found" };

  if (existingRes.data) {
    return {
      error: `Invoice already exists: ${existingRes.data.invoice_number}`,
      invoiceId: existingRes.data.id,
    };
  }

  const settings: StoreSettings = {
    ...DEFAULT_STORE_SETTINGS,
    ...(settingsRes.data || {}),
    default_gst_rate: Number(settingsRes.data?.default_gst_rate ?? 18),
    tax_inclusive_pricing: settingsRes.data?.tax_inclusive_pricing ?? true,
    gst_registered: settingsRes.data?.gst_registered ?? false,
    composition_scheme: settingsRes.data?.composition_scheme ?? false,
  };

  // Resolve GST vs Non-GST
  let isGst = false;
  let invoiceType: InvoiceType = "retail_invoice";

  if (input.mode === "gst") {
    if (!settings.gst_registered || !settings.gstin) {
      return { error: "Enable GST registration and save a valid GSTIN in Store Settings first." };
    }
    isGst = true;
    invoiceType = settings.composition_scheme ? "bill_of_supply" : "tax_invoice";
  } else if (input.mode === "nongst") {
    isGst = false;
    invoiceType = "retail_invoice";
  } else {
    // auto
    if (settings.gst_registered && settings.gstin && !settings.composition_scheme) {
      isGst = true;
      invoiceType = "tax_invoice";
    } else if (settings.gst_registered && settings.composition_scheme) {
      isGst = true;
      invoiceType = "bill_of_supply";
    } else {
      isGst = false;
      invoiceType = "retail_invoice";
    }
  }

  const addr = normalizeAddress(order.address_snapshot);
  const buyerState = resolveState(addr.state) || resolveState(settings.state) || { name: settings.state, code: settings.state_code };
  const sellerStateCode = settings.state_code;
  const buyerStateCode = buyerState.code;

  const buyerGstin = (input.buyerGstin || "").trim().toUpperCase() || null;
  if (buyerGstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(buyerGstin)) {
    return { error: "Buyer GSTIN is invalid." };
  }

  const taxInclusive = settings.tax_inclusive_pricing;
  const defaultRate = Number(settings.default_gst_rate) || 18;
  const applyGstBreakup = isGst && invoiceType === "tax_invoice";

  const orderItems = order.order_items || [];
  const rawLineTotals = orderItems.map((item: any) => {
    const lineTotal =
      Number(item.total_price) ||
      round2(Number(item.unit_price) * Number(item.quantity));
    return round2(Math.max(0, lineTotal));
  });

  // Order-level bill discount is NOT already in total_price — spread it so GST
  // is back-calculated from the amount actually collected per line.
  const billDiscount = round2(Math.max(0, Number(order.discount) || 0));
  const billShares = allocateProportionally(rawLineTotals, billDiscount);

  const items: InvoiceLineItem[] = [];
  let itemsTaxable = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let itemsDiscount = 0;
  let chargedLines = 0;

  for (let idx = 0; idx < orderItems.length; idx++) {
    const item = orderItems[idx];
    const lineBeforeBill = rawLineTotals[idx];
    const billShare = Math.min(lineBeforeBill, billShares[idx] || 0);
    const lineTotal = round2(lineBeforeBill - billShare);
    const lineDiscOnly = round2(Math.max(0, Number(item.discount) || 0));
    const discount = round2(lineDiscOnly + billShare);
    itemsDiscount += discount;
    chargedLines = round2(chargedLines + lineTotal);

    // Prefer item tax_rate; fall back to store default; Non-GST / BoS → 0 for tax columns
    const rawRate = Number(item.tax_rate) > 0 ? Number(item.tax_rate) : defaultRate;
    const taxRate = applyGstBreakup ? rawRate : 0;

    const tax = applyGstBreakup
      ? calculateLineTax({
          lineTotal,
          taxRate,
          taxInclusive,
          sellerStateCode,
          buyerStateCode,
        })
      : {
          taxableAmount: round2(lineTotal),
          taxAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          cgstRate: 0,
          sgstRate: 0,
          igstRate: 0,
          supplyType: "intra" as const,
        };

    itemsTaxable += tax.taxableAmount;
    cgstTotal += tax.cgst;
    sgstTotal += tax.sgst;
    igstTotal += tax.igst;

    items.push({
      product_name: item.product_name,
      variant_name: item.variant_name,
      sku: item.sku,
      hsn: settings.default_hsn || "8517",
      quantity: Number(item.quantity),
      unit: "Nos",
      unit_price: Number(item.unit_price),
      discount,
      tax_rate: applyGstBreakup ? rawRate : 0,
      line_total: lineTotal,
      taxable_amount: tax.taxableAmount,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      cgst_rate: tax.cgstRate,
      sgst_rate: tax.sgstRate,
      igst_rate: tax.igstRate,
    });
  }

  // Shipping
  const shippingCharge = round2(Number(order.shipping_charge) || 0);
  let shippingTaxable = 0;
  let shippingCgst = 0;
  let shippingSgst = 0;
  let shippingIgst = 0;

  if (shippingCharge > 0) {
    if (applyGstBreakup) {
      const shipTax = calculateLineTax({
        lineTotal: shippingCharge,
        taxRate: defaultRate,
        taxInclusive,
        sellerStateCode,
        buyerStateCode,
      });
      shippingTaxable = shipTax.taxableAmount;
      shippingCgst = shipTax.cgst;
      shippingSgst = shipTax.sgst;
      shippingIgst = shipTax.igst;
      cgstTotal += shipTax.cgst;
      sgstTotal += shipTax.sgst;
      igstTotal += shipTax.igst;
    } else {
      shippingTaxable = round2(shippingCharge);
    }
  }

  cgstTotal = round2(cgstTotal);
  sgstTotal = round2(sgstTotal);
  igstTotal = round2(igstTotal);
  itemsTaxable = round2(itemsTaxable);
  const taxTotal = round2(cgstTotal + sgstTotal + igstTotal);

  // Amount customer actually paid (order of record)
  let grandTotal = round2(Number(order.grand_total) || 0);

  // Exclusive GST: order totals usually omit tax — invoice total must include it
  if (applyGstBreakup && !taxInclusive) {
    grandTotal = round2(chargedLines + shippingCharge + taxTotal);
  }

  // Inclusive / retail: charged lines + shipping should match collection; absorb paise drift
  let roundOff = 0;
  if (taxInclusive || !applyGstBreakup) {
    const rebuilt = round2(chargedLines + shippingCharge);
    roundOff = round2(grandTotal - rebuilt);
    if (grandTotal <= 0) {
      grandTotal = rebuilt;
      roundOff = 0;
    }
  }

  const supplyType = !applyGstBreakup
    ? "na"
    : sellerStateCode === buyerStateCode
      ? "intra"
      : "inter";

  const totals: InvoiceTotals = {
    items_taxable: itemsTaxable,
    discount: round2(itemsDiscount),
    round_off: roundOff,
    shipping_charge: shippingCharge,
    shipping_taxable: round2(shippingTaxable),
    shipping_cgst: round2(shippingCgst),
    shipping_sgst: round2(shippingSgst),
    shipping_igst: round2(shippingIgst),
    cgst_total: cgstTotal,
    sgst_total: sgstTotal,
    igst_total: igstTotal,
    tax_total: taxTotal,
    grand_total: grandTotal,
    amount_in_words: amountInWordsINR(grandTotal),
    tax_inclusive: taxInclusive,
  };

  // Persist computed tax on the order for reports (best-effort, parallel with seq)
  const fy = getFinancialYear(new Date());
  const kind = isGst ? "gst" : "nongst";
  const prefix = isGst ? settings.invoice_prefix_gst : settings.invoice_prefix_nongst;

  const [, seq] = await Promise.all([
    supabase.from("orders").update({ tax_total: taxTotal }).eq("id", order.id),
    nextSeq(supabase, fy, kind),
  ]);
  const invoiceNumber = formatInvoiceNumber(prefix || (isGst ? "GST" : "BILL"), fy, seq);

  const storeSnapshot: StoreSnapshot = {
    ...settings,
    document_title: documentTitle(invoiceType, isGst),
  };

  const customerSnapshot: CustomerSnapshot = {
    ...addr,
    state: buyerState.name,
    state_code: buyerStateCode,
    gstin: buyerGstin,
    place_of_supply_state: buyerState.name,
    place_of_supply_code: buyerStateCode,
  };

  const payload = {
    invoice_number: invoiceNumber,
    order_id: order.id,
    invoice_date: new Date().toISOString(),
    invoice_type: invoiceType,
    is_gst: isGst,
    financial_year: fy,
    place_of_supply_state: buyerState.name,
    place_of_supply_code: buyerStateCode,
    supply_type: supplyType,
    reverse_charge: Boolean(input.reverseCharge),
    buyer_gstin: buyerGstin,
    store_snapshot: storeSnapshot,
    customer_snapshot: customerSnapshot,
    items_snapshot: items,
    totals_snapshot: totals,
    status: "issued",
    notes: input.notes || null,
    created_by: user.id,
  };

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert(payload)
    .select("id, invoice_number")
    .single();

  if (invErr) {
    // Helpful message if migration not applied
    if (invErr.message?.includes("store_settings") || invErr.message?.includes("invoice_type") || invErr.message?.includes("items_snapshot")) {
      return {
        error: `Database schema missing GST invoice columns. Run supabase/migrations/01_invoices_gst.sql in Supabase. Details: ${invErr.message}`,
      };
    }
    return { error: invErr.message };
  }

  return { success: true, invoiceId: invoice.id, invoiceNumber: invoice.invoice_number };
}

export async function cancelInvoice(invoiceId: string, reason: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { error: "Forbidden" };
  }

  if (!reason?.trim()) return { error: "Cancellation reason is required." };

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason.trim(),
    })
    .eq("id", invoiceId)
    .eq("status", "issued");

  if (error) return { error: error.message };
  return { success: true };
}

export async function listInvoices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      invoice_date,
      invoice_type,
      is_gst,
      status,
      financial_year,
      buyer_gstin,
      totals_snapshot,
      customer_snapshot,
      store_snapshot,
      order_id,
      created_at,
      orders ( id, order_number, payment_method, payment_status, status )
    `)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, invoices: [] };
  return { invoices: data || [] };
}

export async function getInvoice(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      orders ( id, order_number, payment_method, payment_status, status, created_at )
    `)
    .eq("id", id)
    .single();

  if (error) return { error: error.message, invoice: null };
  return { invoice: data };
}

export async function getOrderForInvoice(orderId: string) {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();

  if (error || !order) return { error: "Order not found", order: null };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, status")
    .eq("order_id", orderId)
    .neq("status", "cancelled")
    .maybeSingle();

  return { order, existingInvoice: invoice };
}

export async function listOrdersWithoutInvoice() {
  const supabase = await createClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, grand_total, created_at, address_snapshot, status, payment_status")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { error: error.message, orders: [] };

  const { data: invoices } = await supabase
    .from("invoices")
    .select("order_id")
    .neq("status", "cancelled");

  const invoiced = new Set((invoices || []).map((i: any) => i.order_id));
  return {
    orders: (orders || []).filter((o) => !invoiced.has(o.id)),
  };
}
