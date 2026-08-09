import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getVapidPublicKey } from "@/lib/notify/webPush";

export const runtime = "nodejs";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { supabase, user };
}

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json(
      { configured: false, error: "VAPID public key not configured" },
      { status: 503 }
    );
  }
  return NextResponse.json({ configured: true, publicKey: key });
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, user } = auth as { supabase: any; user: { id: string } };

  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "").trim();
  const p256dh = String(body.keys?.p256dh || body.p256dh || "").trim();
  const authKey = String(body.keys?.auth || body.auth || "").trim();
  const userAgent = String(body.userAgent || req.headers.get("user-agent") || "").slice(0, 400);

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: userAgent,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message.includes("push_subscriptions") || /relation|schema/i.test(error.message)
            ? "Push subscriptions table missing — run APPLY_NOW_push_subscriptions.sql"
            : error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: any };

  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "").trim();
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ success: true });
}
