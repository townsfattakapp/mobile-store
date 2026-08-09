import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  STORE_CATEGORY_GROUPS,
  STORE_CATEGORY_SEEDS,
  storefrontCategoryHref,
} from "@/lib/catalog/storeCategories";

export const revalidate = 3600;

const bySlug = new Map(STORE_CATEGORY_SEEDS.map((c) => [c.slug, c]));

export const metadata = {
  title: "Shop by category",
  description:
    "Browse phones, tablets, laptops, accessories, and spare parts — new and pre-owned.",
};

export default function CategoriesIndexPage() {
  return (
    <div className="ms-page">
      <section className="ms-section ms-catbrowse" aria-labelledby="all-categories-heading">
        <div className="ms-shell">
          <div className="ms-section-head">
            <div>
              <p className="ms-eyebrow">Full catalog</p>
              <h1 id="all-categories-heading" className="ms-display ms-display--md">
                Shop by category.
              </h1>
              <p className="ms-lede ms-lede--narrow mt-3">
                Every department we carry — phones to parts, new and pre-owned.
              </p>
            </div>
          </div>

          <div className="ms-catbrowse-grid">
            {STORE_CATEGORY_GROUPS.map((group) => (
              <div key={group.id} className="ms-catbrowse-group">
                <h2 className="ms-catbrowse-group-title">{group.label}</h2>
                {group.description ? (
                  <p className="ms-catbrowse-group-desc">{group.description}</p>
                ) : null}
                <ul className="ms-catbrowse-list">
                  {group.slugs.map((slug) => {
                    const cat = bySlug.get(slug);
                    if (!cat) return null;
                    return (
                      <li key={slug}>
                        <Link
                          href={storefrontCategoryHref(slug)}
                          className="ms-catbrowse-link group"
                        >
                          <span>{cat.name}</span>
                          <ArrowUpRight
                            size={14}
                            className="ms-catbrowse-link-icon"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
