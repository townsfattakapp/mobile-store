/** Normalize IN phone numbers to a 10-digit key for walk-in CRM grouping. */
export function normalizePhoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // Prefer last 10 digits (strip +91 / 0 prefix)
  if (digits.length >= 10) return digits.slice(-10);
  if (digits.length >= 8) return digits; // short / incomplete still groupable
  return null;
}

export function formatPhoneDisplay(phoneKey: string, fallback?: string | null): string {
  if (fallback && /\d/.test(fallback)) return fallback.trim();
  if (phoneKey.length === 10) return `+91 ${phoneKey.slice(0, 5)} ${phoneKey.slice(5)}`;
  return phoneKey;
}

export function isWalkInOrder(order: {
  user_id?: string | null;
  notes?: string | null;
  address_snapshot?: any;
}): boolean {
  if (order.user_id) return false;
  if (/walk-?in|pos/i.test(order.notes || "")) return true;
  const snap = order.address_snapshot || {};
  if (snap.type === "walkin") return true;
  if (/store walk-?in/i.test(String(snap.address_line || ""))) return true;
  // Any guest order (checkout without account) counts as walk-in/guest
  return true;
}
