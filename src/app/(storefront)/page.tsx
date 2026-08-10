import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { HomeHero } from "@/components/storefront/home/HomeHero";
import { HomeBrandRail } from "@/components/storefront/home/HomeBrandRail";
import { HomeCategoryBrowse } from "@/components/storefront/home/HomeCategoryBrowse";
import { HomePhoneFinder } from "@/components/storefront/home/HomePhoneFinder";
import { HomeOffersAndTrust } from "@/components/storefront/home/HomeOffersAndTrust";
import { HomeProductTile, type HomeProduct } from "@/components/storefront/home/HomeProductTile";
import {
  brandLabel,
  cleanProductName,
  formatINR,
} from "@/lib/storefront/format";
import { getStorefrontProfile } from "@/lib/store/profile";
import { brandLogoParts } from "@/lib/store/profile-shared";
import { ProductPhoto } from "@/components/storefront/ProductPhoto";
import {
  SMARTPHONE_CATEGORY_SLUG,
  excludeNonPhoneNameFilter,
  getCategoryIdBySlug,
} from "@/lib/storefront/productQueries";

export const revalidate = 60;

const PREFERRED_BRANDS = [
  "Apple",
  "Samsung",
  "OnePlus",
  "Google",
  "Nothing",
  "Vivo",
  "Oppo",
  "Realme",
  "Motorola",
  "Xiaomi",
  "iQOO",
];

const COLLECTIONS = [
  {
    title: "Photography, reimagined.",
    text: "Phones chosen for night shots, colour science, and everyday storytelling.",
    href: "/new-mobiles?brand=google",
    tone: "dark" as const,
  },
  {
    title: "Built for gaming.",
    text: "Fast chipsets and smooth refresh when matches run long.",
    href: "/new-mobiles?brand=iqoo",
    tone: "indigo" as const,
  },
  {
    title: "Flagship without compromise.",
    text: "The top shelf — when only the best camera, display and build will do.",
    href: "/new-mobiles?min=70000&sort=price_desc",
    tone: "warm" as const,
  },
];

const PRODUCT_SELECT =
  "id, name, slug, selling_price, mrp, main_image_url, type, brand:brands(name), variants:product_variants(name)";

