import sharp from "sharp";

export type KnockoutResult = {
  buffer: Buffer;
  contentType: string;
  ext: string;
};

function isNearWhite(r: number, g: number, b: number, threshold: number, maxChroma: number) {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= threshold && max - min <= maxChroma;
}

/**
 * Remove solid / near-white studio backdrops from scraped product photos.
 *
 * Uses edge flood-fill so white areas connected to the border become transparent,
 * while white phone bodies / on-screen UI inland are preserved.
 * Outputs WebP with alpha.
 */
export async function knockoutWhiteBackground(
  input: Buffer,
  options?: {
    threshold?: number;
    maxChroma?: number;
    maxEdge?: number;
  }
): Promise<KnockoutResult> {
  const threshold = options?.threshold ?? 228;
  const maxChroma = options?.maxChroma ?? 28;
  const maxEdge = options?.maxEdge ?? 1600;

  const { data, info } = await sharp(input, { failOn: "none", unlimited: true })
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels < 4 || width < 8 || height < 8) {
    const fallback = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer();
    return { buffer: fallback, contentType: "image/webp", ext: "webp" };
  }

  const px = data; // Uint8Array / Buffer
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let qh = 0;
  let qt = 0;

  const enqueue = (x: number, y: number) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const o = idx * 4;
    if (!isNearWhite(px[o], px[o + 1], px[o + 2], threshold, maxChroma)) return;
    visited[idx] = 1;
    queue[qt++] = idx;
  };

  // Seed from all border pixels
  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (qh < qt) {
    const idx = queue[qh++];
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }

  // Soft feather: transparent seeded whites + slightly softer neighbors
  const softThreshold = threshold - 14;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const o = idx * 4;
      if (visited[idx]) {
        px[o + 3] = 0;
        continue;
      }
      // Anti-alias fringe: near-white next to removed bg
      const r = px[o];
      const g = px[o + 1];
      const b = px[o + 2];
      if (!isNearWhite(r, g, b, softThreshold, maxChroma + 8)) continue;
      let nearHole = false;
      if (x > 0 && visited[idx - 1]) nearHole = true;
      else if (x + 1 < width && visited[idx + 1]) nearHole = true;
      else if (y > 0 && visited[idx - width]) nearHole = true;
      else if (y + 1 < height && visited[idx + width]) nearHole = true;
      if (!nearHole) continue;
      const min = Math.min(r, g, b);
      const t = Math.min(1, Math.max(0, (min - softThreshold) / (threshold - softThreshold + 1)));
      px[o + 3] = Math.round(px[o + 3] * (1 - t * 0.85));
    }
  }

  // Only rewrite if we actually knocked something out (avoid wrecking lifestyle shots)
  let cleared = 0;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] === 0) cleared += 1;
  }
  const clearedRatio = cleared / (width * height);

  let pipeline = sharp(px, {
    raw: { width, height, channels: 4 },
  }).resize({
    width: maxEdge,
    height: maxEdge,
    fit: "inside",
    withoutEnlargement: true,
  });

  // If almost nothing cleared, keep original colours but still store as webp (may already have alpha)
  if (clearedRatio < 0.01) {
    const buffer = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer();
    return { buffer, contentType: "image/webp", ext: "webp" };
  }

  const buffer = await pipeline.webp({ quality: 88, alphaQuality: 100 }).toBuffer();
  return { buffer, contentType: "image/webp", ext: "webp" };
}
