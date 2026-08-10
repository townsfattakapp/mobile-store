import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";

export type AccountProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  role: string;
};

export async function requireCustomer(nextPath = "/account") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const safeNext =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/account";

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(safeNext)}`);
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id, email, full_name, phone_number, role")
    .eq("id", user.id)
    .maybeSingle();

  let profile = existing as AccountProfile | null;

  if (!profile) {
    const email = user.email || `user-${user.id.slice(0, 8)}@guest.local`;
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      null;

    const { data: created, error } = await admin
      .from("profiles")
      .insert({
        id: user.id,
        email,
        full_name: fullName,
        phone_number: user.phone || null,
        role: "customer",
      })
      .select("id, email, full_name, phone_number, role")
      .single();

    if (error || !created) {
      // Concurrent insert race — re-fetch
      const { data: again } = await admin
        .from("profiles")
        .select("id, email, full_name, phone_number, role")
        .eq("id", user.id)
        .maybeSingle();
      if (!again) {
        throw new Error(error?.message || "Could not create customer profile");
      }
      profile = again as AccountProfile;
    } else {
      profile = created as AccountProfile;
    }
  }

  return { user, profile, supabase };
}
