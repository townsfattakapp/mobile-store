/** Indian GST helpers — state codes, FY, tax split, amount in words */

export const INDIAN_STATES: { name: string; code: string }[] = [
  { name: "Andaman and Nicobar Islands", code: "35" },
  { name: "Andhra Pradesh", code: "37" },
  { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" },
  { name: "Bihar", code: "10" },
  { name: "Chandigarh", code: "04" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "26" },
  { name: "Delhi", code: "07" },
  { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" },
  { name: "Haryana", code: "06" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Jammu and Kashmir", code: "01" },
  { name: "Jharkhand", code: "20" },
  { name: "Karnataka", code: "29" },
  { name: "Kerala", code: "32" },
  { name: "Ladakh", code: "38" },
  { name: "Lakshadweep", code: "31" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" },
  { name: "Manipur", code: "14" },
  { name: "Meghalaya", code: "17" },
  { name: "Mizoram", code: "15" },
  { name: "Nagaland", code: "13" },
  { name: "Odisha", code: "21" },
  { name: "Puducherry", code: "34" },
  { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" },
  { name: "Sikkim", code: "11" },
  { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" },
  { name: "Tripura", code: "16" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "Uttarakhand", code: "05" },
  { name: "West Bengal", code: "19" },
];

const STATE_ALIASES: Record<string, string> = {
  mh: "Maharashtra",
  maharashtra: "Maharashtra",
  dl: "Delhi",
  delhi: "Delhi",
  nct: "Delhi",
  "new delhi": "Delhi",
  ka: "Karnataka",
  karnataka: "Karnataka",
  tn: "Tamil Nadu",
  "tamil nadu": "Tamil Nadu",
  ts: "Telangana",
  telangana: "Telangana",
  ap: "Andhra Pradesh",
  "andhra pradesh": "Andhra Pradesh",
  gj: "Gujarat",
  gujarat: "Gujarat",
  rj: "Rajasthan",
  rajasthan: "Rajasthan",
  up: "Uttar Pradesh",
  "uttar pradesh": "Uttar Pradesh",
  wb: "West Bengal",
  "west bengal": "West Bengal",
  kl: "Kerala",
  kerala: "Kerala",
  pb: "Punjab",
  punjab: "Punjab",
  hr: "Haryana",
  haryana: "Haryana",
  mp: "Madhya Pradesh",
  "madhya pradesh": "Madhya Pradesh",
  br: "Bihar",
  bihar: "Bihar",
  od: "Odisha",
  orissa: "Odisha",
  odisha: "Odisha",
  as: "Assam",
  assam: "Assam",
  jk: "Jammu and Kashmir",
  goa: "Goa",
  ga: "Goa",
};

export function resolveState(input?: string | null): { name: string; code: string } | null {
  if (!input?.trim()) return null;
  const raw = input.trim();
  // Already a 2-digit code
  if (/^\d{2}$/.test(raw)) {
    const found = INDIAN_STATES.find((s) => s.code === raw);
    return found || null;
  }
  const key = raw.toLowerCase();
  const aliased = STATE_ALIASES[key] || raw;
  const found = INDIAN_STATES.find(
    (s) => s.name.toLowerCase() === aliased.toLowerCase() || s.name.toLowerCase().includes(key)
  );
  return found || null;
}

/** Indian FY: Apr–Mar → "2026-27" */
export function getFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  if (month >= 3) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Split `total` across `weights` in proportion, paise-exact (last line absorbs remainder).
 */
export function allocateProportionally(weights: number[], total: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const safeTotal = round2(Math.max(0, total));
  if (safeTotal <= 0) return weights.map(() => 0);

  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (sum <= 0) return weights.map(() => 0);

  const out: number[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      out.push(round2(safeTotal - allocated));
    } else {
      const share = round2((Math.max(0, weights[i]) / sum) * safeTotal);
      out.push(share);
      allocated = round2(allocated + share);
    }
  }
  return out;
}

export type TaxBreakdown = {
  taxableAmount: number;
  taxAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  supplyType: "intra" | "inter";
};

/**
 * Split line total into taxable + GST.
 * taxInclusive: selling price already includes GST (typical Indian retail MRP).
 */
export function calculateLineTax(opts: {
  lineTotal: number;
  taxRate: number;
  taxInclusive: boolean;
  sellerStateCode: string;
  buyerStateCode: string;
}): TaxBreakdown {
  const rate = opts.taxRate || 0;
  const isIntra = opts.sellerStateCode === opts.buyerStateCode;

  let taxableAmount: number;
  let taxAmount: number;

  if (rate <= 0) {
    taxableAmount = round2(opts.lineTotal);
    taxAmount = 0;
  } else if (opts.taxInclusive) {
    taxableAmount = round2(opts.lineTotal / (1 + rate / 100));
    taxAmount = round2(opts.lineTotal - taxableAmount);
  } else {
    taxableAmount = round2(opts.lineTotal);
    taxAmount = round2((opts.lineTotal * rate) / 100);
  }

  if (isIntra) {
    const half = round2(taxAmount / 2);
    // Adjust remainder on CGST so halves sum to taxAmount
    const cgst = half;
    const sgst = round2(taxAmount - half);
    return {
      taxableAmount,
      taxAmount,
      cgst,
      sgst,
      igst: 0,
      cgstRate: rate / 2,
      sgstRate: rate / 2,
      igstRate: 0,
      supplyType: "intra",
    };
  }

  return {
    taxableAmount,
    taxAmount,
    cgst: 0,
    sgst: 0,
    igst: taxAmount,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: rate,
    supplyType: "inter",
  };
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ""}`.trim();
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h && rest) return `${ONES[h]} Hundred ${twoDigits(rest)}`;
  if (h) return `${ONES[h]} Hundred`;
  return twoDigits(rest);
}

/** Indian numbering: Crore / Lakh / Thousand */
export function amountInWordsINR(amount: number): string {
  if (!Number.isFinite(amount)) return "Zero Rupees Only";
  const rounded = Math.round(amount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  let n = rupees;
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let words = parts.join(" ").replace(/\s+/g, " ").trim();
  words = words ? `${words} Rupees` : "Zero Rupees";
  if (paise > 0) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatINRPlain(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatInvoiceNumber(prefix: string, fy: string, seq: number): string {
  return `${prefix}/${fy}/${String(seq).padStart(6, "0")}`;
}
