import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  STORE_CATEGORY_GROUPS,
  STORE_CATEGORY_SEEDS,
  storefrontCategoryHref,
} from "@/lib/catalog/storeCategories";

const bySlug = new Map(STORE_CATEGORY_SEEDS.map((c) => [c.slug, c]));

export function HomeCategoryBrowse() {
  return (
    <section
      id="shop-categories"
      className="ms-section ms-catbrowse"
      aria-labelledby="categories-heading"
    >
      <div className="ms-shell">
        <div className="ms-section-head">
          <div>
            <p className="ms-eyebrow">Shop by category</p>
            <h2 id="categories-heading" className="ms-display ms-display--md">
              Everything we stock.
            </h2>
            <p className="ms-lede ms-lede--narrow mt-3">
              Phones, tablets, laptops, accessories, and parts — pick a lane and browse.
            </p>
          </div>
          <Link href="/categories" className="ms-textlink group">
            View all categories
            <ArrowUpRight
              size={15}
              className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>

        <div className="ms-catbrowse-grid">
          {STORE_CATEGORY_GROUPS.map((group) => (
            <div key={group.id} className="ms-catbrowse-group">
              <h3 className="ms-catbrowse-group-title">{group.label}</h3>
              {group.description ? (
                <p className="ms-catbrowse-group-desc">{group.description}</p>
              ) : null}
              <ul className="ms-catbrowse-list">
                {group.slugs.map((slug) => {
                  const cat = bySlug.get(slug);
                  if (!cat) return null;
                  return (
                    <li key={slug}>
                      <Link href={storefrontCategoryHref(slug)} className="ms-catbrowse-link group">
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
  );
}
