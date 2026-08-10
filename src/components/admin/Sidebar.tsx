"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Smartphone,
  Settings,
  Users,
  ShoppingCart,
  Tags,
  FileText,
  Store,
  Menu,
  X,
  LogOut,
  Archive,
  TicketPercent,
  Gift,
} from "lucide-react";
import { adminSignOutAction } from "@/app/(admin)/admin/actions";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Products", icon: Smartphone },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/pos", label: "Walk-in POS", icon: Store },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: TicketPercent },
  { href: "/admin/giveaways", label: "Giveaways", icon: Gift },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/brands", label: "Brands", icon: Tags },
  { href: "/admin/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/data", label: "Data & Trash", icon: Archive },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5 px-3">
      {links.map((link) => {
        const Icon = link.icon;
        const active = isActive(pathname, link.href, link.exact);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              prefetch
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98] ${
                active
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-[#1d1d1f] hover:bg-neutral-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarChrome({
  pathname,
  onNavigate,
  className = "",
  adminLabel = "Admin User",
  adminEmail = "admin@mobistore.in",
}: {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
  adminLabel?: string;
  adminEmail?: string;
}) {
  const initials = adminLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "AD";

  return (
    <aside className={`border-r border-neutral-200/80 bg-white flex flex-col ${className}`}>
      <div className="h-16 flex items-center justify-between px-6 border-b border-neutral-200/80">
        <Link
          href="/admin"
          prefetch
          onClick={onNavigate}
          className="font-bold text-xl tracking-tight text-black"
        >
          Admin Panel
        </Link>
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-neutral-100"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 overscroll-contain">
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
      </nav>

      <div className="p-4 border-t border-neutral-200/80 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-semibold text-neutral-600">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-black truncate">
              {adminLabel}
            </span>
            <span className="text-xs text-[#6e6e73] truncate">
              {adminEmail}
            </span>
          </div>
        </div>
        <form action={adminSignOutAction}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-[#1d1d1f] hover:bg-neutral-100 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}

export function AdminShell({
  children,
  adminLabel = "Admin User",
  adminEmail = "admin@mobistore.in",
}: {
  children: React.ReactNode;
  adminLabel?: string;
  adminEmail?: string;
}) {
  const pathname = usePathname() || "/admin";
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 text-[#1d1d1f]">
      <SidebarChrome
        pathname={pathname}
        className="w-64 h-full hidden lg:flex shrink-0"
        adminLabel={adminLabel}
        adminEmail={adminEmail}
      />

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          onClick={() => setOpen(false)}
          aria-label="Close overlay"
        />
        <div
          className={`absolute inset-y-0 left-0 w-[min(18rem,85vw)] shadow-xl transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarChrome
            pathname={pathname}
            className="w-full h-full"
            onNavigate={() => setOpen(false)}
            adminLabel={adminLabel}
            adminEmail={adminEmail}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="lg:hidden h-14 border-b bg-white/90 backdrop-blur-md flex items-center px-4 gap-3 sticky top-0 z-20">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-neutral-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-lg tracking-tight text-black">
            Admin Panel
          </span>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 scroll-smooth">
          <div className="admin-page-enter min-h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Desktop-only sidebar export kept for any legacy imports */
export function Sidebar() {
  const pathname = usePathname() || "/admin";
  return (
    <SidebarChrome
      pathname={pathname}
      className="w-64 border-r border-neutral-200/80 bg-white h-full flex flex-col hidden lg:flex"
    />
  );
}
