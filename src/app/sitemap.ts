import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/seo/siteUrl";
import { STORE_CATEGORY_SEEDS } from "@/lib/catalog/storeCategories";

/** New publishes appear here within this window (no manual sitemap edits). */
export const revalidate = 3600;

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Single sitemap.xml (Google: up to 50k URLs).
 * When the catalog approaches that limit, split into a sitemap index.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: `${base}/new-mobiles`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/used-mobiles`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${base}/accessories`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/parts`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/categories`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${base}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/warranty`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/refund-policy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/shipping-policy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const seenCats = new Set<string>();
  for (const seed of STORE_CATEGORY_SEEDS) {
    if (!seed.slug || seenCats.has(seed.slug)) continue;
    seenCats.add(seed.slug);
    entries.push({
      url: `${base}/c/${seed.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  const supabase = publicSupabase();
  if (!supabase) return entries;

  const { data: cats } = await supabase
    .from("categories")
    .select("slug, updated_at")
    .eq("active", true)
    .not("slug", "is", null)
    .limit(500);

  for (const cat of cats || []) {
    if (!cat.slug || seenCats.has(cat.slug)) continue;
    seenCats.add(cat.slug);
    entries.push({
      url: `${base}/c/${cat.slug}`,
      lastModified: cat.updated_at ? new Date(cat.updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.65,
    });
  }

  // Active products only — OOS stays listed (availability handled in Product JSON-LD)
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("status", "active")
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error || !data?.length) break;

    for (const row of data) {
      if (!row.slug) continue;
      entries.push({
        url: `${base}/product/${row.slug}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    if (data.length < pageSize) break;
    from += pageSize;
    if (from >= 49000) break; // keep under Google’s 50k URL limit
  }

  // No public brand PLPs yet — do not emit /brand/* or filtered ?brand= URLs.
  return entries;
}
