"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, ShoppingCart, User, Menu, X, Loader2 } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useStoreConfig } from "@/components/storefront/StoreConfigProvider";
import { brandLogoParts } from "@/lib/store/profile-shared";

type SearchResult = {
  id: string;
  name: string;
  slug: string;
  type: string;
  selling_price: number;
  main_image_url: string | null;
  brand: { name: string } | null;
};

export function Header() {
  const store = useStoreConfig();
  const logo = brandLogoParts(store.brand_name);
  const { items, openCart } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();

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
    setQuery("");
    setResults([]);
  }, [pathname]);

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
    if (!isSearchOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSearchOpen]);

  const totalItems = items.reduce((total, item) => total + item.quantity, 0);

  const openSearch = () => {
    setIsMobileMenuOpen(false);
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

  const nav = [
    { href: "/", label: "Home", match: (p: string) => p === "/" },
    { href: "/new-mobiles", label: "Mobiles", match: (p: string) => p.startsWith("/new-mobiles") },
    { href: "/used-mobiles", label: "Pre-Owned", match: (p: string) => p.startsWith("/used-mobiles") },
    { href: "/accessories", label: "Accessories", match: (p: string) => p.startsWith("/accessories") },
    { href: "/parts", label: "Spare Parts", match: (p: string) => p.startsWith("/parts") },
  ];

  return (
    <>
      <header className={`ms-header${scrolled ? " ms-header--scrolled" : ""}`}>
        <div className="ms-header-inner">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="min-[900px]:hidden inline-flex h-10 w-10 items-center justify-center rounded-full text-[#17151f] hover:bg-[#3b2f7c]/10 hover:text-[#3b2f7c] transition-colors"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" strokeWidth={1.5} />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              )}
            </button>
            <Link href="/" className="ms-header-logo">
              {logo.lead}
              {logo.accent ? <span>{logo.accent}</span> : null}
            </Link>
          </div>

          <nav className="ms-header-nav" aria-label="Primary">
            {nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                data-active={item.match(pathname) ? "true" : "false"}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ms-header-actions">
            <button onClick={openSearch} aria-label="Search products">
              <Search className="h-4 w-4" strokeWidth={2} />
            </button>

            <Link href="/account" className="hidden sm:inline-flex" aria-label="Account">
              <User className="h-4 w-4" strokeWidth={2} />
            </Link>

            <button
              onClick={openCart}
              className="relative"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-4 w-4" strokeWidth={2} />
              {mounted && totalItems > 0 && (
                <span className="ms-cart-count">{totalItems}</span>
              )}
            </button>
          </div>
        </div>
      </header>

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
        <div className="fixed inset-0 top-[56px] z-40 overflow-y-auto bg-[#fbf8f3]/97 backdrop-blur-xl min-[900px]:hidden">
          <nav className="flex flex-col space-y-1 px-6 py-6 text-[1.65rem] font-semibold tracking-tight text-[#17151f]">
            <button
              onClick={openSearch}
              className="flex items-center gap-3 border-b border-[#17151f]/08 py-4 text-left hover:text-[#3b2f7c]"
            >
              <Search className="h-5 w-5" strokeWidth={2} />
              Search
            </button>
            {nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="border-b border-[#17151f]/08 py-4 hover:text-[#3b2f7c]"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/account" className="border-b border-[#17151f]/08 py-4 hover:text-[#3b2f7c]">
              Account
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
