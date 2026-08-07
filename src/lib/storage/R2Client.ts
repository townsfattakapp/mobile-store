import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { knockoutWhiteBackground } from "@/lib/storage/removeWhiteBackground";

function r2Env() {
  return {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucketName: process.env.R2_BUCKET_NAME || "",
    publicUrl: (process.env.R2_PUBLIC_URL || "").trim().replace(/\/$/, ""),
  };
}

export class R2NotConfiguredError extends Error {
  constructor() {
    super(
      "Cloudflare R2 is required for product images. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL in .env.local, then restart the server."
    );
    this.name = "R2NotConfiguredError";
  }
}

export function isR2Configured(): boolean {
  const e = r2Env();
  return Boolean(
    e.accountId &&
      e.accessKeyId &&
      e.secretAccessKey &&
      e.bucketName &&
      e.publicUrl
  );
}

/** Public base URL for R2 objects (no trailing slash), or empty if unset */
export function r2PublicUrl(): string {
  return r2Env().publicUrl;
}

/** True when URL already lives on our R2 public host */
export function isOurR2Url(url: string): boolean {
  const { publicUrl } = r2Env();
  if (!url || !publicUrl) return false;
  return url.startsWith(publicUrl + "/") || url === publicUrl;
}

function getS3Client(): S3Client {
  const e = r2Env();
  if (
    !e.accountId ||
    !e.accessKeyId ||
    !e.secretAccessKey ||
    !e.bucketName ||
    !e.publicUrl
  ) {
    throw new R2NotConfiguredError();
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${e.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: e.accessKeyId,
      secretAccessKey: e.secretAccessKey,
    },
  });
}

/**
 * Uploads an image buffer to Cloudflare R2 only (no Supabase fallback).
 */
export async function uploadImageToR2(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const e = r2Env();
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: e.bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${e.publicUrl}/${fileName}`;
}

/**
 * Fetches a remote image, knocks out white studio backgrounds to transparency,
 * then uploads WebP (with alpha) to R2.
 * Returns only the R2 public URL — never the original brand CDN URL.
 */
export async function fetchAndUploadImageToR2(
  externalUrl: string,
  prefix: string
): Promise<string> {
  if (!isR2Configured()) {
    throw new R2NotConfiguredError();
  }
  if (!externalUrl?.startsWith("http")) {
    throw new Error("Invalid image URL");
  }
  if (isOurR2Url(externalUrl)) {
    return externalUrl;
  }

  const response = await fetch(externalUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to download image (${response.status}): ${externalUrl.slice(0, 120)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength < 500) {
    throw new Error("Image too small — likely not a product photo");
  }

  let outBuffer = buffer;
  let contentType = response.headers.get("content-type") || "image/jpeg";
  let ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
  if (ext === "jpeg") ext = "jpg";
  if (!/^(jpg|png|webp|gif|avif)$/i.test(ext)) ext = "jpg";

  try {
    const processed = await knockoutWhiteBackground(buffer);
    outBuffer = Buffer.from(processed.buffer);
    contentType = processed.contentType;
    ext = processed.ext;
  } catch (e) {
    console.warn(
      "White-bg knockout skipped, uploading original:",
      (e as Error)?.message || e
    );
  }

  const safePrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  const fileName = `products/${safePrefix}-${Date.now()}.${ext}`;

  return uploadImageToR2(
    outBuffer,
    fileName,
    contentType.startsWith("image/") ? contentType : `image/${ext}`
  );
}

/**
 * @deprecated Prefer fetchAndUploadImageToR2 — kept for older call sites.
 */
export async function fetchAndUploadImage(
  externalUrl: string,
  prefix: string
): Promise<string> {
  return fetchAndUploadImageToR2(externalUrl, prefix);
}
