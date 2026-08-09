import { resolveSellerWhatsAppNumber } from "./normalizeWhatsAppNumber";

export type WhatsAppProductMessageInput = {
  productName: string;
  brandName?: string | null;
  storeName?: string | null;
  /** Human variant label, e.g. "12GB + 256GB" or selected variant.name */
  variantLabel?: string | null;
  ram?: string | null;
  storage?: string | null;
  color?: string | null;
  cpu?: string | null;
  displaySize?: string | null;
  price?: number | null;
  productUrl: string;
};

function clean(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s || /^undefined$/i.test(s) || /^null$/i.test(s)) return "";
  return s;
}

function formatInr(price: number): string {
  return `₹${Math.round(price).toLocaleString("en-IN")}`;
}

/**
 * Build a short, reviewable WhatsApp enquiry for the currently selected config.
 */
export function buildWhatsAppProductMessage(
  input: WhatsAppProductMessageInput
): string {
  const name = clean(input.productName);
  const brand = clean(input.brandName);
  const titled =
    brand && name && !new RegExp(`^${brand}\\b`, "i").test(name)
      ? `${brand} ${name}`
      : name || brand || "this product";

  const lines: string[] = [
    "Hi 👋",
    "",
    `I'm interested in *${titled}*.`,
    "",
  ];

  const storage = clean(input.storage);
  const ram = clean(input.ram);
  const color = clean(input.color);
  const cpu = clean(input.cpu);
  const display = clean(input.displaySize);
  const variantLabel = clean(input.variantLabel);

  // Prefer structured axes; otherwise fall back to a single variant label
  const hasAxes = Boolean(storage || ram || color || cpu || display);
  if (hasAxes) {
    if (cpu) lines.push(`Processor: ${cpu}`);
    if (display) lines.push(`Display: ${display}`);
    if (ram && storage) lines.push(`Variant: ${ram} + ${storage}`);
    else if (storage) lines.push(`Storage: ${storage}`);
    else if (ram) lines.push(`RAM: ${ram}`);
    if (color) lines.push(`Color: ${color}`);
  } else if (variantLabel && !/^standard$/i.test(variantLabel)) {
    lines.push(`Variant: ${variantLabel}`);
  }

  const price = Number(input.price);
  if (Number.isFinite(price) && price > 0) {
    lines.push(`Price: ${formatInr(price)}`);
  }

  const url = clean(input.productUrl);
  if (url && !/localhost|127\.0\.0\.1/i.test(url)) {
    lines.push("", "Product:", url);
  }

  lines.push(
    "",
    "Is this currently available?",
    "Please share the best price.",
    "",
    "Thanks!"
  );

  return lines.join("\n");
}

export function buildWhatsAppUrl(opts: {
  phone: string;
  message: string;
}): string | null {
  const phone = resolveSellerWhatsAppNumber({ whatsapp_number: opts.phone });
  if (!phone) return null;
  const text = encodeURIComponent(opts.message || "");
  return `https://wa.me/${phone}?text=${text}`;
}

export function buildProductWhatsAppHref(opts: {
  seller: {
    whatsapp_number?: string | null;
    phone?: string | null;
    whatsapp_url?: string | null;
  };
  messageInput: WhatsAppProductMessageInput;
}): string | null {
  const phone = resolveSellerWhatsAppNumber(opts.seller);
  if (!phone) return null;
  const message = buildWhatsAppProductMessage(opts.messageInput);
  return buildWhatsAppUrl({ phone, message });
}
