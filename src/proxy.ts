import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * Next.js 16 Proxy — refreshes the auth session and enforces roles.
 * Must match exact /account and /admin roots (not only nested paths).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/account", "/account/:path*"],
};
