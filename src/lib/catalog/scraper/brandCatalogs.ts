/**
 * Curated India brand phone catalogs for JS-heavy marketing sites
 * where homepage HTML has almost no product links.
 */

export type BrandCatalogItem = {
  name: string;
  url: string;
  brand: string;
};

function item(
  brand: string,
  name: string,
  url: string
): BrandCatalogItem {
  return { brand, name, url };
}

/** OnePlus India — https://www.oneplus.in/ */
export function onePlusCatalog(): BrandCatalogItem[] {
  const base = "https://www.oneplus.in";
  return [
    item("OnePlus", "OnePlus 15", `${base}/oneplus-15`),
    item("OnePlus", "OnePlus 15R", `${base}/oneplus-15r`),
    item("OnePlus", "OnePlus 13s", `${base}/oneplus-13s`),
    item("OnePlus", "OnePlus Nord 6", `${base}/oneplus-nord-6`),
    item("OnePlus", "OnePlus Nord CE6", `${base}/oneplus-nord-ce-6`),
    item("OnePlus", "OnePlus Nord CE6 Lite", `${base}/oneplus-nord-ce-6-lite`),
    item("OnePlus", "OnePlus N6", `${base}/oneplus-n6`),
    item("OnePlus", "OnePlus N6x", `${base}/oneplus-n6x`),
  ];
}

/** Google Store India Pixel phones */
export function googlePixelCatalog(): BrandCatalogItem[] {
  const base = "https://store.google.com/in/product";
  return [
    item("Google", "Pixel 10 Pro", `${base}/pixel_10_pro?hl=en-IN`),
    item("Google", "Pixel 10 Pro XL", `${base}/pixel_10_pro_xl?hl=en-IN`),
    item("Google", "Pixel 10 Pro Fold", `${base}/pixel_10_pro_fold?hl=en-IN`),
    item("Google", "Pixel 10", `${base}/pixel_10?hl=en-IN`),
    item("Google", "Pixel 10a", `${base}/pixel_10a?hl=en-IN`),
    item("Google", "Pixel 9 Pro", `${base}/pixel_9_pro?hl=en-IN`),
    item("Google", "Pixel 9", `${base}/pixel_9?hl=en-IN`),
    item("Google", "Pixel 9a", `${base}/pixel_9a?hl=en-IN`),
  ];
}

/** vivo India products hub */
export function vivoCatalog(): BrandCatalogItem[] {
  // Last-resort fallback if shop.vivo Nuxt listing is down
  const base = "https://www.vivo.com/in/products";
  return [
    item("vivo", "vivo X300 Ultra", `${base}/x300-ultra`),
    item("vivo", "vivo X300 FE", `${base}/x300-fe`),
    item("vivo", "vivo X300 Pro", `${base}/x300-pro`),
    item("vivo", "vivo X300", `${base}/x300`),
    item("vivo", "vivo X Fold 5", `${base}/x-fold5`),
    item("vivo", "vivo V70 Elite", `${base}/v70-elite`),
    item("vivo", "vivo V70 FE", `${base}/v70-fe`),
    item("vivo", "vivo V70", `${base}/v70`),
    item("vivo", "vivo Y51 Pro 5G", `${base}/y51-pro-5g`),
    item("vivo", "vivo Y400 5G", `${base}/y400-5g`),
    item("vivo", "vivo Y31 5G", `${base}/y31-5g`),
    item("vivo", "vivo Y21 5G", `${base}/y21-5g`),
    item("vivo", "vivo Y11 5G", `${base}/y11-5g`),
    item("vivo", "vivo Y05", `${base}/y05`),
    item("vivo", "vivo T5 Pro 5G", `${base}/t5-pro-5g`),
    item("vivo", "vivo T5x", `${base}/t5x`),
    item("vivo", "vivo T5 Lite 5G", `${base}/t5-lite-5g`),
    item("vivo", "vivo T5e", `${base}/t5e`),
    item("vivo", "vivo S2", `${base}/s2`),
  ];
}

/** OPPO India smartphones — prefer /product/ buy PDPs with codes */
export function oppoCatalog(): BrandCatalogItem[] {
  const base = "https://www.oppo.com/in";
  return [
    item("OPPO", "OPPO Find X9 Ultra", `${base}/product/oppo-find-x9-ultra.P.P1110142`),
    item("OPPO", "OPPO Find X9s", `${base}/product/oppo-find-x9s.P.P1110141`),
    item("OPPO", "OPPO Reno16 5G", `${base}/product/reno16-5g.P.P1110156`),
    item("OPPO", "OPPO Reno16c 5G", `${base}/product/reno16c-5g.P.P1110157`),
    item("OPPO", "OPPO F33 Pro 5G", `${base}/product/f33-pro-5g.P.P1110130`),
    item("OPPO", "OPPO F33 5G", `${base}/smartphones/f33-5g/`),
    item("OPPO", "OPPO K14 5G", `${base}/smartphones/k14-5g/`),
  ];
}

