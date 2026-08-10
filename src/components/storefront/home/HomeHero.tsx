import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  brandLabel,
  cleanProductName,
  formatINR,
} from "@/lib/storefront/format";
import type { HomeProduct } from "./HomeProductTile";
import type { StorefrontProfile } from "@/lib/store/profile-shared";
import { ProductPhoto } from "@/components/storefront/ProductPhoto";

type Props = {
  featured: HomeProduct[];
  store: StorefrontProfile;
};

export function HomeHero({ featured, store }: Props) {
  const primary = featured[0] ?? null;
  const headline = store.hero_headline;
  const accentMatch = headline.match(/^(.*?\s)([\w'’]+(?:\s+[\w'’]+){0,2})\.?$/);
  const headlineLead = accentMatch ? accentMatch[1] : headline;
  const headlineAccent = accentMatch ? accentMatch[2].replace(/\.$/, "") : "";

  return (
    <section className="ms-hero" aria-label="Featured smartphones">
      {primary?.main_image_url ? (
        <link rel="preload" as="image" href={primary.main_image_url} fetchPriority="high" />
      ) : null}

      <div className="ms-hero-bg" aria-hidden>
        <div className="ms-hero-wash" />
        <div className="ms-jaali ms-jaali--hero" />
        <div className="ms-hero-glow" />
      </div>

      <div className="ms-shell ms-hero-grid">
        <div className="ms-hero-copy ms-rise">
          <p className="ms-eyebrow">{store.hero_eyebrow}</p>
          <h1 className="ms-display ms-display--hero">
            {headlineLead}
            {headlineAccent ? (
              <span className="ms-display-accent"> {headlineAccent}.</span>
            ) : null}
          </h1>
          <p className="ms-lede">{store.hero_subcopy}</p>
          <div className="ms-hero-actions">
            <Link href="/new-mobiles" className="ms-btn ms-btn--primary">
              Explore phones
            </Link>
            <Link href="/new-mobiles" className="ms-btn ms-btn--quiet group">
              View latest launches
              <ArrowUpRight
                size={16}
                strokeWidth={2}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>
          {primary && (
            <Link href={`/product/${primary.slug}`} className="ms-hero-note group">
              <span className="ms-meta">Now featured</span>
              <span className="ms-hero-note-title">
                {(() => {
                  const name = cleanProductName(primary.name);
                  const brand = brandLabel(primary.brand);
                  if (brand && name.toLowerCase().startsWith(brand.toLowerCase())) {
                    return name;
                  }
                  return brand ? `${brand} ${name}` : name;
                })()}
              </span>
              <span className="ms-hero-note-price">
                From {formatINR(primary.selling_price)}
                <ArrowUpRight
                  size={14}
                  className="inline ml-1 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </span>
            </Link>
          )}
        </div>

        <div className="ms-hero-stage">
          <div className="ms-hero-stage-frame" aria-hidden>
            <div className="ms-jaali ms-jaali--stage" />
          </div>

          {primary?.main_image_url && (
            <Link
              href={`/product/${primary.slug}`}
              className="ms-hero-device ms-hero-device--solo ms-float"
              aria-label={cleanProductName(primary.name)}
            >
              <ProductPhoto
                src={primary.main_image_url}
                alt={cleanProductName(primary.name)}
                priority
                width={520}
                height={640}
                quality={78}
                sizes="(max-width: 640px) 55vw, (max-width: 900px) 50vw, 400px"
                className="ms-hero-device-img ms-img-knockout"
              />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
