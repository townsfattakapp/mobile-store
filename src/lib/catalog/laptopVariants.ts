/**
 * Laptop product standards — distinct from phone color×storage matrix.
 * Config axes: CPU · RAM · SSD · display size · color (when known).
 */

export type LaptopVariantConfig = {
  cpu: string;
  ram: string;
  storage: string;
  display_size: string;
  color: string;
  mrp?: number;
  selling_price?: number;
  reference_image_url?: string;
  /** Optional OEM SKU */
  sku?: string;
};

const LAPTOP_BLOB =
  /\b(laptop|notebook|macbook|imac|mac\s*mini|mac\s*studio|mac\s*pro|chromebook|thinkpad|thinkbook|ideapad|inspiron|vostro|latitude|xps|alienware|vivobook|zenbook|expertbook|tuf|rog\b|pavilion|omnibook|victus|omen|swift|aspire|nitro|predator|travelmate|legion|loq\b|galaxy\s*book|surface\s*laptop|gram\b)\b/i;

export function isLaptopBlob(...parts: Array<string | null | undefined>): boolean {
  return LAPTOP_BLOB.test(parts.filter(Boolean).join(" "));
}

export function normalizeRam(raw: string): string {
  const m = String(raw || "")
    .replace(/,/g, "")
    .match(/(\d+)\s*(gb|tb)/i);
  if (!m) return String(raw || "").trim();
  const n = parseInt(m[1], 10);
  const unit = m[2].toUpperCase();
  return `${n}${unit}`;
}

export function normalizeStorage(raw: string): string {
  const m = String(raw || "")
    .replace(/,/g, "")
    .match(/(\d+(?:\.\d+)?)\s*(gb|tb)/i);
  if (!m) return String(raw || "").trim();
  let n = parseFloat(m[1]);
  let unit = m[2].toUpperCase();
  // Heuristic: 1–2 digit GB values that look like RAM shouldn't become SSD
  if (unit === "GB" && n <= 64 && !/ssd|hdd|storage|nvme/i.test(raw)) {
    // leave as-is; caller decides
  }
  if (unit === "TB" && n < 10) return `${n}TB`.replace(/\.0TB$/, "TB");
  return `${Math.round(n)}${unit}`;
}

