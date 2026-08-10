/** Safe public display name — never expose email/phone. */
export function safeDisplayName(
  fullName?: string | null,
  email?: string | null
): string {
  const name = String(fullName || "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      const p = parts[0];
      return p.length <= 2 ? p : `${p[0]}${"*".repeat(Math.min(3, p.length - 1))}`;
    }
    const first = parts[0];
    const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || "";
    return `${first} ${lastInitial}.`;
  }

  const local = String(email || "")
    .split("@")[0]
    ?.trim();
  if (local && local.length >= 2) {
    return `${local.slice(0, 1).toUpperCase()}${local.slice(1, 3)}***`;
  }
  return "Participant";
}