/** Xiaomi / Redmi India */
export function xiaomiCatalog(): BrandCatalogItem[] {
  const base = "https://www.mi.com/in";
  return [
    item("Xiaomi", "Xiaomi 17T", `${base}/product/xiaomi-17t/`),
    item("Xiaomi", "Redmi Turbo 5", `${base}/product/redmi-turbo-5/`),
    item("Xiaomi", "Redmi Note 15 Pro+ 5G", `${base}/product/redmi-note-15-pro-plus-5g/`),
    item("Xiaomi", "Redmi Note 15 Pro 5G", `${base}/product/redmi-note-15-pro-5g/`),
    item("Xiaomi", "Redmi Note 17 5G", `${base}/product/redmi-note-17-5g/`),
    item("Xiaomi", "Redmi Note 15 5G", `${base}/product/redmi-note-15-5g/`),
  ];
}

/** POCO India — poco.in homepage is empty JS shell; use model pages / Flipkart rebuild */
export function pocoCatalog(): BrandCatalogItem[] {
  return [
    item("POCO", "POCO F7", "https://www.poco.in/product/poco-f7"),
    item("POCO", "POCO F7 Pro", "https://www.poco.in/product/poco-f7-pro"),
    item("POCO", "POCO X7 Pro", "https://www.poco.in/product/poco-x7-pro"),
    item("POCO", "POCO X7", "https://www.poco.in/product/poco-x7"),
    item("POCO", "POCO M7 Pro 5G", "https://www.poco.in/product/poco-m7-pro-5g"),
    item("POCO", "POCO C75 5G", "https://www.poco.in/product/poco-c75-5g"),
    item("POCO", "POCO C71", "https://www.poco.in/product/poco-c71"),
  ];
}

/** realme India — fallback if live sitemap/nav fetch fails */
export function realmeCatalog(): BrandCatalogItem[] {
  const base = "https://www.realme.com/in";
  return [
    item("realme", "realme GT 8 Pro", `${base}/realme-gt-8-pro`),
    item("realme", "realme GT 7T 5G", `${base}/realme-gt-7t-5g`),
    item("realme", "realme 16 Pro+ 5G", `${base}/realme-16-pro-plus-5g`),
    item("realme", "realme 16 Pro 5G", `${base}/realme-16-pro-5g`),
    item("realme", "realme 16 5G", `${base}/realme-16-5g`),
    item("realme", "realme 16T 5G", `${base}/realme-16t-5g`),
    item("realme", "realme P4R 5G", `${base}/realme-p4r-5g`),
    item("realme", "realme P4 Pro 5G", `${base}/realme-p4-pro-5g`),
    item("realme", "realme NARZO 100x 5G", `${base}/realme-narzo-100x-5g`),
    item("realme", "realme C100x", `${base}/realme-c100x`),
    item("realme", "realme Pad 3", `${base}/realme-pad-3`),
    item("realme", "realme Watch S5", `${base}/realme-watch-s5`),
    item(
      "realme",
      "realme Buds Air8 Pro",
      `${base}/more-products/realme-buds-air-8-pro`
    ),
  ];
}

/** iQOO — marketing PDPs (shop listing is fetched live; this is fallback) */
export function iqooCatalog(): BrandCatalogItem[] {
  const base = "https://www.iqoo.com/in/products";
  return [
    item("iQOO", "iQOO Z11 Lite 44W 5G", `${base}/z11-Lite-44w`),
    item("iQOO", "iQOO Z11x 5G", `${base}/z11x`),
    item("iQOO", "iQOO 15R", `${base}/iqoo15r`),
    item("iQOO", "iQOO 15", `${base}/iqoo15`),
    item("iQOO", "iQOO Neo 10", `${base}/neo10`),
    item("iQOO", "iQOO Z10R 5G", `${base}/z10r-5g`),
    item("iQOO", "iQOO Z10 Lite 5G", `${base}/z10-lite`),
    item("iQOO", "iQOO Neo 10R", `${base}/neo10r`),
    item("iQOO", "iQOO Neo 10R Refurbished", `${base}/neo10r?condition=refurbished`),
    item("iQOO", "iQOO Z10 Lite 5G Refurbished", `${base}/z10-lite?condition=refurbished`),
    item("iQOO", "iQOO Z10 5G Refurbished", `${base}/z10-5g?condition=refurbished`),
    item("iQOO", "iQOO 13 Refurbished", `${base}/iqoo13?condition=refurbished`),
    item("iQOO", "iQOO Neo 10 Refurbished", `${base}/neo10?condition=refurbished`),
    item("iQOO", "iQOO Z10R 5G Refurbished", `${base}/z10r-5g?condition=refurbished`),
  ];
}

