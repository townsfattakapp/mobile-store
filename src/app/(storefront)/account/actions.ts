"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireCustomer } from "@/lib/auth/requireCustomer";

export async function updateProfileAction(formData: FormData) {
  const { user, supabase } = await requireCustomer();

  const full_name = String(formData.get("full_name") || "").trim();
  const phone_number = String(formData.get("phone_number") || "").trim();

  if (!full_name) {
    return { error: "Name is required." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name,
      phone_number: phone_number || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/account");
  return { success: true };
}

export async function addAddressAction(formData: FormData) {
  const { user, supabase } = await requireCustomer();

  const payload = {
    user_id: user.id,
    full_name: String(formData.get("full_name") || "").trim(),
    mobile_number: String(formData.get("mobile_number") || "").trim(),
    address_line: String(formData.get("address_line") || "").trim(),
    landmark: String(formData.get("landmark") || "").trim() || null,
    city: String(formData.get("city") || "").trim(),
    state: String(formData.get("state") || "").trim(),
    pin_code: String(formData.get("pin_code") || "").trim(),
    type: (String(formData.get("type") || "home") as "home" | "work" | "other"),
    is_default: formData.get("is_default") === "on",
  };

  if (!payload.full_name || !payload.mobile_number || !payload.address_line || !payload.city || !payload.state || !payload.pin_code) {
    return { error: "Please fill all required address fields." };
  }

  if (payload.is_default) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  }

  const { error } = await supabase.from("addresses").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/account/addresses");
  return { success: true };
}

export async function deleteAddressAction(addressId: string) {
  const { user, supabase } = await requireCustomer();
  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", addressId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/account/addresses");
  return { success: true };
}

export async function setDefaultAddressAction(addressId: string) {
  const { user, supabase } = await requireCustomer();
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/account/addresses");
  return { success: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
