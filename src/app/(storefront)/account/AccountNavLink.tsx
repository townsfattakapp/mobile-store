"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AccountNavLink({
  href,
  label,
  exact,
}: {
  href: string;
  label: string;
  exact: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[#1d1d1f] text-white"
          : "text-[#424245] hover:bg-[#17151f]/06 hover:text-[#1d1d1f]"
      }`}
    >
      {label}
    </Link>
  );
}