export default async function HomePage() {
  const supabase = await createClient();
  const [newPhoneCatId, usedPhoneCatId] = await Promise.all([
    getCategoryIdBySlug(supabase, SMARTPHONE_CATEGORY_SLUG.new),
    getCategoryIdBySlug(supabase, SMARTPHONE_CATEGORY_SLUG.used),
  ]);

  let launchesQ = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .eq("type", "new_mobile")
    .gte("selling_price", 5000)
    .order("created_at", { ascending: false })
    .limit(12);
  let usedQ = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .eq("type", "used_mobile")
    .order("created_at", { ascending: false })
    .limit(8);
  let featuredQ = supabase
    .from("products")
    .select("id, name, slug, selling_price, mrp, main_image_url, type, brand:brands(name)")
    .eq("status", "active")
    .eq("type", "new_mobile")
    .gte("selling_price", 20000)
    .not("main_image_url", "is", null)
    .order("selling_price", { ascending: false })
    .limit(1);

  if (newPhoneCatId) {
    launchesQ = launchesQ.eq("category_id", newPhoneCatId);
    featuredQ = featuredQ.eq("category_id", newPhoneCatId);
  } else {
    launchesQ = excludeNonPhoneNameFilter(launchesQ);
    featuredQ = excludeNonPhoneNameFilter(featuredQ);
  }
  if (usedPhoneCatId) {
    usedQ = usedQ.eq("category_id", usedPhoneCatId);
  } else {
    usedQ = excludeNonPhoneNameFilter(usedQ);
  }

  const [launchesRes, usedRes, brandsRes, featuredRes, store] = await Promise.all([
    launchesQ,
    usedQ,
    supabase.from("brands").select("id, name, slug").order("name"),
    featuredQ,
    getStorefrontProfile(),
  ]);

  const launches = (launchesRes.data || []) as HomeProduct[];
  const used = (usedRes.data || []) as HomeProduct[];
  const featured = (featuredRes.data || []) as HomeProduct[];

  const brandMap = new Map<string, { id: string; name: string; slug: string }>();
  for (const b of brandsRes.data || []) {
    const key = String(b.name || "").toLowerCase();
    if (PREFERRED_BRANDS.some((p) => p.toLowerCase() === key) && !brandMap.has(key)) {
      brandMap.set(key, b);
    }
  }
  const brands = PREFERRED_BRANDS.map((name) => brandMap.get(name.toLowerCase())).filter(
    Boolean
  ) as { id: string; name: string; slug: string }[];

  const heroProducts = (featured[0] ? featured : launches.slice(0, 1)) as HomeProduct[];
  const preownedHero = used[0] ?? null;
  const brand = brandLogoParts(store.brand_name);

  return (
    <div className="ms-page">
      <HomeHero featured={heroProducts} store={store} />

      <HomeBrandRail brands={brands} />

      <HomeCategoryBrowse />

      {/* Just landed */}
      <section id="launches" className="ms-section ms-section--cv" aria-labelledby="launches-heading">
        <div className="ms-shell">
          <div className="ms-section-head">
            <div>
              <p className="ms-eyebrow">New launches</p>
              <h2 id="launches-heading" className="ms-display ms-display--md">
                Just landed.
              </h2>
              <p className="ms-lede ms-lede--narrow mt-3">
                Fresh stock from the brands India asks for — presented clearly, priced in rupees.
              </p>
            </div>
            <Link href="/new-mobiles" className="ms-textlink group">
              Shop all new
              <ArrowUpRight
                size={15}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>

          {launches.length > 0 ? (
            <div className="ms-product-rail">
              {launches.map((product, i) => (
                <HomeProductTile
                  key={product.id}
                  product={product}
                  priority={i === 0}
                />
              ))}
            </div>
          ) : (
            <p className="ms-empty">New phones are being stocked. Check back shortly.</p>
          )}
        </div>
      </section>

      <HomePhoneFinder />

      {/* Curated collections */}
      <section className="ms-section ms-section--cv" aria-labelledby="collections-heading">
        <div className="ms-shell">
          <div className="ms-section-head">
            <div>
              <p className="ms-eyebrow">Curated for how you use a phone</p>
              <h2 id="collections-heading" className="ms-display ms-display--md">
                Collections with intent.
              </h2>
            </div>
          </div>

          <div className="ms-collections">
            {COLLECTIONS.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={`ms-collection ms-collection--${item.tone} group`}
              >
                <h3 className="ms-collection-title">{item.title}</h3>
                <p className="ms-collection-text">{item.text}</p>
                <span className="ms-textlink ms-textlink--inherit">
                  Browse
                  <ArrowUpRight
                    size={15}
                    className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pre-owned */}
      <section className="ms-section ms-preowned ms-section--cv" aria-labelledby="preowned-heading">
        <div className="ms-shell">
          <div className="ms-preowned-grid">
            <div className="ms-preowned-copy">
              <p className="ms-eyebrow">Certified pre-owned</p>
              <h2 id="preowned-heading" className="ms-display ms-display--md">
                Pre-owned. Reconsidered.
              </h2>
              <p className="ms-lede mt-4">
                Not a bargain bin — a considered second chapter. Inspected devices, transparent
                pricing, and the confidence to upgrade without overspending.
              </p>
              <ul className="ms-checklist">
                <li>Quality checked before listing</li>
                <li>Honest condition & pricing</li>
                <li>Strong value versus new MRP</li>
              </ul>
              <Link href="/used-mobiles" className="ms-btn ms-btn--primary mt-8">
                Browse pre-owned
              </Link>
            </div>

            <div className="ms-preowned-panel">
              <div className="ms-jaali ms-jaali--soft" aria-hidden />
              {preownedHero ? (
                <Link href={`/product/${preownedHero.slug}`} className="ms-preowned-feature group">
                  <div className="ms-preowned-img-wrap">
                    <ProductPhoto
                      src={preownedHero.main_image_url}
                      alt={cleanProductName(preownedHero.name)}
                      fill
                      sizes="(max-width: 768px) 90vw, 420px"
                      className="ms-preowned-img ms-img-knockout"
                    />
                  </div>
                  <div className="ms-preowned-meta">
                    <p className="ms-meta">{brandLabel(preownedHero.brand)}</p>
                    <h3 className="ms-preowned-title">
                      {cleanProductName(preownedHero.name)}
                    </h3>
                    <div className="ms-price-row">
                      <span className="ms-price">{formatINR(preownedHero.selling_price)}</span>
                      {Number(preownedHero.mrp || 0) > Number(preownedHero.selling_price) && (
                        <span className="ms-mrp">{formatINR(Number(preownedHero.mrp))}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="ms-preowned-empty">
                  <p className="ms-lede">Pre-owned inventory refreshes often. Explore the full collection.</p>
                  <Link href="/used-mobiles" className="ms-textlink mt-4">
                    View collection
                  </Link>
                </div>
              )}

              {used.length > 1 && (
                <div className="ms-preowned-mini">
                  {used.slice(1, 5).map((p) => (
                    <HomeProductTile key={p.id} product={p} tone="warm" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <HomeOffersAndTrust brandName={store.brand_name} />

      {/* Closing */}
      <section className="ms-close ms-section--cv" aria-labelledby="close-heading">
        <div className="ms-shell">
          <p className="ms-eyebrow ms-eyebrow--on-dark">{brand.full} · Tiroda</p>
          <h2 id="close-heading" className="ms-display ms-display--lg ms-display--on-dark">
            Your next phone is closer than you think.
          </h2>
          <p className="ms-lede ms-lede--on-dark mt-5">
            {store.tagline}
          </p>
          <div className="ms-hero-actions mt-10">
            <Link href="/new-mobiles" className="ms-btn ms-btn--light">
              Start shopping
            </Link>
            <Link href="/used-mobiles" className="ms-btn ms-btn--ghost-light group">
              See pre-owned
              <ArrowUpRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
