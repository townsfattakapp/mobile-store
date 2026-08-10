"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

/** Admin panel sign-out — returns to login (not storefront home). */
export async function adminSignOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
