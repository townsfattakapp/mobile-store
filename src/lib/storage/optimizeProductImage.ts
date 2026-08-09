import sharp from "sharp";

export type OptimizedProductImage = {
  buffer: Buffer;
  contentType: "image/webp";
  ext: "webp";
  bytes: number;
  width: number;
  height: number;
  quality: number;
};

/** Hard ceiling — keep product photos snappy on mobile. */
export const PRODUCT_IMAGE_MAX_BYTES = 200 * 1024;
/** Prefer landing around here when quality allows. */
export const PRODUCT_IMAGE_TARGET_BYTES = 170 * 1024;
export const PRODUCT_IMAGE_MAX_EDGE = 1400;
export const PRODUCT_IMAGE_UPLOAD_MAX_RAW_BYTES = 12 * 1024 * 1024;

/**
 * Encode a product photo as WebP under a byte budget.
 * Reduces quality first, then dimensions, until <= maxBytes (or best effort).
 */
export async function encodeWebpUnderBudget(
  input: Buffer,
  options?: {
    maxBytes?: number;
    maxEdge?: number;
    minQuality?: number;
    minEdge?: number;
  }
): Promise<OptimizedProductImage> {
  const maxBytes = options?.maxBytes ?? PRODUCT_IMAGE_MAX_BYTES;
  const minQuality = options?.minQuality ?? 48;
  const minEdge = options?.minEdge ?? 720;
  let edge = options?.maxEdge ?? PRODUCT_IMAGE_MAX_EDGE;
  let quality = 80;

  let best: OptimizedProductImage | null = null;

  for (let attempt = 0; attempt < 14; attempt++) {
    const { data, info } = await sharp(input, { failOn: "none", unlimited: true })
      .rotate()
      .resize({
        width: edge,
        height: edge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality,
        alphaQuality: Math.min(100, quality + 10),
        effort: 5,
        smartSubsample: true,
      })
      .toBuffer({ resolveWithObject: true });

    const result: OptimizedProductImage = {
      buffer: data,
      contentType: "image/webp",
      ext: "webp",
      bytes: data.byteLength,
      width: info.width,
      height: info.height,
      quality,
    };

    if (!best || result.bytes < best.bytes) best = result;

    if (result.bytes <= maxBytes) {
      return result;
    }

    if (quality > minQuality + 8) {
      quality -= 7;
      continue;
    }

    if (edge > minEdge) {
      edge = Math.max(minEdge, Math.round(edge * 0.82));
      quality = Math.max(minQuality, Math.min(quality, 68));
      continue;
    }

    if (quality > minQuality) {
      quality = Math.max(minQuality, quality - 5);
      continue;
    }

    break;
  }

  return best!;
}

/**
 * Full product-image pipeline: optional white-bg cleanup, then WebP under budget.
 */
export async function optimizeProductImage(
  input: Buffer,
  options?: {
    maxBytes?: number;
    maxEdge?: number;
    knockOutWhite?: boolean;
  }
): Promise<OptimizedProductImage> {
  let work = input;

  if (options?.knockOutWhite !== false) {
    try {
      const { knockoutWhiteBackground } = await import(
        "@/lib/storage/removeWhiteBackground"
      );
      const knocked = await knockoutWhiteBackground(work, {
        maxEdge: options?.maxEdge ?? PRODUCT_IMAGE_MAX_EDGE,
      });
      work = Buffer.from(knocked.buffer);
    } catch (e) {
      console.warn(
        "optimizeProductImage: knockout skipped:",
        (e as Error)?.message || e
      );
    }
  }

  return encodeWebpUnderBudget(work, {
    maxBytes: options?.maxBytes ?? PRODUCT_IMAGE_MAX_BYTES,
    maxEdge: options?.maxEdge ?? PRODUCT_IMAGE_MAX_EDGE,
  });
}
