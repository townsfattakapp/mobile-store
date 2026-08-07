"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * SPA-friendly scroll:
 * - Forward navigations → top
 * - Browser Back/Forward → restore previous position (no force-to-top)
 * - Same-path filter/sort query changes → keep scroll (listing UX)
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  const prevPathRef = useRef<string | null>(null);
  const positionsRef = useRef<Map<string, number>>(new Map());
  const skipNextRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      skipNextRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const key = `${pathname}?${search}`;
    const prevPath = prevPathRef.current;
    const isBackForward = skipNextRef.current;
    skipNextRef.current = false;

    // Save position of previous path before leaving (for later restore)
    if (prevPath != null && prevPath !== pathname) {
      positionsRef.current.set(prevPath, window.scrollY || 0);
    }

    if (isBackForward) {
      const saved = positionsRef.current.get(pathname);
      if (typeof saved === "number") {
        requestAnimationFrame(() => {
          window.scrollTo({ top: saved, left: 0, behavior: "auto" });
        });
      }
      prevPathRef.current = pathname;
      return;
    }

    // Same listing page, only filters/sort changed → keep scroll
    if (prevPath === pathname) {
      prevPathRef.current = pathname;
      return;
    }

    // New forward navigation → top
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    prevPathRef.current = pathname;
  }, [pathname, search]);

  return null;
}
