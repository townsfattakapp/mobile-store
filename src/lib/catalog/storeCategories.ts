/**
 * Canonical store categories for Mahadev Mobiles-style catalog.
 * Kept flat for simple admin dropdowns; names are self-explanatory.
 */
export type StoreCategorySeed = {
  name: string;
  slug: string;
  description?: string;
};

/** Storefront browse groups — every seeded category appears once. */
export type StoreCategoryGroup = {
  id: string;
  label: string;
  description?: string;
  slugs: string[];
};

export const STORE_CATEGORY_GROUPS: StoreCategoryGroup[] = [
  {
    id: "phones",
    label: "Phones",
    description: "New and pre-owned smartphones",
    slugs: ["smartphones-new", "smartphones-pre-owned"],
  },
  {
    id: "tablets",
    label: "Tablets",
    description: "iPad and Android tablets",
    slugs: ["tablets-new", "tablets-pre-owned"],
  },
  {
    id: "laptops",
    label: "Laptops",
    description: "Notebooks and MacBooks",
    slugs: ["laptops-new", "laptops-pre-owned"],
  },
  {
    id: "wearables",
    label: "Wearables",
    description: "Watches and fitness bands",
    slugs: ["smartwatches-wearables"],
  },
  {
    id: "mobile-acc",
    label: "Mobile accessories",
    description: "Cases, chargers, audio and more",
    slugs: [
      "mobile-accessories",
      "cases-covers",
      "screen-guards",
      "chargers-cables",
      "power-banks",
      "audio-earbuds-headphones",
      "car-accessories",
    ],
  },
  {
    id: "computer-acc",
    label: "Computer accessories",
    description: "PC and laptop essentials",
    slugs: [
      "computer-accessories",
      "keyboards-mice",
      "storage-drives",
      "networking",
      "laptop-bags-stands",
    ],
  },
  {
    id: "gaming",
    label: "Gaming & gadgets",
    description: "Controllers and smart gear",
    slugs: ["gaming-accessories", "smart-gadgets"],
  },
  {
    id: "parts",
    label: "Spare parts",
    description: "Batteries and repair parts",
    slugs: ["spare-parts", "batteries"],
  },
];

export function storeCategoryBySlug(slug: string): StoreCategorySeed | undefined {
  return STORE_CATEGORY_SEEDS.find((c) => c.slug === slug);
}

export function storefrontCategoryHref(slug: string): string {
  return `/c/${slug}`;
}

/** Group DB categories for admin <optgroup> dropdowns. */
export function groupCategoriesForSelect<
  T extends { id: string; name: string; slug?: string | null },
>(categories: T[]): { label: string; options: T[] }[] {
  const bySlug = new Map(
    categories.map((c) => [(c.slug || "").toLowerCase(), c])
  );
  const used = new Set<string>();
  const groups: { label: string; options: T[] }[] = [];

  for (const g of STORE_CATEGORY_GROUPS) {
    const options: T[] = [];
    for (const slug of g.slugs) {
      const hit = bySlug.get(slug.toLowerCase());
      if (hit) {
        options.push(hit);
        used.add(hit.id);
      }
    }
    if (options.length) groups.push({ label: g.label, options });
  }

  const leftover = categories.filter((c) => !used.has(c.id));
  if (leftover.length) {
    groups.push({ label: "Other", options: leftover });
  }
  return groups;
}

