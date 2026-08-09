import { createClient } from "@supabase/supabase-js";

/**
 * Production Supabase project ref used by the live Mahadev Mobiles site.
 * Local/dev must use a SEPARATE project unless ALLOW_PROD_DB_WRITES=true.
 */
const PROD_SUPABASE_HOST_MARKERS = ["nedyfakmrzvzoqaqsnqe.supabase.co"];

function assertLocalNotWritingToProd(url: string) {
  // Explicit override for rare emergency local ops against prod
  if (process.env.ALLOW_PROD_DB_WRITES === "true") return;

  // On Vercel (preview/production) env is intentional — don't block
  if (process.env.VERCEL) return;

  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return;
  }

  const looksProd = PROD_SUPABASE_HOST_MARKERS.some((m) => host.includes(m));
  if (!looksProd) return;

  throw new Error(
    [
      "Blocked: this local app is pointed at the PRODUCTION Supabase database.",
      "Scrapes / admin writes would change live data.",
      "",
      "Fix: create a separate Supabase project for local/dev and put its URL + keys in .env.local.",
      "Emergency override only: ALLOW_PROD_DB_WRITES=true",
    ].join("\n")
  );
}

/**
 * Service-role client for trusted server-side catalog writes.
 * Bypasses RLS — only use in server actions / route handlers.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  assertLocalNotWritingToProd(url);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
