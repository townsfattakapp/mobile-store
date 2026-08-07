import Link from "next/link";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { ProfileForm } from "./ProfileForm";

export default async function AccountPage() {
  const { profile } = await requireCustomer();

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1d1d1f]">Profile</h2>
      <p className="mt-1 mb-6 text-sm text-[#6e6e73]">
        Update how we reach you for orders and pickup.
      </p>
      <ProfileForm
        email={profile.email}
        fullName={profile.full_name || ""}
        phoneNumber={profile.phone_number || ""}
      />
      <p className="mt-8 text-sm text-[#6e6e73]">
        Looking for a past purchase?{" "}
        <Link href="/account/orders" className="font-medium text-[#1d1d1f] underline-offset-2 hover:underline">
          View orders
        </Link>
      </p>
    </div>
  );
}
