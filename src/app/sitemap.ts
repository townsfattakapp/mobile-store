import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

/** Canonical site origin for sitemap / robots. */
export function getSiteUrl() {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "https://mobile-store-umber-gamma.vercel.app";
}

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Refresh catalog URLs hourly. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
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
      priority: 0.8,
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
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${base}/signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const supabase = publicSupabase();
  if (!supabase) return staticRoutes;

  const productEntries: MetadataRoute.Sitemap = [];
  const pageSize = 1000;
  let from = 0;

  // Paginate so larger catalogs still get fully listed
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
      productEntries.push({
        url: `${base}/product/${row.slug}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    if (data.length < pageSize) break;
    from += pageSize;
    if (from > 20000) break; // hard safety cap
  }

  return [...staticRoutes, ...productEntries];
}
