"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

export type PlpChip = {
  label: string;
  href: string;
  active?: boolean;
};

type Props = {
  chips: PlpChip[];
  /** Base path for sort changes, e.g. /new-mobiles */
  basePath: string;
  brandParam?: string | null;
  sortParam?: string | null;
  /** Hide sort control (static placeholder pages) */
  showSort?: boolean;
};

function buildHref(basePath: string, brand?: string | null, sort?: string | null) {
  const params = new URLSearchParams();
  if (brand) params.set("brand", brand);
  if (sort) params.set("sort", sort);
  const q = params.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export function PlpToolbar({
  chips,
  basePath,
  brandParam,
  sortParam,
  showSort = true,
}: Props) {
  const router = useRouter();
  const sortValue = sortParam || "";

  return (
    <div className="ms-plp-toolbar">
      <div className="ms-plp-toolbar-inner">
        <nav className="ms-plp-chips" aria-label="Filter by brand">
          {chips.map((chip) => (
            <Link
              key={chip.href + chip.label}
              href={chip.href}
              className={`ms-plp-chip${chip.active ? " is-active" : ""}`}
              aria-current={chip.active ? "page" : undefined}
            >
              {chip.label}
            </Link>
          ))}
        </nav>

        {showSort ? (
          <div className="ms-plp-sort">
            <label htmlFor="plp-sort" className="ms-sr-only">
              Sort products
            </label>
            <div className="ms-plp-sort-wrap">
              <select
                id="plp-sort"
                className="ms-plp-sort-select"
                value={sortValue}
                onChange={(e) => {
                  const next = e.target.value || null;
                  router.push(buildHref(basePath, brandParam, next));
                }}
              >
                <option value="">Featured</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
              <ChevronDown className="ms-plp-sort-icon" size={14} aria-hidden />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