export const STORE_CATEGORY_SEEDS: StoreCategorySeed[] = [
  // Phones
  {
    name: "Smartphones — New",
    slug: "smartphones-new",
    description: "Brand-new mobile phones",
  },
  {
    name: "Smartphones — Pre-Owned",
    slug: "smartphones-pre-owned",
    description: "Refurbished / used / certified pre-owned phones",
  },
  // Tablets
  {
    name: "Tablets — New",
    slug: "tablets-new",
    description: "New iPad and Android tablets",
  },
  {
    name: "Tablets — Pre-Owned",
    slug: "tablets-pre-owned",
    description: "Used / refurbished tablets",
  },
  // Laptops
  {
    name: "Laptops — New",
    slug: "laptops-new",
    description: "New laptops and notebooks",
  },
  {
    name: "Laptops — Pre-Owned",
    slug: "laptops-pre-owned",
    description: "Used / refurbished laptops",
  },
  // Wearables
  {
    name: "Smartwatches & Wearables",
    slug: "smartwatches-wearables",
    description: "Smartwatches, fitness bands, wearables",
  },
  // Mobile accessories
  {
    name: "Mobile Accessories",
    slug: "mobile-accessories",
    description: "General mobile accessories",
  },
  {
    name: "Cases & Covers",
    slug: "cases-covers",
    description: "Phone and tablet cases, back covers",
  },
  {
    name: "Screen Guards",
    slug: "screen-guards",
    description: "Tempered glass and screen protectors",
  },
  {
    name: "Chargers & Cables",
    slug: "chargers-cables",
    description: "Wall chargers, car chargers, USB / Type-C cables",
  },
  {
    name: "Power Banks",
    slug: "power-banks",
    description: "Portable power banks",
  },
  {
    name: "Audio — Earbuds & Headphones",
    slug: "audio-earbuds-headphones",
    description: "TWS, neckbands, earphones, headphones",
  },
  {
    name: "Car Accessories",
    slug: "car-accessories",
    description: "Car mounts, car chargers, dash accessories",
  },
  // Computer accessories
  {
    name: "Computer Accessories",
    slug: "computer-accessories",
    description: "General PC / laptop accessories",
  },
  {
    name: "Keyboards & Mice",
    slug: "keyboards-mice",
    description: "Keyboards, mice, mouse pads",
  },
  {
    name: "Storage — Pendrive & HDD/SSD",
    slug: "storage-drives",
    description: "USB drives, external HDD/SSD",
  },
  {
    name: "Networking — WiFi & Adapters",
    slug: "networking",
    description: "Routers, WiFi adapters, LAN accessories",
  },
  {
    name: "Laptop Bags & Stands",
    slug: "laptop-bags-stands",
    description: "Laptop bags, sleeves, stands, coolers",
  },
  // Gaming / gadgets
  {
    name: "Gaming Accessories",
    slug: "gaming-accessories",
    description: "Controllers, gaming gear",
  },
  {
    name: "Smart Gadgets",
    slug: "smart-gadgets",
    description: "Smart home and lifestyle gadgets",
  },
  // Parts
  {
    name: "Spare Parts",
    slug: "spare-parts",
    description: "Displays, flex cables, buttons, misc parts",
  },
  {
    name: "Batteries",
    slug: "batteries",
    description: "Phone and device batteries",
  },
];

export type InferredListing = {
  productType: "new_mobile" | "used_mobile" | "accessory" | "part";
  /** Preferred category slug from STORE_CATEGORY_SEEDS */
  categorySlug: string;
};

/**
 * Infer product type + best category slug from model name / scrape metadata.
 */
