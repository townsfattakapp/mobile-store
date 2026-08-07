import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * Next.js 16 Proxy — refreshes the auth session and enforces roles.
 * Admin requires profiles.role ∈ {admin, staff}.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
