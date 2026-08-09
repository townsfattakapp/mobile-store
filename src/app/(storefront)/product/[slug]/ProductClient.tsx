"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ShieldCheck, ShoppingCart, CheckCircle2, Info } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { sanitizeAppleImageUrl } from "@/lib/catalog/scraper/appleInPrices";
import {
  expandColorImagesForVariants,
  resolveColorImageUrl,
} from "@/lib/catalog/colorImages";
import {
  ChatWithSellerButton,
  type ProductSellerContact,
} from "@/components/storefront/ChatWithSellerButton";

function fixImg(url?: string | null): string {
  if (!url) return "";
  return sanitizeAppleImageUrl(url) || url;
}

export default function ProductClient({
  initialProduct,
  sellerContact,
  productUrl,
}: {
  initialProduct: any;
  sellerContact: ProductSellerContact;
  productUrl: string;
}) {
  const variants = useMemo(
    () =>
      (initialProduct.variants || []).filter(
        (v: { status?: boolean | null }) => v.status !== false
      ),
    [initialProduct.variants]
  );
  
  // Extract unique colors and storages from variants if attributes exist
  const hasAttributes = variants.length > 0 && variants[0].attributes;

  const isLaptop = useMemo(() => {
    return variants.some(
      (v: any) =>
        v.attributes?.device_form === "laptop" ||
        v.attributes?.cpu ||
        v.attributes?.display_size
    ) ||
      String(initialProduct.specifications?.device_form || "") === "laptop" ||
      String(initialProduct.specifications?.product_type || "") === "laptop" ||
      String(initialProduct.categories?.slug || "").includes("laptop");
  }, [variants, initialProduct]);

  const colors = useMemo(() => {
    if (!hasAttributes) return [];
    const colorSet = new Set(variants.map((v: any) => v.attributes?.color).filter(Boolean));
    return Array.from(colorSet) as string[];
  }, [variants, hasAttributes]);

  const storages = useMemo(() => {
    if (!hasAttributes) return [];
    const storageSet = new Set(variants.map((v: any) => v.attributes?.storage).filter(Boolean));
    return Array.from(storageSet) as string[];
  }, [variants, hasAttributes]);

  const rams = useMemo(() => {
    if (!hasAttributes || !isLaptop) return [];
    return Array.from(
      new Set(variants.map((v: any) => v.attributes?.ram).filter(Boolean))
    ) as string[];
  }, [variants, hasAttributes, isLaptop]);

  const cpus = useMemo(() => {
    if (!hasAttributes || !isLaptop) return [];
    return Array.from(
      new Set(variants.map((v: any) => v.attributes?.cpu).filter(Boolean))
    ) as string[];
  }, [variants, hasAttributes, isLaptop]);

  const displaySizes = useMemo(() => {
    if (!hasAttributes || !isLaptop) return [];
    return Array.from(
      new Set(variants.map((v: any) => v.attributes?.display_size).filter(Boolean))
    ) as string[];
  }, [variants, hasAttributes, isLaptop]);

  const [selectedColor, setSelectedColor] = useState<string | null>(colors.length > 0 ? colors[0] : null);
  const [selectedStorage, setSelectedStorage] = useState<string | null>(storages.length > 0 ? storages[0] : null);
  const [selectedRam, setSelectedRam] = useState<string | null>(rams.length > 0 ? rams[0] : null);
  const [selectedCpu, setSelectedCpu] = useState<string | null>(cpus.length > 0 ? cpus[0] : null);
  const [selectedDisplay, setSelectedDisplay] = useState<string | null>(
    displaySizes.length > 0 ? displaySizes[0] : null
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(variants.length > 0 ? variants[0].id : null);

  const initialMainImage =
    fixImg(initialProduct.main_image_url) ||
    "https://placehold.co/800x1000/f8f9fa/a1a1aa?text=No+Image+Available";

  const imageDedupeKey = (url: string) => {
    try {
      const u = new URL(url);
      return `${u.host}${u.pathname}`.toLowerCase().replace(/\/+$/, "");
    } catch {
      return url.split("?")[0].toLowerCase();
    }
  };

  // Color → image: prefer *published* product maps, fall back to master for gaps only
  const colorImageMap = useMemo(() => {
    const merged: Record<string, string> = {};
    const put = (name: string, url: string, { overwrite = true } = {}) => {
      const fixed = fixImg(url);
      if (!name?.trim() || !fixed) return;
      const existingKey = Object.keys(merged).find(
        (k) => k.toLowerCase() === name.toLowerCase()
      );
      if (existingKey) {
        if (overwrite) merged[existingKey] = fixed;
        return;
      }
      merged[name] = fixed;
    };

    const pubColors = initialProduct.specifications?.color_images;
    const hasPublishedColors =
      pubColors &&
      typeof pubColors === "object" &&
      Object.keys(pubColors).length > 0;

    // Published product selection first
    if (hasPublishedColors) {
      Object.entries(pubColors).forEach(([k, v]) => {
        if (typeof v === "string" && v) put(k, v);
      });
    }

    // Master only fills colors the product map doesn't cover
    const masterColors =
      initialProduct.master_devices?.specifications?.color_images;
    if (masterColors && typeof masterColors === "object") {
      Object.entries(masterColors).forEach(([k, v]) => {
        if (typeof v !== "string" || !v) return;
        const already = resolveColorImageUrl(k, merged);
        if (already) return;
        put(k, v, { overwrite: false });
      });
    }

    // If nothing published yet, take full master map
    if (!hasPublishedColors && masterColors && typeof masterColors === "object") {
      Object.entries(masterColors).forEach(([k, v]) => {
        if (typeof v === "string" && v) put(k, v);
      });
    }

    const expanded = expandColorImagesForVariants(merged, colors);

    const mainKey = imageDedupeKey(initialMainImage);
    variants.forEach((v: any) => {
      const c = v.attributes?.color;
      if (!c || !v.image_url) return;
      const fixed = fixImg(v.image_url);
      if (!fixed) return;
      if (expanded[c]) return;
      if (resolveColorImageUrl(c, expanded)) return;
      if (imageDedupeKey(fixed) === mainKey) return;
      expanded[c] = fixed;
    });

    return expanded;
  }, [variants, initialProduct, colors, initialMainImage]);

  const resolveColorImage = (colorName: string) => {
    const direct = fixImg(resolveColorImageUrl(colorName, colorImageMap));
    if (direct) return direct;
    return "";
  };

  const getDynamicColor = (colorName: string) => {
    const lower = colorName.toLowerCase().replace(/[_-]+/g, " ").trim();
    // Specific marketing finishes first
    if (lower.includes("canyon") && lower.includes("orange")) return "#E36A2E";
    if (lower.includes("cosmic") && lower.includes("orange")) return "#F26C3B";
    if (lower.includes("moon") || lower.includes("silk")) return "#C8CCD1";
    if (lower.includes("raging") && lower.includes("blue")) return "#2B5BFF";
    if (lower.includes("glacier")) return "#D8E6F0";
    if (lower.includes("phantom") && lower.includes("black")) return "#1C1C1E";
    if (lower.includes("mist") && lower.includes("blue")) return "#A8C5D4";
    if (lower.includes("deep") && lower.includes("blue")) return "#2F4A6E";
    if (lower.includes("navy")) return "#1B2A4A";
    if (lower.includes("sage")) return "#A7B5A0";
    if (lower.includes("olive")) return "#6B7A4E";
    if (lower.includes("sky")) return "#9BB8D3";
    if (lower.includes("cloud")) return "#F4F4F0";
    if (lower.includes("cream") || lower.includes("ivory")) return "#F5F0E6";
    if (lower.includes("soft") && lower.includes("pink")) return "#F0D5DC";
    if (lower.includes("orange") || lower.includes("coral") || lower.includes("apricot"))
      return "#E36A2E";
    if (lower.includes("black") || lower.includes("midnight") || lower.includes("space") || lower.includes("obsidian"))
      return "#2C2C2E";
    if (lower.includes("white") || lower.includes("starlight") || lower.includes("pearl"))
      return "#F6F8F7";
    if (lower.includes("blue") || lower.includes("ultramarine") || lower.includes("ocean") || lower.includes("azure"))
      return "#4A7FBF";
    if (lower.includes("red") || lower.includes("product") || lower.includes("crimson"))
      return "#C81B2A";
    if (lower.includes("green") || lower.includes("teal") || lower.includes("pine") || lower.includes("jade"))
      return "#5F8F6B";
    if (lower.includes("yellow") || lower.includes("lemon")) return "#F0D45A";
    if (lower.includes("purple") || lower.includes("violet") || lower.includes("lavender") || lower.includes("lilac"))
      return "#8B7BB8";
    if (lower.includes("pink") || lower.includes("rose") || lower.includes("blush"))
      return "#E8A0B5";
    if (lower.includes("bronze") || lower.includes("copper")) return "#B87333";
    if (lower.includes("gold") || lower.includes("champagne")) return "#D4AF77";
    if (lower.includes("silver") || lower.includes("chrome")) return "#C9CDD1";
    if (lower.includes("titanium") && lower.includes("natural")) return "#8F8D84";
    if (lower.includes("titanium") && lower.includes("blue")) return "#2F3B4B";
    if (lower.includes("desert") || lower.includes("sand") || lower.includes("beige"))
      return "#C4A484";
    if (lower.includes("gray") || lower.includes("grey") || lower.includes("graphite") || lower.includes("titanium"))
      return "#8A8880";
    if (lower.includes("brown") || lower.includes("mocha") || lower.includes("chocolate"))
      return "#6B4F3A";
    return "#B0B0B0";
  };

  const galleryImages = useMemo(() => {
    const seen = new Set<string>();
    const images: string[] = [];
    const add = (u?: string | null) => {
      const fixed = fixImg(u);
      if (!fixed) return;
      const key = imageDedupeKey(fixed);
      if (seen.has(key)) return;
      seen.add(key);
      images.push(fixed);
    };

    const rows = Array.isArray(initialProduct.product_images)
      ? [...initialProduct.product_images].sort(
          (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        )
      : [];
    const pubGallery = Array.isArray(initialProduct.specifications?.gallery_images)
      ? (initialProduct.specifications.gallery_images as string[])
      : [];
    const masterGallery = Array.isArray(
      initialProduct.master_devices?.specifications?.gallery_images
    )
      ? (initialProduct.master_devices.specifications.gallery_images as string[])
      : [];

    // If admin published a curated set, NEVER pull the full master gallery
    const hasPublishedGallery = rows.length > 0 || pubGallery.length > 0;

    const publishedUrlSet = new Set<string>();
    if (hasPublishedGallery) {
      rows.forEach((r: any) => {
        const f = fixImg(r.url);
        if (f) publishedUrlSet.add(imageDedupeKey(f));
      });
      pubGallery.forEach((u) => {
        const f = fixImg(u);
        if (f) publishedUrlSet.add(imageDedupeKey(f));
      });
      const mainFixed = fixImg(initialMainImage);
      if (mainFixed) publishedUrlSet.add(imageDedupeKey(mainFixed));
      // Allow color heroes that were published on the product color map
      const pubColors = initialProduct.specifications?.color_images;
      if (pubColors && typeof pubColors === "object") {
        Object.values(pubColors).forEach((u) => {
          if (typeof u !== "string") return;
          const f = fixImg(u);
          if (f) publishedUrlSet.add(imageDedupeKey(f));
        });
      }
    }

    const selectedColorUrl = selectedColor
      ? resolveColorImage(selectedColor)
      : "";
    const selectedKey = selectedColorUrl
      ? imageDedupeKey(selectedColorUrl)
      : "";
    const mainKey = imageDedupeKey(initialMainImage);

    const otherColorOnly = new Set<string>();
    for (const [color, url] of Object.entries(colorImageMap)) {
      const fixed = fixImg(url);
      if (!fixed) continue;
      const key = imageDedupeKey(fixed);
      if (!key || key === mainKey) continue;
      if (selectedKey && key === selectedKey) continue;
      if (
        selectedColor &&
        resolveColorImage(color) &&
        imageDedupeKey(resolveColorImage(color)) === selectedKey
      ) {
        continue;
      }
      if (selectedColor) {
        const sameLabel =
          color.toLowerCase() === selectedColor.toLowerCase() ||
          resolveColorImageUrl(selectedColor, { [color]: fixed }) === fixed;
        if (sameLabel) continue;
      }
      otherColorOnly.add(key);
    }

    const allowed = (u?: string | null) => {
      const fixed = fixImg(u);
      if (!fixed) return false;
      const key = imageDedupeKey(fixed);
      if (otherColorOnly.has(key)) return false;
      if (hasPublishedGallery && !publishedUrlSet.has(key)) return false;
      return true;
    };

    // 1) Selected color / main — only if allowed by publish set
    if (selectedColorUrl && allowed(selectedColorUrl)) add(selectedColorUrl);
    else if (allowed(initialMainImage)) add(initialMainImage);

    // 2) Published product gallery (admin selection)
    rows.forEach((r: any) => {
      if (allowed(r.url)) add(r.url);
    });
    pubGallery.forEach((u) => {
      if (allowed(u)) add(u);
    });

    // 3) Master gallery only when nothing was curated at publish
    if (!hasPublishedGallery) {
      masterGallery.forEach((u) => {
        if (allowed(u)) add(u);
      });
    }

    if (allowed(initialMainImage)) add(initialMainImage);

    return images.length ? images : [initialMainImage];
  }, [
    initialMainImage,
    initialProduct,
    colorImageMap,
    selectedColor,
  ]);

  const [activeImage, setActiveImage] = useState<string>(
    (colors[0] && resolveColorImage(colors[0])) ||
      Object.values(colorImageMap).find((u) => u && !u.includes("undefined")) ||
      initialMainImage
  );

  // Remember last color we auto-synced the hero for — avoids fighting thumb clicks
  const lastAutoColorRef = React.useRef<string | null>(null);

  // Auto-select variant based on laptop config or phone color×storage
  useEffect(() => {
    if (!hasAttributes) return;
    if (isLaptop) {
      const match = variants.find((v: any) => {
        const a = v.attributes || {};
        if (selectedColor && a.color && a.color !== selectedColor) return false;
        if (selectedStorage && a.storage && a.storage !== selectedStorage)
          return false;
        if (selectedRam && a.ram && a.ram !== selectedRam) return false;
        if (selectedCpu && a.cpu && a.cpu !== selectedCpu) return false;
        if (
          selectedDisplay &&
          a.display_size &&
          a.display_size !== selectedDisplay
        )
          return false;
        return true;
      });
      if (match) setSelectedVariantId(match.id);
      return;
    }
    if (selectedColor && selectedStorage) {
      const match = variants.find(
        (v: any) =>
          v.attributes?.color === selectedColor &&
          v.attributes?.storage === selectedStorage
      );
      if (match) setSelectedVariantId(match.id);
    }
  }, [
    selectedColor,
    selectedStorage,
    selectedRam,
    selectedCpu,
    selectedDisplay,
    variants,
    hasAttributes,
    isLaptop,
  ]);

  // Only when the *color* changes: jump hero to that color's shot.
  // Do NOT re-run on galleryImages/activeImage — that steals thumb clicks.
  useEffect(() => {
    if (!selectedColor) return;
    if (lastAutoColorRef.current === selectedColor) return;
    lastAutoColorRef.current = selectedColor;

    const mapped = resolveColorImage(selectedColor);
    const fromVariant = fixImg(
      variants.find(
        (v: any) => v.attributes?.color === selectedColor && v.image_url
      )?.image_url
    );
    const mainKey = imageDedupeKey(initialMainImage);
    const mappedIsSpecific = mapped && imageDedupeKey(mapped) !== mainKey;
    const variantIsSpecific =
      fromVariant && imageDedupeKey(fromVariant) !== mainKey;

    const next =
      (mappedIsSpecific ? mapped : "") ||
      (variantIsSpecific ? fromVariant : "") ||
      mapped ||
      fromVariant ||
      initialMainImage;
    if (next) setActiveImage(next);
  }, [selectedColor, variants, initialMainImage, colorImageMap]);

  const pickGalleryImage = (img: string) => {
    setActiveImage(img);
  };

  const selectedVariant = variants.find((v: any) => v.id === selectedVariantId) || null;

  const displayMrp = selectedVariant ? selectedVariant.mrp : initialProduct.mrp;
  const displayPrice = selectedVariant
    ? selectedVariant.selling_price
    : initialProduct.selling_price;
  const displayStock = selectedVariant
    ? selectedVariant.stock_quantity
    : initialProduct.stock_quantity;
  const discount =
    displayMrp > displayPrice
      ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
      : 0;
  
  const isUsed = initialProduct.type === "used_mobile";

  const attrs = selectedVariant?.attributes || {};
  const whatsappMessageInput = useMemo(
    () => ({
      productName: String(initialProduct.name || ""),
      brandName: initialProduct.brand?.name || null,
      storeName: sellerContact.name || null,
      variantLabel: selectedVariant?.name || null,
      ram: selectedRam || attrs.ram || null,
      storage: selectedStorage || attrs.storage || null,
      color: selectedColor || attrs.color || null,
      cpu: selectedCpu || attrs.cpu || null,
      displaySize: selectedDisplay || attrs.display_size || null,
      price: Number(displayPrice) || null,
      productUrl,
    }),
    [
      initialProduct.name,
      initialProduct.brand?.name,
      sellerContact.name,
      selectedVariant?.name,
      selectedRam,
      selectedStorage,
      selectedColor,
      selectedCpu,
      selectedDisplay,
      attrs.ram,
      attrs.storage,
      attrs.color,
      attrs.cpu,
      attrs.display_size,
      displayPrice,
      productUrl,
    ]
  );

  // Starting "From" price = cheapest active variant
  const fromPrice = useMemo(() => {
    if (!variants.length) return displayPrice;
    const prices = variants
      .map((v: any) => Number(v.selling_price) || 0)
      .filter((p: number) => p > 0);
    return prices.length ? Math.min(...prices) : displayPrice;
  }, [variants, displayPrice]);

  return (
    <div className="max-w-7xl mx-auto pb-24 px-4 sm:px-6">
      <div className="mb-10 text-center md:text-left border-b pb-8">
        <h2 className="text-[#bf4800] font-semibold tracking-wide text-xs sm:text-sm mb-2 uppercase">
          {isUsed ? "Quality Checked Pre-Owned" : "New"}
        </h2>
        <h1 className="text-4xl md:text-[56px] font-semibold tracking-tight text-[#1d1d1f] leading-tight mb-4">
          Buy {initialProduct.name}
        </h1>
        <div className="text-xl text-[#6e6e73] font-medium flex items-center justify-center md:justify-start gap-2">
          From ₹{Number(fromPrice).toLocaleString("en-IN")}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-20">
        <div className="lg:col-span-7 relative">
          <div className="sticky top-24">
            <div className="bg-[#f5f5f7] rounded-[32px] md:rounded-[40px] p-6 md:p-12 flex items-center justify-center aspect-square md:aspect-[4/3] overflow-hidden mb-6 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-[#0B5cff]/5 blur-[80px] rounded-full pointer-events-none" />

              {discount > 0 && (
                <div className="absolute top-6 left-6 md:top-8 md:left-8 bg-[#e3000f] text-white font-semibold text-xs px-3 py-1 rounded-full tracking-wide z-10">
                  Save {discount}%
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={activeImage}
                src={activeImage}
                alt={`${initialProduct.name}${selectedColor ? ` ${selectedColor}` : ""}`}
                className="object-contain w-full h-full max-h-[400px] md:max-h-[600px] hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply z-10 relative drop-shadow-xl"
                onError={(e) => {
                  const fallback =
                    (selectedColor && resolveColorImage(selectedColor)) ||
                    Object.values(colorImageMap).find(Boolean) ||
                    initialMainImage;
                  if (fallback && e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  }
                }}
              />
            </div>

            {galleryImages.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-2 justify-center [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {galleryImages.map((img: string) => {
                  const selected =
                    imageDedupeKey(activeImage) === imageDedupeKey(img);
                  return (
                    <button
                      key={imageDedupeKey(img)}
                      type="button"
                      onClick={() => pickGalleryImage(img)}
                      className={`w-20 h-20 md:w-24 md:h-24 flex-shrink-0 rounded-2xl p-2 border-2 transition-all bg-[#f5f5f7] ${
                        selected
                          ? "border-[#0071e3] ring-1 ring-[#0071e3]"
                          : "border-transparent hover:border-[#d2d2d7]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-contain mix-blend-multiply"
                        onError={(e) => {
                          const btn = e.currentTarget
                            .parentElement as HTMLElement | null;
                          if (btn) btn.style.display = "none";
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col pt-4">
          {isUsed && initialProduct.used_device_inspections && (
            <div className="mb-10 p-5 bg-[#f5f5f7] rounded-2xl flex gap-4 items-start">
              <ShieldCheck className="text-[#0071e3] shrink-0 w-6 h-6 mt-0.5" />
              <div>
                <h3 className="font-semibold text-[#1d1d1f] text-lg mb-1">
                  Apple Certified Pre-Owned Equivalent
                </h3>
                <p className="text-[#6e6e73] text-sm leading-relaxed">
                  This device has passed a rigorous 20-point hardware and software inspection.
                  Backed by our premium quality guarantee.
                </p>
              </div>
            </div>
          )}

          {hasAttributes && isLaptop && displaySizes.length > 0 && (
            <div className="mb-12">
              <h3 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight mb-6">
                <span className="text-[#6e6e73]">Display.</span> Pick your screen size.
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {displaySizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedDisplay(size)}
                    className={`border-2 rounded-2xl p-5 text-center transition-all ${
                      selectedDisplay === size
                        ? "border-[#0071e3] bg-[#0071e3]/5 ring-1 ring-[#0071e3]"
                        : "border-[#d2d2d7] hover:border-[#6e6e73]"
                    }`}
                  >
                    <span className="text-xl font-semibold text-[#1d1d1f]">{size}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasAttributes && isLaptop && cpus.length > 0 && (
            <div className="mb-12">
              <h3 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight mb-6">
                <span className="text-[#6e6e73]">Processor.</span> Choose your chip.
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {cpus.map((cpu) => (
                  <button
                    key={cpu}
                    type="button"
                    onClick={() => setSelectedCpu(cpu)}
                    className={`border-2 rounded-2xl p-5 text-left transition-all ${
                      selectedCpu === cpu
                        ? "border-[#0071e3] bg-[#0071e3]/5 ring-1 ring-[#0071e3]"
                        : "border-[#d2d2d7] hover:border-[#6e6e73]"
                    }`}
                  >
                    <span className="text-lg font-semibold text-[#1d1d1f]">{cpu}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasAttributes && isLaptop && rams.length > 0 && (
            <div className="mb-12">
              <h3 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight mb-6">
                <span className="text-[#6e6e73]">Memory.</span> How much RAM?
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {rams.map((ram) => (
                  <button
                    key={ram}
                    type="button"
                    onClick={() => setSelectedRam(ram)}
                    className={`border-2 rounded-2xl p-5 text-center transition-all ${
                      selectedRam === ram
                        ? "border-[#0071e3] bg-[#0071e3]/5 ring-1 ring-[#0071e3]"
                        : "border-[#d2d2d7] hover:border-[#6e6e73]"
                    }`}
                  >
                    <span className="text-2xl font-semibold text-[#1d1d1f]">{ram}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasAttributes && colors.length > 0 && (
            <div className="mb-12">
              <h3 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight mb-6">
                <span className="text-[#6e6e73]">Color.</span> Which is best for you?
              </h3>
              <p className="font-medium text-[#1d1d1f] mb-4">{selectedColor}</p>

              <div className="flex flex-wrap gap-4">
                {colors.map((color) => {
                  const fill = getDynamicColor(color);
                  const selected = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      title={color}
                      aria-label={color}
                      aria-pressed={selected}
                      className={`w-[52px] h-[52px] rounded-full p-[3px] transition-all ${
                        selected
                          ? "ring-2 ring-offset-2 ring-[#0071e3]"
                          : "hover:ring-2 hover:ring-offset-2 hover:ring-gray-300"
                      }`}
                    >
                      <span
                        className="block w-full h-full rounded-full border border-black/10 shadow-inner"
                        style={{ backgroundColor: fill }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasAttributes && storages.length > 0 && (
            <div className="mb-12">
              <h3 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight mb-6">
                <span className="text-[#6e6e73]">
                  {isLaptop ? "SSD." : "Storage."}
                </span>{" "}
                How much space do you need?
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {storages.map((storage) => {
                  const storageVariant = variants.find(
                    (v: any) =>
                      v.attributes?.storage === storage &&
                      (!selectedColor || v.attributes?.color === selectedColor) &&
                      (!isLaptop ||
                        !selectedRam ||
                        !v.attributes?.ram ||
                        v.attributes.ram === selectedRam) &&
                      (!isLaptop ||
                        !selectedCpu ||
                        !v.attributes?.cpu ||
                        v.attributes.cpu === selectedCpu)
                  );
                  const storagePrice = storageVariant?.selling_price;
                  return (
                    <button
                      key={storage}
                      type="button"
                      onClick={() => setSelectedStorage(storage)}
                      className={`border-2 rounded-2xl p-6 flex flex-col items-center justify-center transition-all ${
                        selectedStorage === storage
                          ? "border-[#0071e3] bg-[#0071e3]/5 ring-1 ring-[#0071e3]"
                          : "border-[#d2d2d7] hover:border-[#6e6e73]"
                      }`}
                    >
                      <span className="text-2xl font-semibold text-[#1d1d1f]">{storage}</span>
                      {storagePrice ? (
                        <span className="text-sm text-[#6e6e73] mt-1">
                          ₹{Number(storagePrice).toLocaleString("en-IN")}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!hasAttributes && variants.length > 0 && (
            <div className="mb-12">
              <h3 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight mb-6">
                <span className="text-[#6e6e73]">Model.</span> Choose your configuration.
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {variants.map((variant: any) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`border-2 rounded-2xl p-5 flex justify-between items-center transition-all ${
                      selectedVariantId === variant.id
                        ? "border-[#0071e3] bg-[#0071e3]/5 ring-1 ring-[#0071e3]"
                        : "border-[#d2d2d7] hover:border-[#6e6e73]"
                    }`}
                  >
                    <span className="font-semibold text-[#1d1d1f]">{variant.name}</span>
                    <span className="text-[#6e6e73]">
                      ₹{Number(variant.selling_price).toLocaleString("en-IN")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {initialProduct.specifications?.offers?.length > 0 && (
            <div className="mb-12 border-t border-[#d2d2d7] pt-8">
              <h3 className="text-xl font-semibold text-[#1d1d1f] tracking-tight mb-4 flex items-center gap-2">
                Available Offers
              </h3>
              <div className="bg-[#f5f5f7] rounded-2xl p-6 space-y-4">
                {initialProduct.specifications.offers.map((offer: string, idx: number) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <CheckCircle2 size={20} className="text-[#0071e3] shrink-0" />
                    <span className="text-[#1d1d1f] text-sm leading-relaxed">{offer}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 bg-[#f5f5f7] rounded-3xl p-8">
            <h3 className="text-2xl font-semibold text-[#1d1d1f] mb-6">
              Your new {initialProduct.name}.
            </h3>

            <div className="flex flex-col mb-8 pb-8 border-b border-[#d2d2d7]">
              <div className="text-3xl font-semibold text-[#1d1d1f] mb-1">
                ₹{Number(displayPrice).toLocaleString("en-IN")}
              </div>
              {displayMrp > displayPrice && (
                <div className="text-[#6e6e73] line-through">
                  MRP ₹{Number(displayMrp).toLocaleString("en-IN")}
                </div>
              )}
              <p className="text-sm text-[#6e6e73] mt-2">MRP inclusive of all taxes.</p>
              {selectedColor && selectedStorage && (
                <p className="text-sm text-[#1d1d1f] mt-3 font-medium">
                  {selectedColor} · {selectedStorage}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mb-8">
              <span className="font-medium text-[#1d1d1f]">Availability</span>
              {displayStock > 0 ? (
                <span className="text-green-600 font-medium">In Stock</span>
              ) : (
                <span className="text-[#e3000f] font-medium">Out of Stock</span>
              )}
            </div>

            <button
              type="button"
              disabled={displayStock === 0}
              onClick={() => {
                const { addItem } = useCartStore.getState();
                addItem({
                  productId: initialProduct.id,
                  variantId: selectedVariant ? selectedVariant.id : null,
                  name: initialProduct.name,
                  variantName: selectedVariant ? selectedVariant.name : "Standard",
                  sku: selectedVariant ? selectedVariant.sku : initialProduct.sku,
                  price: displayPrice,
                  image: fixImg(selectedVariant?.image_url) || activeImage,
                  quantity: 1,
                  stock_quantity: displayStock,
                });
              }}
              className={`w-full py-4 rounded-full font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
                displayStock > 0
                  ? "bg-[#0071e3] text-white hover:bg-[#0077ED] shadow-sm"
                  : "bg-[#e8e8ed] text-[#6e6e73] cursor-not-allowed"
              }`}
            >
              <ShoppingCart size={20} />
              {displayStock > 0 ? "Add to Bag" : "Currently Unavailable"}
            </button>

            <ChatWithSellerButton
              seller={sellerContact}
              messageInput={whatsappMessageInput}
              disabled={!initialProduct?.id || !productUrl}
            />

            {displayStock > 0 && (
              <div className="text-center mt-6 text-[#6e6e73] text-sm flex items-center justify-center gap-2">
                <Info size={16} /> Free delivery and returns.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
