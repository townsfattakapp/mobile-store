/**
 * Normalize phone digits for https://wa.me/{number}
 * Returns digits-only international number, or null if invalid.
 */
export function normalizeWhatsAppNumber(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Reject group invite / generic web URLs without a phone
  if (/chat\.whatsapp\.com/i.test(s) && !/wa\.me\/\d+/i.test(s)) {
    return null;
  }

  // Pull digits out of wa.me / api.whatsapp.com links when pasted into the field
  const fromUrl =
    s.match(/(?:wa\.me|api\.whatsapp\.com\/send\/?\?phone=)\/?(\d{10,15})/i) ||
    s.match(/[?&]phone=(\d{10,15})/i);
  if (fromUrl) s = fromUrl[1];

  // Keep leading + only long enough to detect country code, then strip non-digits
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;

  // Indian mobile: 10 digits starting 6–9
  if (/^[6-9]\d{9}$/.test(digits)) {
    return `91${digits}`;
  }

  // Indian with leading 0: 0XXXXXXXXXX
  if (/^0[6-9]\d{9}$/.test(digits)) {
    return `91${digits.slice(1)}`;
  }

  // Already has country code (E.164 without +): 11–15 digits
  if (/^\d{11,15}$/.test(digits)) {
    // Avoid double-prefix: 9191XXXXXXXX → keep as-is only if valid length
    if (/^91[6-9]\d{9}$/.test(digits)) return digits;
    if (/^91\d{10}$/.test(digits)) return digits;
    return digits;
  }

  return null;
}

/**
 * Resolve the storefront seller WhatsApp number from store settings / profile.
 * Prefer dedicated whatsapp_number, then wa.me phone in whatsapp_url, then phone.
 */
export function resolveSellerWhatsAppNumber(input: {
  whatsapp_number?: string | null;
  phone?: string | null;
  whatsapp_url?: string | null;
}): string | null {
  const dedicated = normalizeWhatsAppNumber(input.whatsapp_number);
  if (dedicated) return dedicated;

  const url = String(input.whatsapp_url || "").trim();
  if (url && !/chat\.whatsapp\.com/i.test(url)) {
    const fromLink = normalizeWhatsAppNumber(url);
    if (fromLink) return fromLink;
  }

  return normalizeWhatsAppNumber(input.phone);
}
