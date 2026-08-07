import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/account";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Cookie write may fail in edge cases; session refresh middleware covers this.
          }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback`);
  }

  let role = "customer";
  try {
    const admin = createAdminClient();
    const email =
      data.user.email || `user-${data.user.id.slice(0, 8)}@guest.local`;
    const fullName =
      (data.user.user_metadata?.full_name as string | undefined) ||
      (data.user.user_metadata?.name as string | undefined) ||
      null;

    const { data: existing } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!existing) {
      await admin.from("profiles").insert({
        id: data.user.id,
        email,
        full_name: fullName,
        phone_number: data.user.phone || null,
        role: "customer",
      });
    } else {
      role = existing.role || "customer";
      if (!existing.full_name && fullName) {
        await admin
          .from("profiles")
          .update({ full_name: fullName, updated_at: new Date().toISOString() })
          .eq("id", data.user.id);
      }
    }
  } catch {
    // Profile ensure is best-effort; /account will retry via requireCustomer.
  }

  if (next === "/account" && (role === "admin" || role === "staff")) {
    return NextResponse.redirect(`${origin}/admin`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
