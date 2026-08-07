import Link from "next/link";

const FALLBACK_BRANDS = [
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
];

type Brand = { id?: string; name: string; slug?: string };

type Props = {
  brands?: Brand[] | null;
};

export function HomeBrandRail({ brands }: Props) {
  const curated: Brand[] = (brands?.length
    ? brands
    : FALLBACK_BRANDS.map((name) => ({ name }))
  ).filter((b) => b.name && !b.name.toLowerCase().startsWith("http"));

  return (
    <section id="brands" className="ms-section ms-section--compact" aria-labelledby="brands-heading">
      <div className="ms-shell">
        <div className="ms-section-head">
          <div>
            <p className="ms-eyebrow">Shop by brand</p>
            <h2 id="brands-heading" className="ms-display ms-display--md">
              Familiar names. Carefully stocked.
            </h2>
          </div>
        </div>

        <div className="ms-brand-rail" role="list">
          {curated.map((brand) => {
            const href = `/new-mobiles?brand=${encodeURIComponent(
              (brand.slug || brand.name).toLowerCase()
            )}`;
            return (
              <Link
                key={brand.id || brand.name}
                href={href}
                role="listitem"
                className="ms-brand-chip"
              >
                <span className="ms-brand-chip-label">{brand.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