export function normalizeDisplaySize(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  // 39.62 cm / 15.6 inch / 16″ / 14" / 16-inch
  const inch = s.match(/(\d{1,2}(?:\.\d+)?)\s*(?:\"|″|''|-?inch|\bin\b)/i);
  if (inch) return `${inch[1]}″`;
  const cm = s.match(/(\d{2}(?:\.\d+)?)\s*cm/i);
  if (cm) {
    const inches = (parseFloat(cm[1]) / 2.54).toFixed(1).replace(/\.0$/, "");
    return `${inches}″`;
  }
  if (/^\d{1,2}(?:\.\d+)?$/.test(s)) return `${s}″`;
  return s;
}

export function normalizeCpu(raw: string): string {
  let s = String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/\|/g, " ")
    .trim();
  if (!s) return "";
  // Common compact forms from Samsung/ASUS titles
  s = s
    .replace(/\bintel\s*core[™\s]*ultra\s*/i, "Intel Core Ultra ")
    .replace(/\bcore[™\s]*ultra\s*/i, "Core Ultra ")
    .replace(/\bintel\s*core[™\s]*i([3579])\b/i, "Intel Core i$1")
    .replace(/\bi([3579])-(\d{4,5}\w*)/i, "Intel Core i$1-$2")
    .replace(/\bryzen\s*/i, "Ryzen ")
    .replace(/\bsnapdragon\s*/i, "Snapdragon ")
    .replace(/\bm([1-4])\s*(pro|max|ultra)?\b/i, (_, n, t) =>
      `Apple M${n}${t ? ` ${t[0].toUpperCase()}${t.slice(1)}` : ""}`
    )
    .replace(/\bu([579])\b/i, "Ultra $1")
    .trim();
  return s.slice(0, 80);
}

/**
 * Pull laptop config tokens from a marketing title / URL slug / description.
 */
export function parseLaptopConfigFromText(text: string): Partial<LaptopVariantConfig> {
  const t = String(text || "").replace(/\u00A0/g, " ");
  const out: Partial<LaptopVariantConfig> = {};

  const display =
    t.match(/(\d{2}(?:\.\d+)?)\s*cm/i) ||
    t.match(/(\d{1,2}(?:\.\d+)?)\s*(?:\"|″|''|-?inch|\bin\b)/i) ||
    t.match(/\b(\d{2}(?:\.\d+)?)-inch\b/i);
  if (display) out.display_size = normalizeDisplaySize(display[0]);

  // Prefer larger GB/TB as storage, smaller commonly-RAM sizes as RAM when both present
  const memAll = [...t.matchAll(/(\d+)\s*(GB|TB)\b/gi)].map((m) => ({
    n: parseInt(m[1], 10),
    unit: m[2].toUpperCase(),
    raw: m[0],
  }));
  const ramCand = memAll.find(
    (m) => m.unit === "GB" && m.n >= 4 && m.n <= 128 && m.n % 2 === 0
  );
  const storageCand =
    memAll.find((m) => m.unit === "TB") ||
    [...memAll].reverse().find((m) => m.unit === "GB" && m.n >= 128);

  if (ramCand) out.ram = normalizeRam(ramCand.raw);
  if (storageCand && (!ramCand || storageCand.raw !== ramCand.raw)) {
    out.storage = normalizeStorage(storageCand.raw);
  }

  const cpuPatterns = [
    /(?:intel\s*)?core\s*ultra\s*[3579][^\s,]{0,20}/i,
    /(?:intel\s*)?core\s*i[3579](?:-\d{4,5}\w*)?/i,
    /ryzen\s*[3579]\s*\d{3,5}\w*(?:\s*hx|\s*hs|\s*u)?/i,
    /snapdragon\s*[x\d][^\s,]{0,16}/i,
    /apple\s*m[1-4](?:\s*(?:pro|max|ultra))?/i,
    /\bm[1-4]\s*(?:pro|max|ultra)\b/i,
    /\bultra\s*[3579]\b/i,
    /\bi[3579](?:-\d{4,5}\w*)?\b/i,
  ];
  for (const re of cpuPatterns) {
    const m = t.match(re);
    if (m) {
      out.cpu = normalizeCpu(m[0]);
      break;
    }
  }

  const colorHints =
    t.match(
      /\b(silver|gray|grey|black|white|blue|midnight|starlight|platinum|graphite|sage|gold|beige|natural|sky|glacier|eclipse|mecha\s*gray|cool\s*silver)\b/i
    );
  if (colorHints) {
    out.color = colorHints[1]
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return out;
}

export function laptopVariantName(v: Partial<LaptopVariantConfig>): string {
  const bits = [
    v.cpu,
    v.ram ? `${v.ram} RAM` : "",
    v.storage ? `${v.storage} SSD` : "",
    v.display_size,
    v.color,
  ].filter(Boolean);
  return bits.join(" · ") || "Standard config";
}

export function laptopVariantKey(v: Partial<LaptopVariantConfig>): string {
  return [v.cpu, v.ram, v.storage, v.display_size, v.color]
    .map((x) =>
      String(x || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
    )
    .join("|");
}

/**
 * Normalize scraped / manual variants into laptop config shape.
 * Fills CPU / display from model title + specs when missing.
 */
export function normalizeLaptopVariants(input: {
  modelName: string;
  specifications?: Record<string, any> | null;
  variants?: any[] | null;
}): {
  variants: Array<
    LaptopVariantConfig & {
      id?: string;
      master_device_id?: string;
    }
  >;
  specifications: Record<string, any>;
} {
  const specs = { ...(input.specifications || {}) };
  const fromTitle = parseLaptopConfigFromText(input.modelName || "");
  const fromSpecs = parseLaptopConfigFromText(
    [
      specs.processor,
      specs.display,
      specs.description,
      Array.isArray(specs.spec_sections)
        ? JSON.stringify(specs.spec_sections).slice(0, 2000)
        : "",
    ]
      .filter(Boolean)
      .join(" ")
  );

  const baseCpu =
    normalizeCpu(specs.processor || "") || fromTitle.cpu || fromSpecs.cpu || "";
  const baseDisplay =
    normalizeDisplaySize(String(specs.display || "").split(/[·|,]/)[0] || "") ||
    fromTitle.display_size ||
    fromSpecs.display_size ||
    "";

  const rawVariants = Array.isArray(input.variants) ? input.variants : [];
  const pricing = Array.isArray(specs.variant_pricing)
    ? specs.variant_pricing
    : [];

  let variants =
    rawVariants.length > 0
      ? rawVariants
      : pricing.length > 0
        ? pricing
        : [
            {
              color: fromTitle.color || "Standard",
              ram: fromTitle.ram || "",
              storage: fromTitle.storage || "",
              mrp: specs.mrp || specs.selling_price || 0,
              selling_price: specs.selling_price || specs.mrp || 0,
            },
          ];

  const normalized = variants.map((v: any) => {
    const fromName = parseLaptopConfigFromText(
      [v.name, v.color, v.storage, v.ram, v.cpu, v.display_size]
        .filter(Boolean)
        .join(" ")
    );
    const cpu = normalizeCpu(v.cpu || fromName.cpu || baseCpu);
    const ram = normalizeRam(v.ram || fromName.ram || fromTitle.ram || "");
    const storage = normalizeStorage(
      v.storage || fromName.storage || fromTitle.storage || ""
    );
    const display_size = normalizeDisplaySize(
      v.display_size || fromName.display_size || baseDisplay
    );
    const color = String(v.color || fromName.color || fromTitle.color || "Standard").trim();
    return {
      id: v.id || "",
      master_device_id: v.master_device_id || "",
      cpu,
      ram,
      storage,
      display_size,
      color,
      mrp: Number(v.mrp) || 0,
      selling_price: Number(v.selling_price || v.mrp) || 0,
      reference_image_url: v.reference_image_url || v.image || "",
      sku: v.sku || "",
    };
  });

  // Dedupe identical configs
  const byKey = new Map<string, (typeof normalized)[0]>();
  for (const v of normalized) {
    const key = laptopVariantKey(v);
    const prev = byKey.get(key);
    if (!prev || (v.selling_price || 0) > (prev.selling_price || 0)) {
      byKey.set(key, v);
    }
  }
  const unique = [...byKey.values()];

  const cpus = [...new Set(unique.map((v) => v.cpu).filter(Boolean))];
  const rams = [...new Set(unique.map((v) => v.ram).filter(Boolean))];
  const storages = [...new Set(unique.map((v) => v.storage).filter(Boolean))];
  const displays = [
    ...new Set(unique.map((v) => v.display_size).filter(Boolean)),
  ];
  const colors = [...new Set(unique.map((v) => v.color).filter(Boolean))];

  const nextSpecs = {
    ...specs,
    product_type: "laptop",
    device_form: "laptop",
    variant_schema: "laptop_config",
    processor: baseCpu || specs.processor || cpus[0] || "—",
    display: baseDisplay || specs.display || displays[0] || "—",
    cpus,
    rams,
    storages,
    display_sizes: displays,
    colors,
    variant_pricing: unique.map((v) => ({
      cpu: v.cpu,
      ram: v.ram,
      storage: v.storage,
      display_size: v.display_size,
      color: v.color,
      mrp: v.mrp,
      selling_price: v.selling_price || v.mrp,
      image: v.reference_image_url,
      name: laptopVariantName(v),
    })),
  };

  return { variants: unique, specifications: nextSpecs };
}
