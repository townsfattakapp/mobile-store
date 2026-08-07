import Link from "next/link";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { signOutAction } from "./actions";
import { AccountNavLink } from "./AccountNavLink";

const NAV = [
  { href: "/account", label: "Profile", exact: true },
  { href: "/account/orders", label: "Orders", exact: false },
  { href: "/account/addresses", label: "Addresses", exact: false },
] as const;

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireCustomer();
  const firstName = (profile.full_name || profile.email || "there").split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 flex flex-col gap-4 border-b border-[#17151f]/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6e6e73]">
            My account
          </p>
          <h1
            className="mt-2 text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-4xl"
            style={{ fontFamily: "var(--font-ms-display), Georgia, serif" }}
          >
            Hi, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[#6e6e73]">{profile.email}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm font-medium text-[#6e6e73] underline-offset-4 hover:text-[#1d1d1f] hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-44 lg:flex-col lg:overflow-visible">
          {NAV.map((item) => (
            <AccountNavLink key={item.href} href={item.href} label={item.label} exact={item.exact} />
          ))}
          {(profile.role === "admin" || profile.role === "staff") && (
            <Link
              href="/admin"
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-[#3b2f7c] hover:bg-[#3b2f7c]/08"
            >
              Admin panel
            </Link>
          )}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
