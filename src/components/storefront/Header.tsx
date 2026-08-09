"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  X,
  Loader2,
  ChevronDown,
  ArrowUpRight,
} from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useStoreConfig } from "@/components/storefront/StoreConfigProvider";
import { brandLogoParts } from "@/lib/store/profile-shared";
import {
  PRIMARY_NAV,
  isCategoriesHubPath,
  megaMenuGroups,
  resolveActivePrimaryNav,
} from "@/lib/storefront/nav";

type SearchResult = {
  id: string;
  name: string;
  slug: string;
  type: string;
  selling_price: number;
  main_image_url: string | null;
  brand: { name: string } | null;
};

const MEGA_GROUPS = megaMenuGroups();

export function Header() {
  const store = useStoreConfig();
  const logo = brandLogoParts(store.brand_name);
  const { items, openCart } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMegaOpen, setIsMegaOpen] = useState(false);
  const [mobileOpenGroup, setMobileOpenGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const megaCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const megaPanelId = useId();
  const pathname = usePathname();
  const router = useRouter();

  const activePrimary = resolveActivePrimaryNav(pathname);
  const categoriesActive = isCategoriesHubPath(pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsSearchOpen(false);
    setIsMegaOpen(false);
    setMobileOpenGroup(null);
    setQuery("");
    setResults([]);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("products")
          .select("id, name, slug, type, selling_price, main_image_url, brand:brands(name)")
          .eq("status", "active")
          .ilike("name", `%${trimmed}%`)
          .limit(8)
          .abortSignal(controller.signal);

        if (controller.signal.aborted) return;

        if (error) {
          console.error("Search error:", error);
          setResults([]);
        } else {
          setResults(
            (data as unknown as SearchResult[])?.map((row: any) => ({
              ...row,
              brand: Array.isArray(row.brand) ? row.brand[0] ?? null : row.brand,
            })) || []
          );
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Search error:", err);
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen && !isMegaOpen && !isMobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isSearchOpen) closeSearch();
      else if (isMegaOpen) setIsMegaOpen(false);
      else if (isMobileMenuOpen) setIsMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSearchOpen, isMegaOpen, isMobileMenuOpen]);

  useEffect(() => {
    return () => {
      if (megaCloseTimer.current) clearTimeout(megaCloseTimer.current);
    };
  }, []);

  const totalItems = items.reduce((total, item) => total + item.quantity, 0);

  const openSearch = () => {
    setIsMobileMenuOpen(false);
    setIsMegaOpen(false);
    setIsSearchOpen(true);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleResultClick = (slug: string) => {
    closeSearch();
    router.push(`/product/${slug}`);
  };

  const typeLabel = (type: string) => {
    if (type === "used_mobile") return "Pre-Owned";
    if (type === "accessory") return "Accessory";
    if (type === "part") return "Spare Part";
    return "New";
  };

  const openMega = () => {
    if (megaCloseTimer.current) {
      clearTimeout(megaCloseTimer.current);
      megaCloseTimer.current = null;
    }
    setIsMegaOpen(true);
  };

  const scheduleCloseMega = () => {
    if (megaCloseTimer.current) clearTimeout(megaCloseTimer.current);
    megaCloseTimer.current = setTimeout(() => setIsMegaOpen(false), 140);
  };

  const toggleMega = () => {
    if (megaCloseTimer.current) {
      clearTimeout(megaCloseTimer.current);
      megaCloseTimer.current = null;
    }
    setIsMegaOpen((v) => !v);
  };

  return (
    <>
      <header
        className={`ms-header${scrolled || isMegaOpen ? " ms-header--scrolled" : ""}${
          isMegaOpen ? " ms-header--mega-open" : ""
        }`}
      >
        <div className="ms-header-inner">
          <div className="ms-header-left">
            <button
              type="button"
              onClick={() => {
                setIsMegaOpen(false);
                setIsMobileMenuOpen((v) => !v);
              }}
              className="ms-header-iconbtn ms-header-menu-btn"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="ms-mobile-nav"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" strokeWidth={1.5} />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              )}
            </button>
            <Link href="/" className="ms-header-logo" aria-label="Home">
              {logo.lead}
              {logo.accent ? <span>{logo.accent}</span> : null}
            </Link>
          </div>

          <nav className="ms-header-nav" aria-label="Primary">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                data-active={activePrimary === item.id ? "true" : "false"}
              >
                {item.label}
              </Link>
            ))}

            <div
              className="ms-header-shop"
              onMouseEnter={openMega}
              onMouseLeave={scheduleCloseMega}
            >
              <button
                type="button"
                className="ms-header-shop-trigger"
                data-active={categoriesActive || isMegaOpen ? "true" : "false"}
                aria-expanded={isMegaOpen}
                aria-controls={megaPanelId}
                onClick={toggleMega}
              >
                Categories
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  className={`ms-header-chevron${isMegaOpen ? " is-open" : ""}`}
                  aria-hidden
                />
              </button>
            </div>
          </nav>

          <div className="ms-header-actions">
            <button type="button" onClick={openSearch} aria-label="Search products">
              <Search className="h-4 w-4" strokeWidth={2} />
            </button>

            <Link href="/account" className="hidden sm:inline-flex" aria-label="Account">
              <User className="h-4 w-4" strokeWidth={2} />
            </Link>

            <button type="button" onClick={openCart} className="relative" aria-label="Open cart">
              <ShoppingCart className="h-4 w-4" strokeWidth={2} />
              {mounted && totalItems > 0 && (
                <span className="ms-cart-count">{totalItems}</span>
              )}
            </button>
          </div>
        </div>

        {isMegaOpen ? (
          <div
            id={megaPanelId}
            className="ms-header-mega"
            onMouseEnter={openMega}
            onMouseLeave={scheduleCloseMega}
          >
            <div className="ms-header-mega-shell">
              <div className="ms-header-mega-top">
                <div>
                  <p className="ms-header-mega-kicker">Browse the store</p>
                  <p className="ms-header-mega-title">Shop by category</p>
                </div>
                <Link href="/categories" className="ms-header-mega-all" onClick={() => setIsMegaOpen(false)}>
                  View all
                  <ArrowUpRight size={14} aria-hidden />
                </Link>
              </div>

              <div className="ms-header-mega-grid">
                {MEGA_GROUPS.map((group) => (
                  <div key={group.id} className="ms-header-mega-col">
                    <p className="ms-header-mega-heading">{group.label}</p>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.slug}>
                          <Link
                            href={item.href}
                            onClick={() => setIsMegaOpen(false)}
                            data-active={pathname === item.href ? "true" : "false"}
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {isMegaOpen ? (
        <button
          type="button"
          className="ms-header-mega-backdrop"
          aria-label="Close categories menu"
          onClick={() => setIsMegaOpen(false)}
        />
      ) : null}

      {isSearchOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            className="absolute inset-0 bg-[#17151f]/40 backdrop-blur-sm"
            onClick={closeSearch}
            aria-label="Close search"
          />
          <div className="relative z-10 mx-auto mt-16 max-w-2xl px-4 sm:mt-24">
            <div className="overflow-hidden rounded-2xl border border-[#17151f]/10 bg-[#fbf8f3] shadow-2xl">
              <div className="flex items-center gap-3 border-b border-[#17151f]/08 px-4">
                <Search className="h-5 w-5 shrink-0 text-[#7a7489]" strokeWidth={2} />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search mobiles, brands, accessories..."
                  className="h-14 flex-1 bg-transparent text-base text-[#17151f] outline-none placeholder:text-[#7a7489]"
                  aria-label="Search products"
                />
                {isSearching ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#7a7489]" />
                ) : (
                  <button
                    type="button"
                    onClick={closeSearch}
                    className="p-2 text-[#7a7489] transition-colors hover:text-[#17151f]"
                    aria-label="Close search"
                  >
                    <X className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                )}
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {query.trim().length < 2 ? (
                  <p className="px-5 py-8 text-center text-sm text-[#7a7489]">
                    Type at least 2 characters to search.
                  </p>
                ) : isSearching ? (
                  <p className="px-5 py-8 text-center text-sm text-[#7a7489]">Searching...</p>
                ) : results.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-[#7a7489]">
                    No products found for &ldquo;{query.trim()}&rdquo;.
                  </p>
                ) : (
                  <ul className="py-2">
                    {results.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => handleResultClick(product.slug)}
                          className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[#3b2f7c]/06"
                        >
                          <div className="flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#17151f]/08 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                product.main_image_url ||
                                "https://placehold.co/80x100/f7f3ec/7a7489?text=MS"
                              }
                              alt=""
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-[#17151f]">{product.name}</p>
                            <p className="mt-0.5 text-xs text-[#7a7489]">
                              {product.brand?.name ? `${product.brand.name} · ` : ""}
                              {typeLabel(product.type)}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-[#17151f]">
                            ₹{(product.selling_price || 0).toLocaleString("en-IN")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isMobileMenuOpen && (
        <div
          id="ms-mobile-nav"
          className="ms-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Store menu"
        >
          <div className="ms-mobile-drawer-inner">
            <button
              type="button"
              onClick={openSearch}
              className="ms-mobile-search"
            >
              <Search className="h-4 w-4" strokeWidth={2} />
              Search products
            </button>

            <nav aria-label="Primary mobile">
              <ul className="ms-mobile-primary">
                {PRIMARY_NAV.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      data-active={activePrimary === item.id ? "true" : "false"}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/categories"
                    data-active={categoriesActive ? "true" : "false"}
                  >
                    All categories
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="ms-mobile-groups">
              <p className="ms-mobile-groups-label">Shop by category</p>
              {MEGA_GROUPS.map((group) => {
                const open = mobileOpenGroup === group.id;
                return (
                  <div key={group.id} className="ms-mobile-group">
                    <button
                      type="button"
                      className="ms-mobile-group-trigger"
                      aria-expanded={open}
                      onClick={() =>
                        setMobileOpenGroup((cur) => (cur === group.id ? null : group.id))
                      }
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        size={16}
                        className={`ms-header-chevron${open ? " is-open" : ""}`}
                        aria-hidden
                      />
                    </button>
                    {open ? (
                      <ul className="ms-mobile-group-list">
                        {group.items.map((item) => (
                          <li key={item.slug}>
                            <Link href={item.href}>{item.label}</Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <Link href="/account" className="ms-mobile-account">
              Account
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
