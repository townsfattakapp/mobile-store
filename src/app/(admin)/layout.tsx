import React from "react";
import { AdminShell } from "@/components/admin/Sidebar";
import { requireAdminOrStaff } from "@/lib/auth/requireAdmin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAdminOrStaff();

  return (
    <AdminShell
      adminLabel={profile.full_name || "Admin User"}
      adminEmail={profile.email || "admin@mobistore.in"}
    >
      {children}
    </AdminShell>
  );
}
