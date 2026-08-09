import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  isR2Configured,
  processAndUploadImageBuffer,
  R2NotConfiguredError,
} from "@/lib/storage/R2Client";
import { PRODUCT_IMAGE_UPLOAD_MAX_RAW_BYTES } from "@/lib/storage/optimizeProductImage";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireStaff() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasSession) return null;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role && !["admin", "staff"].includes(profile.role)) {
    return null;
  }
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        {
          error:
            "Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL.",
        },
        { status: 503 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const prefixRaw = String(form.get("prefix") || "manual").trim();
    const knockOut =
      String(form.get("knockOutWhite") || "true").toLowerCase() !== "false";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image uploads are allowed" },
        { status: 400 }
      );
    }

    if (file.size > PRODUCT_IMAGE_UPLOAD_MAX_RAW_BYTES) {
      return NextResponse.json(
        { error: "Image is too large (max 12MB before optimization)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength < 400) {
      return NextResponse.json(
        { error: "Image file looks empty or corrupt" },
        { status: 400 }
      );
    }

    const result = await processAndUploadImageBuffer(buffer, prefixRaw, {
      knockOutWhite: knockOut,
    });

    return NextResponse.json({
      url: result.url,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      quality: result.quality,
      contentType: result.contentType,
    });
  } catch (e: any) {
    if (e instanceof R2NotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error("upload-image failed:", e);
    return NextResponse.json(
      { error: e?.message || "Upload failed" },
      { status: 500 }
    );
  }
}

/** Import a remote image URL → optimize → R2 (avoids browser CORS). */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "Cloudflare R2 is not configured." },
        { status: 503 }
      );
    }

    const form = await req.formData();
    const sourceUrl = String(form.get("sourceUrl") || "").trim();
    const prefixRaw = String(form.get("prefix") || "manual").trim();

    if (!sourceUrl.startsWith("http")) {
      return NextResponse.json({ error: "Invalid sourceUrl" }, { status: 400 });
    }

    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download image (${response.status})` },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const result = await processAndUploadImageBuffer(buffer, prefixRaw);

    return NextResponse.json({
      url: result.url,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      quality: result.quality,
      contentType: result.contentType,
    });
  } catch (e: any) {
    if (e instanceof R2NotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error("upload-image URL import failed:", e);
    return NextResponse.json(
      { error: e?.message || "URL import failed" },
      { status: 500 }
    );
  }
}
