/** Generate a short referral code like RAHUL82 */
export function generateReferralCode(fullName?: string | null): string {
  const base = String(fullName || "USER")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  const prefix = base.length >= 2 ? base : "USER";
  const suffix = Math.floor(10 + Math.random() * 90).toString();
  return `${prefix}${suffix}`;
}

export function normalizeReferralCode(raw?: string | null): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}
