/** Detect how "full" a product photo is and how much to zoom sparse ones. */

export type ContentFit = {
  /** 1 = leave as-is; >1 only when the subject is small in-frame */
  scale: number;
  /** 0–1 transform-origin */
  originX: number;
  originY: number;
};

const DEFAULT_FIT: ContentFit = { scale: 1, originX: 0.5, originY: 0.5 };
const cache = new Map<string, ContentFit>();

/** Subject should occupy a modest share of the source — not wall-to-wall. */
const TARGET_FILL = 0.56;
/** Already full enough in the source — never enlarge. */
const SKIP_IF_FILL_ABOVE = 0.5;
/** Gentle lift only for sparse shots (e.g. OnePlus with huge margins). */
const MAX_SCALE = 1.2;
const CACHE_VERSION = "v3";

function isBackgroundPixel(r: number, g: number, b: number, a: number) {
  if (a < 12) return true;
  // Near-white / cream studio backgrounds common on phone PNGs/JPEGs
  if (r >= 242 && g >= 242 && b >= 242) return true;
  if (r >= 248 && g >= 245 && b >= 235) return true; // warm paper
  return false;
}

function analyzeImageData(data: ImageData, w: number, h: number): ContentFit {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 180));
  const { data: px } = data;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (isBackgroundPixel(px[i], px[i + 1], px[i + 2], px[i + 3])) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return DEFAULT_FIT;

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  const fill = Math.max(contentW / w, contentH / h);

  if (fill >= SKIP_IF_FILL_ABOVE) {
    return {
      scale: 1,
      originX: (minX + maxX) / 2 / w,
      originY: (minY + maxY) / 2 / h,
    };
  }

  const scale = Math.min(MAX_SCALE, TARGET_FILL / Math.max(fill, 0.15));
  // Only zoom if meaningful gain
  if (scale < 1.06) return DEFAULT_FIT;

  return {
    scale: Math.round(scale * 1000) / 1000,
    originX: (minX + maxX) / 2 / w,
    originY: (minY + maxY) / 2 / h,
  };
}

/**
 * Measure subject size inside a product image (whitespace → zoom only those).
 * Uses the Next.js image optimizer (same-origin) so canvas isn't CORS-blocked.
 */
export function measureProductImageFit(src: string): Promise<ContentFit> {
  if (!src || src.includes("placehold.co")) {
    return Promise.resolve(DEFAULT_FIT);
  }
  const cached = cache.get(`${CACHE_VERSION}:${src}`);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new window.Image();
    img.decoding = "async";

    const finish = (fit: ContentFit) => {
      cache.set(`${CACHE_VERSION}:${src}`, fit);
      resolve(fit);
    };

    img.onload = () => {
      try {
        const maxEdge = 360;
        const nw = img.naturalWidth || img.width;
        const nh = img.naturalHeight || img.height;
        if (!nw || !nh) {
          finish(DEFAULT_FIT);
          return;
        }
        const ratio = Math.min(1, maxEdge / Math.max(nw, nh));
        const w = Math.max(1, Math.round(nw * ratio));
        const h = Math.max(1, Math.round(nh * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          finish(DEFAULT_FIT);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        finish(analyzeImageData(data, w, h));
      } catch {
        finish(DEFAULT_FIT);
      }
    };

    img.onerror = () => {
      // Retry once with direct URL + CORS (some CDNs allow it)
      const direct = new window.Image();
      direct.crossOrigin = "anonymous";
      direct.onload = () => {
        try {
          const w = Math.min(360, direct.naturalWidth || 360);
          const h = Math.round(
            ((direct.naturalHeight || 360) / (direct.naturalWidth || 360)) * w
          );
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            finish(DEFAULT_FIT);
            return;
          }
          ctx.drawImage(direct, 0, 0, canvas.width, canvas.height);
          finish(analyzeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), canvas.width, canvas.height));
        } catch {
          finish(DEFAULT_FIT);
        }
      };
      direct.onerror = () => finish(DEFAULT_FIT);
      direct.src = src;
    };

    // Same-origin optimizer — readable by canvas
    img.src = `/_next/image?url=${encodeURIComponent(src)}&w=384&q=70`;
  });
}
