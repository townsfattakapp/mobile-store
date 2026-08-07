export type InvoiceType = "tax_invoice" | "bill_of_supply" | "retail_invoice";
export type InvoiceStatus = "issued" | "cancelled";
export type SupplyType = "intra" | "inter" | "na";

export type StoreSettings = {
  id?: string;
  legal_name: string;
  trade_name: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  state_code: string;
  pin_code: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstin: string | null;
  pan: string | null;
  gst_registered: boolean;
  composition_scheme: boolean;
  tax_inclusive_pricing: boolean;
  default_hsn: string;
  default_gst_rate: number;
  invoice_prefix_gst: string;
  invoice_prefix_nongst: string;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  bank_branch: string | null;
  terms: string | null;
  authorized_signatory: string | null;
  logo_url: string | null;
  // Storefront branding (optional DB columns — also mirrored to R2)
  brand_name?: string | null;
  tagline?: string | null;
  business_hours?: string | null;
  address_line?: string | null;
  instagram_url?: string | null;
  whatsapp_url?: string | null;
  /** Newline-separated Instagram reel URLs (admin textarea) */
  instagram_reels?: string | string[] | null;
  twitter_url?: string | null;
  facebook_url?: string | null;
  designed_by_name?: string | null;
  designed_by_org?: string | null;
  designed_by_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  hero_eyebrow?: string | null;
  hero_headline?: string | null;
  hero_subcopy?: string | null;
};

export type InvoiceLineItem = {
  product_name: string;
  variant_name: string | null;
  sku: string;
  hsn: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  tax_rate: number;
  line_total: number; // what customer paid for this line (qty * unit after discount)
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
};

export type InvoiceTotals = {
  items_taxable: number;
  discount: number;
  /** Paise adjustment so taxable + tax (+ shipping) reconciles with amount collected */
  round_off: number;
  shipping_charge: number;
  shipping_taxable: number;
  shipping_cgst: number;
  shipping_sgst: number;
  shipping_igst: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  tax_total: number;
  grand_total: number;
  amount_in_words: string;
  tax_inclusive: boolean;
};

export type StoreSnapshot = StoreSettings & {
  document_title: string;
};

export type CustomerSnapshot = {
  full_name: string;
  mobile_number: string;
  email: string | null;
  address_line: string;
  city: string;
  state: string;
  state_code: string;
  pin_code: string;
  gstin: string | null;
  place_of_supply_state: string;
  place_of_supply_code: string;
};

export type InvoiceRecord = {
  id: string;
  invoice_number: string;
  order_id: string;
  invoice_date: string;
  invoice_type: InvoiceType;
  is_gst: boolean;
  financial_year: string | null;
  place_of_supply_state: string | null;
  place_of_supply_code: string | null;
  supply_type: SupplyType | null;
  reverse_charge: boolean;
  buyer_gstin: string | null;
  store_snapshot: StoreSnapshot;
  customer_snapshot: CustomerSnapshot;
  items_snapshot: InvoiceLineItem[];
  totals_snapshot: InvoiceTotals;
  status: InvoiceStatus;
  cancelled_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
  orders?: {
    id: string;
    order_number: string;
    payment_method: string;
    payment_status: string;
    status: string;
  } | null;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  legal_name: "Mahadev Mobiles",
  trade_name: "Mahadev Mobiles",
  address_line1: "Old Bus Stop",
  address_line2: "Tiroda",
  city: "Tiroda",
  state: "Maharashtra",
  state_code: "27",
  pin_code: "441911",
  phone: "085529 11313",
  email: null,
  website: null,
  gstin: null,
  pan: null,
  gst_registered: false,
  composition_scheme: false,
  tax_inclusive_pricing: true,
  default_hsn: "8517",
  default_gst_rate: 18,
  invoice_prefix_gst: "GST",
  invoice_prefix_nongst: "BILL",
  bank_name: null,
  bank_account: null,
  bank_ifsc: null,
  bank_branch: null,
  terms: "Goods once sold will not be taken back. Subject to local jurisdiction.",
  authorized_signatory: "Authorized Signatory",
  logo_url: null,
  brand_name: "Mahadev Mobiles",
  tagline:
    "Your trusted mobile store in Tiroda — new launches, quality-checked pre-owned phones, and genuine accessories.",
  business_hours: "Mon–Sat · 10:00 AM – 8:00 PM IST",
  address_line: "Old Bus Stop, Tiroda, Maharashtra 441911",
  instagram_url: "https://www.instagram.com/mahadevmobiletirora/",
  whatsapp_url: "https://chat.whatsapp.com/CFqzB24oVG004N7Haxtp2Q",
  instagram_reels: [],
  twitter_url: null,
  facebook_url: null,
  designed_by_name: "Evolw — Fattakse",
  designed_by_org: "A Unit of EVOLW",
  designed_by_url: "https://www.evolw.in",
  seo_title: "Mahadev Mobiles — Phones & Accessories in Tiroda",
  seo_description:
    "Mahadev Mobiles, Old Bus Stop, Tiroda. Shop new and certified pre-owned mobiles, accessories, and spare parts. Call 085529 11313.",
  hero_eyebrow: "Mahadev Mobiles · Tiroda",
  hero_headline: "Upgrade what you carry every day.",
  hero_subcopy:
    "New launches and quality-checked pre-owned phones — priced clearly, chosen carefully for Tiroda.",
};

export function normalizeAddress(snapshot: any) {
  return {
    full_name: snapshot?.full_name || snapshot?.fullName || "Customer",
    mobile_number: snapshot?.mobile_number || snapshot?.phone || snapshot?.mobile || "",
    email: snapshot?.email || null,
    address_line: snapshot?.address_line || snapshot?.address || "",
    city: snapshot?.city || "",
    state: snapshot?.state || "",
    pin_code: snapshot?.pin_code || snapshot?.pinCode || "",
  };
}

export function documentTitle(type: InvoiceType, isGst: boolean): string {
  if (type === "tax_invoice") return "TAX INVOICE";
  if (type === "bill_of_supply") return "BILL OF SUPPLY";
  if (isGst) return "TAX INVOICE";
  return "RETAIL INVOICE";
}
