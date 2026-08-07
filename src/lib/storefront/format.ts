export function formatINR(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

export function cleanProductName(name: string) {
  return (name || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function discountAmount(mrp: number, price: number) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(mrp - price);
}

export function discountPercent(mrp: number, price: number) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function brandLabel(brand: unknown): string | null {
  if (!brand) return null;
  if (Array.isArray(brand)) return brand[0]?.name ?? null;
  if (typeof brand === "object" && brand !== null && "name" in brand) {
    return String((brand as { name?: string }).name || "") || null;
  }
  return null;
}
