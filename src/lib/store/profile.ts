import { unstable_noStore as noStore } from "next/cache";
import {
  isR2Configured,
  uploadImageToR2,
  r2PublicUrl,
} from "@/lib/storage/R2Client";
import { createClient } from "@/utils/supabase/server";
import {
  DEFAULT_STOREFRONT_PROFILE,
  STORE_PROFILE_R2_KEY,
  sanitizeStorefrontProfile,
  type StorefrontProfile,
} from "@/lib/store/profile-shared";

export type { StorefrontProfile } from "@/lib/store/profile-shared";
export {
  DEFAULT_STOREFRONT_PROFILE,
  STORE_PROFILE_R2_KEY,
  brandLogoParts,
  sanitizeStorefrontProfile,
  parseInstagramReelUrls,
} from "@/lib/store/profile-shared";

async function readProfileFromR2(): Promise<Partial<StorefrontProfile> | null> {
  try {
    const base = r2PublicUrl();
    if (!base) return null;
    const res = await fetch(`${base}/${STORE_PROFILE_R2_KEY}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<StorefrontProfile>;
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

async function readContactFromDb(): Promise<Partial<StorefrontProfile>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("store_settings")
      .select(
        "phone, email, website, trade_name, legal_name, brand_name, tagline, business_hours, designed_by_name, designed_by_org, designed_by_url, seo_title, seo_description, hero_eyebrow, hero_headline, hero_subcopy, instagram_url, twitter_url, facebook_url"
      )
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      // Fallback if branding columns aren't migrated yet
      const fallback = await supabase
        .from("store_settings")
        .select("phone, email, website, trade_name, legal_name")
        .limit(1)
        .maybeSingle();
      if (!fallback.data) return {};
      return {
        phone: fallback.data.phone || undefined,
        email: fallback.data.email || undefined,
        website: fallback.data.website || undefined,
        brand_name: fallback.data.trade_name || fallback.data.legal_name || undefined,
      };
    }
    return {
      phone: data.phone || undefined,
      email: data.email || undefined,
      website: data.website || undefined,
      brand_name: (data as any).brand_name || data.trade_name || data.legal_name || undefined,
      tagline: (data as any).tagline || undefined,
      business_hours: (data as any).business_hours || undefined,
      designed_by_name: (data as any).designed_by_name || undefined,
      designed_by_org: (data as any).designed_by_org || undefined,
      designed_by_url: (data as any).designed_by_url || undefined,
      seo_title: (data as any).seo_title || undefined,
      seo_description: (data as any).seo_description || undefined,
      hero_eyebrow: (data as any).hero_eyebrow || undefined,
      hero_headline: (data as any).hero_headline || undefined,
      hero_subcopy: (data as any).hero_subcopy || undefined,
      instagram_url: (data as any).instagram_url || undefined,
      twitter_url: (data as any).twitter_url || undefined,
      facebook_url: (data as any).facebook_url || undefined,
    };
  } catch {
    return {};
  }
}

export async function getStorefrontProfile(): Promise<StorefrontProfile> {
  noStore();
  const [fromR2, fromDb] = await Promise.all([readProfileFromR2(), readContactFromDb()]);
  return sanitizeStorefrontProfile({
    ...fromDb,
    ...fromR2,
    phone: fromR2?.phone || fromDb.phone,
    email: fromR2?.email || fromDb.email,
    website: fromR2?.website || fromDb.website,
  });
}

export async function writeStorefrontProfileToR2(
  profile: StorefrontProfile
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isR2Configured()) {
    return {
      ok: false,
      error:
        "R2 is required to publish storefront branding. Configure R2_* env vars and restart.",
    };
  }
  try {
    const clean = sanitizeStorefrontProfile(profile);
    const buffer = Buffer.from(JSON.stringify(clean, null, 2), "utf8");
    const url = await uploadImageToR2(buffer, STORE_PROFILE_R2_KEY, "application/json");
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || "Failed to write storefront profile" };
  }
}

// Keep default import path happy for unused DEFAULT reference
void DEFAULT_STOREFRONT_PROFILE;
