import {
  STORE_CATEGORY_GROUPS,
  STORE_CATEGORY_SEEDS,
  storefrontCategoryHref,
} from "@/lib/catalog/storeCategories";

export type PrimaryNavItem = {
  id: string;
  label: string;
  href: string;
};

/** Desktop + mobile primary destinations (logo = Home). */
export const PRIMARY_NAV: PrimaryNavItem[] = [
  { id: "mobiles", label: "Mobiles", href: "/new-mobiles" },
  { id: "preowned", label: "Pre-Owned", href: "/used-mobiles" },
  { id: "tablets", label: "Tablets", href: "/c/tablets-new" },
  { id: "laptops", label: "Laptops", href: "/c/laptops-new" },
  { id: "accessories", label: "Accessories", href: "/accessories" },
  { id: "parts", label: "Parts", href: "/parts" },
  { id: "giveaways", label: "Giveaways", href: "/giveaways" },
];

/** Compact footer shop column — hubs + all-categories. */
export const FOOTER_SHOP_LINKS: { href: string; label: string }[] = [
  { href: "/new-mobiles", label: "New Mobiles" },
  { href: "/used-mobiles", label: "Pre-Owned" },
  { href: "/c/tablets-new", label: "Tablets" },
  { href: "/c/laptops-new", label: "Laptops" },
  { href: "/accessories", label: "Accessories" },
  { href: "/parts", label: "Spare Parts" },
  { href: "/giveaways", label: "Giveaways" },
  { href: "/categories", label: "All categories" },
];

const SEED_BY_SLUG = new Map(STORE_CATEGORY_SEEDS.map((c) => [c.slug, c]));

const ACCESSORY_SLUGS = new Set(
  STORE_CATEGORY_GROUPS.filter((g) =>
    ["wearables", "mobile-acc", "computer-acc", "gaming"].includes(g.id)
  ).flatMap((g) => g.slugs)
);

const PART_SLUGS = new Set(
  STORE_CATEGORY_GROUPS.find((g) => g.id === "parts")?.slugs || []
);

function categorySlugFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/c/")) return null;
  return pathname.slice(3).split(/[?#]/)[0] || null;
}

export function isAccessoryCategoryPath(pathname: string): boolean {
  const slug = categorySlugFromPath(pathname);
  return !!slug && ACCESSORY_SLUGS.has(slug);
}

export function isPartCategoryPath(pathname: string): boolean {
  const slug = categorySlugFromPath(pathname);
  return !!slug && PART_SLUGS.has(slug);
}

/** Exclusive active primary item — at most one. */
export function resolveActivePrimaryNav(pathname: string): string | null {
  if (pathname.startsWith("/new-mobiles") || pathname === "/c/smartphones-new") {
    return "mobiles";
  }
  if (
    pathname.startsWith("/used-mobiles") ||
    pathname === "/c/smartphones-pre-owned"
  ) {
    return "preowned";
  }
  if (pathname.startsWith("/c/tablets")) return "tablets";
  if (pathname.startsWith("/c/laptops")) return "laptops";
  if (pathname.startsWith("/parts") || isPartCategoryPath(pathname)) {
    return "parts";
  }
  if (pathname.startsWith("/accessories") || isAccessoryCategoryPath(pathname)) {
    return "accessories";
  }
  if (pathname.startsWith("/giveaway") || pathname.startsWith("/giveaways")) {
    return "giveaways";
  }
  return null;
}

export function isCategoriesHubPath(pathname: string): boolean {
  return pathname === "/categories" || pathname.startsWith("/categories/");
}

export function categoryLabel(slug: string): string {
  return SEED_BY_SLUG.get(slug)?.name || slug;
}

export function categoryNavHref(slug: string): string {
  return storefrontCategoryHref(slug);
}

export function megaMenuGroups() {
  return STORE_CATEGORY_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    description: group.description,
    items: group.slugs
      .map((slug) => {
        const seed = SEED_BY_SLUG.get(slug);
        if (!seed) return null;
        return {
          slug,
          label: seed.name,
          href: storefrontCategoryHref(slug),
          description: seed.description,
        };
      })
      .filter(Boolean) as {
      slug: string;
      label: string;
      href: string;
      description?: string;
    }[],
  }));
}

/** Chips for type hubs (Accessories / Parts). */
export function hubCategoryChips(hub: "accessories" | "parts") {
  const groupIds =
    hub === "accessories"
      ? ["wearables", "mobile-acc", "computer-acc", "gaming"]
      : ["parts"];

  return STORE_CATEGORY_GROUPS.filter((g) => groupIds.includes(g.id)).flatMap(
    (g) =>
      g.slugs.map((slug) => ({
        label: categoryLabel(slug),
        href: storefrontCategoryHref(slug),
        slug,
      }))
  );
}

export function siblingCategoryChips(slug: string) {
  const group = STORE_CATEGORY_GROUPS.find((g) => g.slugs.includes(slug));
  if (!group) return [];
  return group.slugs.map((s) => ({
    label: categoryLabel(s),
    href: storefrontCategoryHref(s),
    slug: s,
    active: s === slug,
  }));
}
