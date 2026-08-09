"use client";

import React, { useMemo } from "react";
import { Check, ImageOff, Star } from "lucide-react";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";

export type ProductImageRow = {
  id?: string;
  url: string;
  alt_text?: string | null;
  sort_order?: number;
};

function baseColorLabel(color: string): string {
  return String(color || "")
    .replace(
      /\s*\((good|very\s*good|superb|excellent|fair|acceptable)\)\s*$/i,
      ""
    )
    .trim();
}

type Props = {
  mainImageUrl: string;
  gallery: ProductImageRow[];
  colorImages: Record<string, string>;
  variantColors: string[]; // colors from variants (enabled preferred)
  enabledVariantColors: string[];
  /** Optional R2 key prefix, e.g. edit/{productId} */
  uploadPrefix?: string;
  onChange: (next: {
    mainImageUrl: string;
    gallery: ProductImageRow[];
    colorImages: Record<string, string>;
  }) => void;
};

export function ProductImagesPanel({
  mainImageUrl,
  gallery,
  colorImages,
  variantColors,
  enabledVariantColors,
  uploadPrefix = "edit/product",
  onChange,
}: Props) {
  const galleryUrls = useMemo(() => {
    const urls: string[] = [];
    if (mainImageUrl) urls.push(mainImageUrl);
    for (const g of gallery) {
      if (g.url && !urls.includes(g.url)) urls.push(g.url);
    }
    return urls;
  }, [mainImageUrl, gallery]);

  const colorEntries = useMemo(
    () => Object.entries(colorImages || {}).filter(([, url]) => !!url),
    [colorImages]
  );

  const unusedColorKeys = useMemo(() => {
    const enabled = new Set(
      enabledVariantColors.map((c) => c.toLowerCase())
    );
    const any = new Set(variantColors.map((c) => c.toLowerCase()));
    return colorEntries
      .map(([k]) => k)
      .filter((k) => {
        const low = k.toLowerCase();
        // Prefer enabled; if no enabled list, fall back to any variant color
        if (enabled.size > 0) return !enabled.has(low);
        if (any.size > 0) return !any.has(low);
        return false;
      });
  }, [colorEntries, enabledVariantColors, variantColors]);

  const emitGallery = (urls: string[], main?: string) => {
    const nextMain = main ?? (urls.includes(mainImageUrl) ? mainImageUrl : urls[0] || "");
    const ordered = nextMain
      ? [nextMain, ...urls.filter((u) => u !== nextMain)]
      : urls;
    onChange({
      mainImageUrl: nextMain,
      gallery: ordered.map((url, i) => ({
        url,
        sort_order: i,
        alt_text: `Image ${i + 1}`,
      })),
      colorImages,
    });
  };

  const toggleGalleryUrl = (url: string) => {
    if (galleryUrls.includes(url)) {
      const next = galleryUrls.filter((u) => u !== url);
      emitGallery(next);
    } else {
      emitGallery([...galleryUrls, url]);
    }
  };

  const setAsMain = (url: string) => {
    if (!galleryUrls.includes(url)) return;
    emitGallery(galleryUrls, url);
  };

  const removeColor = (color: string) => {
    const next = { ...colorImages };
    delete next[color];
    onChange({
      mainImageUrl,
      gallery,
      colorImages: next,
    });
  };

  const setColorImage = (color: string, url: string) => {
    onChange({
      mainImageUrl,
      gallery,
      colorImages: { ...colorImages, [color]: url },
    });
  };

  /** Drop color→image rows not used by any enabled variant */
  const smartKeepEnabledColorsOnly = () => {
    const keep = new Set(enabledVariantColors.map((c) => c.toLowerCase()));
    const next: Record<string, string> = {};
    for (const [color, url] of colorEntries) {
      if (keep.has(color.toLowerCase())) next[color] = url;
    }
    onChange({ mainImageUrl, gallery, colorImages: next });
  };

  /**
   * Collapse "Black (Good)" / "Black (Very Good)" → prefer one image per base color,
   * mapping every enabled grade of that base color to the chosen URL.
   */
  const smartOnePerBaseColor = () => {
    const byBase = new Map<string, { color: string; url: string; score: number }>();
    const gradeScore = (label: string) => {
      if (/superb/i.test(label)) return 4;
      if (/very\s*good/i.test(label)) return 3;
      if (/excellent/i.test(label)) return 3;
      if (/good/i.test(label)) return 2;
      return 1;
    };

    for (const [color, url] of colorEntries) {
      const base = baseColorLabel(color).toLowerCase() || color.toLowerCase();
      const score = gradeScore(color);
      const prev = byBase.get(base);
      if (!prev || score > prev.score) {
        byBase.set(base, { color, url, score });
      }
    }

    const next: Record<string, string> = {};
    const targets =
      enabledVariantColors.length > 0 ? enabledVariantColors : variantColors;

    if (targets.length > 0) {
      for (const color of targets) {
        const base = baseColorLabel(color).toLowerCase() || color.toLowerCase();
        const pick = byBase.get(base);
        if (pick?.url) next[color] = pick.url;
      }
    } else {
      for (const [, pick] of byBase) {
        next[baseColorLabel(pick.color) || pick.color] = pick.url;
      }
    }

    onChange({ mainImageUrl, gallery, colorImages: next });
  };

  /** Drop duplicate gallery URLs (same file kept once) */
  const smartDedupeGallery = () => {
    const seen = new Set<string>();
    const next: string[] = [];
    for (const url of galleryUrls) {
      if (seen.has(url)) continue;
      seen.add(url);
      next.push(url);
    }
    emitGallery(next);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Upload images</h2>
          <p className="text-sm text-gray-500">
            Files are converted to WebP, kept under ~200KB, and stored on Cloudflare R2.
            Click Save Changes after uploading.
          </p>
        </div>
        <AdminImageUploader
          label=""
          value=""
          onChange={(url) => {
            if (!url) return;
            const next = galleryUrls.includes(url) ? galleryUrls : [...galleryUrls, url];
            emitGallery(next, mainImageUrl || url);
          }}
          prefix={uploadPrefix}
          multiple
          hidePreview
          onUploadedMany={(urls) => {
            const merged = [...galleryUrls];
            for (const url of urls) {
              if (!merged.includes(url)) merged.push(url);
            }
            emitGallery(merged, mainImageUrl || merged[0] || "");
          }}
          allowUrlPaste
          helpText="Upload one or many. New files are appended to the gallery; the first becomes main if none is set."
        />
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Gallery images</h2>
            <p className="text-sm text-gray-500">
              Uncheck to remove from storefront. Star sets the main product image.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={smartDedupeGallery}
              className="rounded-full border px-3 py-1.5 hover:bg-gray-50"
            >
              Deduplicate
            </button>
            <button
              type="button"
              onClick={() => emitGallery(galleryUrls.slice(0, 1))}
              className="rounded-full border px-3 py-1.5 hover:bg-gray-50"
            >
              Main only
            </button>
          </div>
        </div>

        {galleryUrls.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-gray-400">
            <ImageOff size={28} />
            <p className="text-sm">No gallery images on this product.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {galleryUrls.map((url, idx) => {
              const isMain = url === mainImageUrl;
              return (
                <div
                  key={`${url}-${idx}`}
                  className={`relative rounded-xl border-2 overflow-hidden bg-neutral-50 aspect-square ${
                    isMain ? "border-black" : "border-neutral-200"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Gallery ${idx + 1}`}
                    className="h-full w-full object-contain p-2"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <button
                      type="button"
                      onClick={() => setAsMain(url)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
                        isMain
                          ? "bg-white text-black"
                          : "bg-white/20 text-white hover:bg-white/30"
                      }`}
                      title="Set as main image"
                    >
                      <Star size={12} fill={isMain ? "currentColor" : "none"} />
                      {isMain ? "Main" : "Make main"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleGalleryUrl(url)}
                      className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Color images</h2>
            <p className="text-sm text-gray-500">
              Shown when customers pick a color. Remove grades you don’t sell, or
              collapse to one photo per base color.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={smartKeepEnabledColorsOnly}
              disabled={enabledVariantColors.length === 0}
              className="rounded-full border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
            >
              Keep enabled colors only
              {unusedColorKeys.length > 0 ? ` (−${unusedColorKeys.length})` : ""}
            </button>
            <button
              type="button"
              onClick={smartOnePerBaseColor}
              className="rounded-full border px-3 py-1.5 hover:bg-gray-50"
            >
              One image per base color
            </button>
          </div>
        </div>

        {colorEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed py-10 text-center text-sm text-gray-400">
            No color-specific images mapped yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {colorEntries.map(([color, url]) => {
              const unused = unusedColorKeys.includes(color);
              const enabled = enabledVariantColors.some(
                (c) => c.toLowerCase() === color.toLowerCase()
              );
              return (
                <div
                  key={color}
                  className={`flex gap-3 rounded-xl border p-3 ${
                    unused ? "border-dashed opacity-70" : "border-neutral-200"
                  }`}
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-50 border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={color}
                      className="h-full w-full object-contain p-1"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm text-[#1d1d1f] truncate">
                          {color}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Base: {baseColorLabel(color) || "—"}
                          {enabled ? (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-emerald-700">
                              <Check size={11} /> On sale
                            </span>
                          ) : unused ? (
                            <span className="ml-2 text-amber-700">
                              Not on an enabled variant
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeColor(color)}
                        className="text-xs text-red-600 hover:underline shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                    {galleryUrls.length > 0 && (
                      <select
                        value={galleryUrls.includes(url) ? url : ""}
                        onChange={(e) => {
                          if (e.target.value) setColorImage(color, e.target.value);
                        }}
                        className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white"
                      >
                        <option value="">Keep current file</option>
                        {galleryUrls.map((g) => (
                          <option key={g} value={g}>
                            {g === mainImageUrl ? "Main · " : ""}
                            …{g.slice(-36)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