export function inferListingTypeAndCategory(input: {
  modelName?: string;
  sourceProvider?: string;
  specProductType?: string;
}): InferredListing {
  const model = String(input.modelName || "");
  const blob = `${model} ${input.specProductType || ""} ${input.sourceProvider || ""}`.toLowerCase();
  const source = String(input.sourceProvider || "").toLowerCase();
  const specType = String(input.specProductType || "").toLowerCase();

  const isUsed =
    specType === "used_mobile" ||
    source.includes("refit") ||
    /\b(refurbished|pre[-\s]?owned|renewed|certified\s*pre|open\s*box)\b/i.test(
      blob
    );

  const isPart =
    specType === "part" ||
    /\b(spare\s*part|display\s*assembly|digitizer|flex\s*cable|charging\s*port)\b/i.test(
      blob
    );

  const isTablet =
    /\b(ipad|tablet|galaxy\s*tab|tab\s*[a-z]?\d|matepad|surface\s*go)\b/i.test(
      blob
    );

  const isLaptop =
    /\b(laptop|notebook|macbook|imac|mac\s*mini|mac\s*studio|mac\s*pro|chromebook|thinkpad|thinkbook|ideapad|inspiron|vostro|latitude|xps|alienware|vivobook|zenbook|expertbook|pavilion|omnibook|victus|omen|swift|aspire|nitro|predator|travelmate|legion|loq\b|galaxy\s*book|surface\s*laptop|gram\b)\b/i.test(
      blob
    ) ||
    specType === "laptop" ||
    /device_form["']?\s*:\s*["']?laptop/i.test(blob);

  const isWatch =
    /\b(watch|smartwatch|galaxy\s*watch|apple\s*watch|band\s*\d|fitness\s*band)\b/i.test(
      blob
    ) && !/\bwatch\s*band\b/i.test(blob);

  const isPhone =
    !isTablet &&
    !isLaptop &&
    (/\b(iphone|smartphone|mobile\s*phone|galaxy\s*[a-z]?\d|pixel\s*\d|redmi|realme|oneplus|nothing\s*phone|iqoo|poco|pova|camon|spark|motorola|nord)\b/i.test(
      blob
    ) ||
      specType === "mobile" ||
      specType === "used_mobile" ||
      specType === "new_mobile" ||
      source.includes("refit"));

  const isAccessory = (() => {
    if (specType === "accessory") return true;
    if (isPhone || isTablet || isLaptop) return false;
    return /\b(power\s*bank|charger|cable|earbuds?|earphone|headphones?|neckband|tws|case|cover|tempered|screen\s*guard|mouse|keyboard|pendrive|ssd|hdd|router|adapter|stand|cooler|bag|sleeve|speaker|trimmer|gadget)\b/i.test(
      blob
    );
  })();

  if (isPart) {
    if (/batter/i.test(blob)) {
      return { productType: "part", categorySlug: "batteries" };
    }
    return { productType: "part", categorySlug: "spare-parts" };
  }

  if (isAccessory || isWatch) {
    if (isWatch) {
      return { productType: "accessory", categorySlug: "smartwatches-wearables" };
    }
    if (/power\s*bank/i.test(blob)) {
      return { productType: "accessory", categorySlug: "power-banks" };
    }
    if (/charger|cable|adapter|type[-\s]?c|usb/i.test(blob)) {
      return { productType: "accessory", categorySlug: "chargers-cables" };
    }
    if (/case|cover|pouch/i.test(blob)) {
      return { productType: "accessory", categorySlug: "cases-covers" };
    }
    if (/tempered|screen\s*guard|protector/i.test(blob)) {
      return { productType: "accessory", categorySlug: "screen-guards" };
    }
    if (/earbud|earphone|headphone|neckband|tws|speaker|audio/i.test(blob)) {
      return {
        productType: "accessory",
        categorySlug: "audio-earbuds-headphones",
      };
    }
    if (/keyboard|mouse/i.test(blob)) {
      return { productType: "accessory", categorySlug: "keyboards-mice" };
    }
    if (/pendrive|ssd|hdd|flash\s*drive|storage/i.test(blob)) {
      return { productType: "accessory", categorySlug: "storage-drives" };
    }
    if (/router|wifi|lan|dongle|networking/i.test(blob)) {
      return { productType: "accessory", categorySlug: "networking" };
    }
    if (/laptop\s*bag|sleeve|stand|cooler/i.test(blob)) {
      return { productType: "accessory", categorySlug: "laptop-bags-stands" };
    }
    if (/gaming|controller|joystick/i.test(blob)) {
      return { productType: "accessory", categorySlug: "gaming-accessories" };
    }
    if (/car\s*(mount|charger|holder)/i.test(blob)) {
      return { productType: "accessory", categorySlug: "car-accessories" };
    }
    if (/keyboard|mouse|ssd|pendrive|router|monitor|webcam/i.test(blob)) {
      return { productType: "accessory", categorySlug: "computer-accessories" };
    }
    return { productType: "accessory", categorySlug: "mobile-accessories" };
  }

  if (isLaptop) {
    return {
      productType: isUsed ? "used_mobile" : "new_mobile",
      categorySlug: isUsed ? "laptops-pre-owned" : "laptops-new",
    };
  }

  if (isTablet) {
    return {
      productType: isUsed ? "used_mobile" : "new_mobile",
      categorySlug: isUsed ? "tablets-pre-owned" : "tablets-new",
    };
  }

  // Default phones
  return {
    productType: isUsed ? "used_mobile" : "new_mobile",
    categorySlug: isUsed ? "smartphones-pre-owned" : "smartphones-new",
  };
}