/** Motorola India — VTEX /p URLs */
export function motorolaCatalog(): BrandCatalogItem[] {
  const base = "https://www.motorola.in";
  return [
    item("Motorola", "motorola edge 70 max", `${base}/smartphones-motorola-edge-70-max/p`),
    item("Motorola", "motorola edge 70 pro plus", `${base}/smartphones-motorola-edge-70-pro-plus/p`),
    item("Motorola", "motorola edge 70 pro", `${base}/smartphones-motorola-edge-70-pro/p`),
    item("Motorola", "motorola edge 70", `${base}/smartphones-motorola-edge-70/p`),
    item("Motorola", "motorola signature", `${base}/smartphones-motorola-signature/p`),
    item("Motorola", "motorola razr fold", `${base}/smartphones-motorola-razr-fold/p`),
    item("Motorola", "motorola razr 60", `${base}/smartphones-motorola-razr-60/p`),
    item("Motorola", "moto g96 5G", `${base}/smartphones-moto-g96-5g/p`),
    item("Motorola", "moto g77 power", `${base}/smartphones-moto-g77-power/p`),
  ];
}

/** Lava */
export function lavaCatalog(): BrandCatalogItem[] {
  const base = "https://lavamobiles.com";
  return [
    item("Lava", "Lava VIRAT V1 5G", `${base}/smartphones/virat-v1-5g`),
    item("Lava", "Lava VIRAT V1", `${base}/smartphones/virat-v1`),
    item("Lava", "Lava Blaze Duo 3", `${base}/smartphones/blaze-duo-3`),
    item("Lava", "Lava AGNI 4", `${base}/smartphones/agni-4`),
    item("Lava", "Lava Shark 2 5G", `${base}/smartphones/shark-2-5g`),
    item("Lava", "Lava Bold N2 5G", `${base}/smartphones/bold-n2-5g`),
  ];
}

/** HMD / Nokia India */
export function hmdCatalog(): BrandCatalogItem[] {
  const base = "https://www.hmd.com/en_in";
  return [
    item("HMD", "HMD Vibe 5G", `${base}/vibe`),
    item("HMD", "HMD Touch 4G", `${base}/touch`),
    item("HMD", "HMD Fusion 5G", `${base}/fusion`),
    item("HMD", "Nokia 3210 4G", `${base}/nokia-3210-4g`),
    item("HMD", "Nokia 235 4G", `${base}/nokia-235-4g`),
    item("HMD", "HMD 150 Music", `${base}/hmd-150-music`),
  ];
}

/**
 * Return curated catalog when URL matches a known brand hub.
 */
export function getCuratedBrandCatalog(pageUrl: string): BrandCatalogItem[] | null {
  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./, "").toLowerCase();
    const path = new URL(pageUrl).pathname.toLowerCase();

    if (host.includes("oneplus.in") || host.includes("oneplus.com")) {
      return onePlusCatalog();
    }
    if (host.includes("store.google.com")) {
      return googlePixelCatalog();
    }
    if (
      host.includes("vivo.com") &&
      (/\/products\/?$|\/in\/?$/.test(path) ||
        path === "/" ||
        (host.includes("shop.vivo.com") && /\/products\/phone/i.test(path)))
    ) {
      return vivoCatalog();
    }
    if (
      host.includes("oppo.com") &&
      (path === "/" || path === "/in" || /\/smartphones\/?$/.test(path))
    ) {
      return oppoCatalog();
    }
    if (host.includes("mi.com") || host.includes("xiaomi.com")) {
      // Live CategoryScraper handles tablet/watch/TV/store; curated phones as fallback
      if (
        /\/(tablet|watch-audio|tv-smart-home|store)(\/|$)/i.test(path)
      ) {
        return null;
      }
      return xiaomiCatalog();
    }
    if (host.includes("poco.in") || host.includes("po.co")) {
      return pocoCatalog();
    }
    if (host.includes("realme.com")) {
      return realmeCatalog();
    }
    if (host.includes("iqoo.com") || host.includes("shop.iqoo.com")) {
      return iqooCatalog();
    }
    if (host.includes("motorola.in") || host.includes("motorola.com")) {
      return motorolaCatalog();
    }
    if (host.includes("lavamobiles.com") || host.includes("lava.com")) {
      return lavaCatalog();
    }
    if (host.includes("hmd.com")) {
      return hmdCatalog();
    }
    return null;
  } catch {
    return null;
  }
}

export function isKnownBrandHub(url: string): boolean {
  return getCuratedBrandCatalog(url) != null;
}
