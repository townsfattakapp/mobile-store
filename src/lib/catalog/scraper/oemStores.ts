/**
 * OEM PC + accessory-brand listing helpers (HP / Lenovo / ASUS / Dell / Acer /
 * Belkin / Syska / Anker). Used when JS-heavy hubs need HTML link mining or
 * curated fallbacks (Dell/Acer often block scrapers).
 */

export type OemCatalogItem = {
  name: string;
  url: string;
  image?: string;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function pathOf(url: string): string {
  try {
    return (new URL(url).pathname.replace(/\/+$/, "") || "/").toLowerCase();
  } catch {
    return "/";
  }
}

function titleFromSlug(slug: string): string {
  return slug
    .replace(/\.html$/i, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => {
      if (/^(hp|asus|usb|qi2|gan|oled|amd|intel|in)$/i.test(w)) return w.toUpperCase();
      if (/^\d/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ")
    .replace(/\bMacbook\b/g, "MacBook")
    .replace(/\bIdeapad\b/g, "IdeaPad")
    .replace(/\bThinkpad\b/g, "ThinkPad")
    .replace(/\bVivobook\b/g, "Vivobook")
    .replace(/\bZenbook\b/g, "Zenbook");
}

export function isOemStoreHost(url: string): boolean {
  const h = hostOf(url);
  return (
    h.includes("dell.com") ||
    h.includes("hp.com") ||
    h.includes("lenovo.com") ||
    h.includes("asus.com") ||
    h.includes("acer.com") ||
    h.includes("belkin.com") ||
    h.includes("syska.co.in") ||
    h.includes("anker.com") ||
    h.includes("ankerlndiastore.com")
  );
}

export function isOemListingUrl(url: string): boolean {
  if (!isOemStoreHost(url)) return false;
  if (isOemProductUrl(url)) return false;
  const h = hostOf(url);
  const path = pathOf(url);

  if (h.includes("hp.com")) {
    return (
      path === "/" ||
      /\/shop(\.html)?$/i.test(path) ||
      /\/listings\//i.test(path) ||
      /\/laptops-tablets/i.test(path) ||
      /\/shop\/laptops/i.test(path)
    );
  }
  if (h.includes("lenovo.com")) {
    return (
      path === "/" ||
      /\/laptops(\/|$)/i.test(path) ||
      /\/d\/laptops/i.test(path) ||
      /\/c\/laptops/i.test(path) ||
      /subseries-results/i.test(path)
    );
  }
  if (h.includes("asus.com")) {
    return (
      path === "/" ||
      path.endsWith("/in") ||
      /\/laptops(\/|$)/i.test(path) ||
      /\/for-home\//i.test(path) ||
      /\/for-gaming\//i.test(path) ||
      /\/all-series/i.test(path) ||
      /\/all-products/i.test(path)
    );
  }
  if (h.includes("dell.com")) {
    return path === "/" || /\/shop/i.test(path) || /\/laptops/i.test(path);
  }
  if (h.includes("acer.com")) {
    return path === "/" || /\/laptops/i.test(path) || /\/en-in/i.test(path);
  }
  if (h.includes("belkin.com")) {
    return (
      path === "/" ||
      path === "/in" ||
      /\/products(\/|$)/i.test(path) ||
      /\/in\/products\//i.test(path)
    );
  }
  if (h.includes("syska.co.in")) {
    return (
      path === "/" ||
      /\/category\//i.test(path) ||
      /\/collections\//i.test(path) ||
      path === "/products"
    );
  }
  if (h.includes("anker.com") || h.includes("ankerlndiastore.com")) {
    return (
      path === "/" ||
      /\/collections(\/|$)/i.test(path) ||
      path === "/in" ||
      path.startsWith("/in/")
    );
  }
  return false;
}

export function isOemProductUrl(url: string): boolean {
  if (!isOemStoreHost(url)) return false;
  const h = hostOf(url);
  const path = pathOf(url);

  if (h.includes("hp.com")) {
    return /\/shop\/products\/[^/]+\/[^/]+/i.test(path);
  }
  if (h.includes("lenovo.com")) {
    return /\/p\/[^/]+/i.test(path);
  }
  if (h.includes("asus.com")) {
    // Series/model marketing PDPs: /laptops/.../asus-vivobook-s14-s3407
    if (/\/where-to-buy\/?$/i.test(path)) return false;
    if (/\/laptops\/[^/]+\/[^/]+\/asus-[a-z0-9-]+$/i.test(path)) return true;
    if (/in\.store\.asus\.com/i.test(h) && /\.html$/i.test(path)) return true;
    return false;
  }
  if (h.includes("dell.com")) {
    return (
      /\/ssd\//i.test(path) ||
      /\/apd\//i.test(path) ||
      /\/productdetails\//i.test(path) ||
      /\/shop\/laptop\/[a-z0-9-]+$/i.test(path) ||
      /\/shop\/[^/]+\/[^/]+\/[a-z0-9-]+$/i.test(path)
    );
  }
  if (h.includes("acer.com")) {
    return (
      (/\/laptops\/[^/]+\/[a-z0-9-]+$/i.test(path) &&
        /\/(aspire|nitro|swift|predator|travelmate|spin|helios)/i.test(path)) ||
      (/\.html$/i.test(path) &&
        /\/(aspire|nitro|swift|predator|travelmate|spin)/i.test(path))
    );
  }
  if (h.includes("belkin.com")) {
    return /\/p\/[^/]+\/[^/]+\.html$/i.test(path);
  }
  if (h.includes("syska.co.in")) {
    return /\/products\/[^/]+/i.test(path);
  }
  if (h.includes("anker.com") || h.includes("ankerlndiastore.com")) {
    return /\/products\/[^/]+/i.test(path) && !/\/products\/?$/i.test(path);
  }
  return false;
}

function absUrl(href: string, pageUrl: string): string | null {
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return null;
  }
}

/** Mine product links from listing HTML for supported OEM hosts. */
export function extractOemProductLinksFromHtml(
  html: string,
  pageUrl: string
): OemCatalogItem[] {
  const h = hostOf(pageUrl);
  const seen = new Set<string>();
  const items: OemCatalogItem[] = [];

  const add = (href: string, nameHint?: string) => {
    const full = absUrl(href, pageUrl);
    if (!full || !isOemProductUrl(full)) return;
    const key = full.split("?")[0].replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const slug =
      new URL(full).pathname.split("/").filter(Boolean).pop()?.replace(/\.html$/i, "") ||
      "product";
    items.push({
      name: nameHint?.trim() || titleFromSlug(slug),
      url: full.split("#")[0],
    });
  };

  if (h.includes("hp.com")) {
    for (const m of html.matchAll(
      /href=["']([^"']*\/in-en\/shop\/products\/laptops\/[^"'?#]+)/gi
    )) {
      add(m[1]);
    }
  } else if (h.includes("lenovo.com")) {
    for (const m of html.matchAll(/href=["']([^"']*\/p\/laptops\/[^"'?#]+)/gi)) {
      add(m[1]);
    }
    // Desktops optional — still valid compute SKUs
    for (const m of html.matchAll(/href=["']([^"']*\/p\/desktops\/[^"'?#]+)/gi)) {
      add(m[1]);
    }
  } else if (h.includes("asus.com")) {
    for (const m of html.matchAll(
      /href=["']((?:https:\/\/www\.asus\.com)?\/in\/laptops\/[^"'?#]+\/asus-[^"'?#/]+)\/?/gi
    )) {
      const path = m[1];
      if (/where-to-buy|filter|all-series/i.test(path)) continue;
      add(path.endsWith("/") ? path : `${path}/`);
    }
    for (const m of html.matchAll(
      /href=["'](https:\/\/in\.store\.asus\.com\/[^"'?#]+\.html)/gi
    )) {
      add(m[1]);
    }
  } else if (h.includes("belkin.com")) {
    for (const m of html.matchAll(
      /href=["']((?:https:\/\/www\.belkin\.com)?\/in\/p\/[^"'?#]+\.html)/gi
    )) {
      add(m[1]);
    }
  } else if (h.includes("syska.co.in")) {
    // Homepage embeds product slugs in hydration JSON
    for (const m of html.matchAll(/"slug"\s*:\s*"(syska-[a-z0-9-]{6,})"/gi)) {
      add(`/products/${m[1]}`);
    }
    for (const m of html.matchAll(/href=["'](\/products\/[^"'?#]+)/gi)) {
      add(m[1]);
    }
  } else if (h.includes("anker.com") || h.includes("ankerlndiastore.com")) {
    for (const m of html.matchAll(/href=["'](\/products\/[a-z0-9][a-z0-9-]{3,})/gi)) {
      if (m[1] === "/products/666") continue;
      add(m[1]);
    }
    for (const m of html.matchAll(/"handle"\s*:\s*"([a-z0-9][a-z0-9-]{3,})"/gi)) {
      if (/^(subscription|power-banks|chargers|cables)$/i.test(m[1])) continue;
      add(`/products/${m[1]}`);
    }
  } else if (h.includes("dell.com")) {
    for (const m of html.matchAll(
      /href=["']([^"']*(?:\/ssd\/|\/apd\/|\/productdetails\/)[^"'?#]+)/gi
    )) {
      add(m[1]);
    }
  } else if (h.includes("acer.com")) {
    for (const m of html.matchAll(
      /href=["']([^"']*(?:aspire|nitro|swift|predator|travelmate)[^"'?#]*\.html)/gi
    )) {
      add(m[1]);
    }
  }

  return items;
}

/** When OEM sites block scrapers, still expand a useful India laptop lineup. */
export function getOemCuratedCatalog(pageUrl: string): OemCatalogItem[] | null {
  const h = hostOf(pageUrl);

  if (h.includes("dell.com")) {
    return [
      {
        name: "Dell Inspiron 15",
        url: "https://www.dell.com/en-in/shop/laptop/inspiron-15",
      },
      {
        name: "Dell Inspiron 14",
        url: "https://www.dell.com/en-in/shop/laptop/inspiron-14",
      },
      {
        name: "Dell XPS 14",
        url: "https://www.dell.com/en-in/shop/laptop/xps-14",
      },
      {
        name: "Dell XPS 16",
        url: "https://www.dell.com/en-in/shop/laptop/xps-16",
      },
      {
        name: "Dell G15 Gaming",
        url: "https://www.dell.com/en-in/shop/laptop/g15-gaming",
      },
      {
        name: "Dell Alienware m16",
        url: "https://www.dell.com/en-in/shop/laptop/alienware-m16",
      },
      {
        name: "Dell Latitude 5450",
        url: "https://www.dell.com/en-in/shop/laptop/latitude-5450",
      },
      {
        name: "Dell Vostro 15",
        url: "https://www.dell.com/en-in/shop/laptop/vostro-15",
      },
    ];
  }

  if (h.includes("acer.com") || h.includes("store.acer.com")) {
    return [
      {
        name: "Acer Aspire 3",
        url: "https://www.acer.com/in-en/laptops/aspire/aspire-3",
      },
      {
        name: "Acer Aspire 5",
        url: "https://www.acer.com/in-en/laptops/aspire/aspire-5",
      },
      {
        name: "Acer Swift Go 14",
        url: "https://www.acer.com/in-en/laptops/swift/swift-go-14",
      },
      {
        name: "Acer Swift X",
        url: "https://www.acer.com/in-en/laptops/swift/swift-x",
      },
      {
        name: "Acer Nitro V 15",
        url: "https://www.acer.com/in-en/laptops/nitro/nitro-v-15",
      },
      {
        name: "Acer Predator Helios Neo",
        url: "https://www.acer.com/in-en/laptops/predator/helios-neo",
      },
      {
        name: "Acer TravelMate P2",
        url: "https://www.acer.com/in-en/laptops/travelmate/travelmate-p2",
      },
      {
        name: "Acer Spin 5",
        url: "https://www.acer.com/in-en/laptops/spin/spin-5",
      },
    ];
  }

  if (h.includes("lenovo.com")) {
    const origin = "https://www.lenovo.com";
    return [
      {
        name: "Lenovo IdeaPad Slim 5i Gen 11",
        url: `${origin}/in/en/p/laptops/ideapad/ideapad-s-series/lenovo-ideapad-slim-5i-gen-11-14-inch-intel/len101i0133`,
      },
      {
        name: "Lenovo IdeaPad Slim 5 Gen 10",
        url: `${origin}/in/en/p/laptops/ideapad/ideapad-s-series/lenovo-ideapad-slim-5-gen-10-15-inch-amd/len101i0109`,
      },
      {
        name: "Lenovo LOQ 15IRX9",
        url: `${origin}/in/en/p/laptops/loq-laptops/lenovo-loq-15irx9/len101q0005`,
      },
      {
        name: "Lenovo Legion Pro 7i Gen 10",
        url: `${origin}/in/en/p/laptops/legion-laptops/legion-pro-series/legion-pro-7i-gen-10-16-inch-intel/len101g0039`,
      },
      {
        name: "Lenovo ThinkBook 16 Gen 7",
        url: `${origin}/in/en/p/laptops/thinkbook/thinkbook-series/lenovo-thinkbook-16-gen-7-16-inch-amd/len101b0043`,
      },
      {
        name: "Lenovo ThinkPad E16 Gen 2",
        url: `${origin}/in/en/p/laptops/thinkpad/thinkpade/lenovo-thinkpad-e16-gen-2-16-inch-intel/len101t0088`,
      },
      {
        name: "Lenovo IdeaPad 5i 2-in-1 Gen 11",
        url: `${origin}/in/en/p/laptops/ideapad/ideapad-500-series/lenovo-ideapad-5i-2-in-1-gen-11-14-inch-intel/len101i0139`,
      },
      {
        name: "Lenovo Legion 9i Gen 10",
        url: `${origin}/in/en/p/laptops/legion-laptops/legion-9-series/legion-9i-gen-10-18-inch-intel/len101g0043`,
      },
    ];
  }

  return null;
}

export async function fetchOemCatalog(pageUrl: string): Promise<OemCatalogItem[]> {
  const curated = getOemCuratedCatalog(pageUrl);
  const h = hostOf(pageUrl);

  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const html = await res.text();
      if (!/access denied|403 forbidden/i.test(html.slice(0, 800))) {
        const live = extractOemProductLinksFromHtml(html, pageUrl);
        if (live.length > 0) return live;
      }
    }
  } catch {
    /* curated / empty */
  }

  // Lenovo: try a few known listing entry points when the given URL is empty/blocked
  if (h.includes("lenovo.com")) {
    const alternates = [
      "https://www.lenovo.com/in/en/c/laptops/ideapad/",
      "https://www.lenovo.com/in/en/laptops/",
    ];
    for (const alt of alternates) {
      if (alt.replace(/\/+$/, "") === pageUrl.replace(/\/+$/, "")) continue;
      try {
        const res = await fetch(alt, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "en-IN,en;q=0.9",
          },
          cache: "no-store",
        });
        if (!res.ok) continue;
        const html = await res.text();
        const live = extractOemProductLinksFromHtml(html, alt);
        if (live.length > 0) return live;
      } catch {
        /* try next */
      }
    }
  }

  return curated || [];
}
