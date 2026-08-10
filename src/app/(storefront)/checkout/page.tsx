import { requireCustomer } from "@/lib/auth/requireCustomer";
import CheckoutClient from "./CheckoutClient";

export default async function CheckoutPage() {
  const { user, profile, supabase } = await requireCustomer("/checkout");

  const { data: address } = await supabase
    .from("addresses")
    .select(
      "full_name, mobile_number, address_line, city, state, pin_code, is_default"
    )
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <CheckoutClient
      defaults={{
        fullName: address?.full_name || profile.full_name || "",
        email: profile.email || user.email || "",
        phone: address?.mobile_number || profile.phone_number || "",
        address: address?.address_line || "",
        city: address?.city || "",
        state: address?.state || "",
        pinCode: address?.pin_code || "",
      }}
    />
  );
}
