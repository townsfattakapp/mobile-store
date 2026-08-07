import { requireCustomer } from "@/lib/auth/requireCustomer";
import { AddressesClient, type AddressRow } from "./AddressesClient";

export default async function AccountAddressesPage() {
  const { user, supabase } = await requireCustomer();

  const { data } = await supabase
    .from("addresses")
    .select(
      "id, full_name, mobile_number, address_line, landmark, city, state, pin_code, type, is_default"
    )
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  const addresses = (data || []) as AddressRow[];

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1d1d1f]">Addresses</h2>
      <p className="mt-1 mb-6 text-sm text-[#6e6e73]">
        Saved for faster checkout and delivery.
      </p>
      <AddressesClient addresses={addresses} />
    </div>
  );
}
