import type { Metadata } from "next";
import { CmsPageShell } from "@/components/storefront/CmsPageShell";
import { getStoreCmsPage } from "@/lib/store/cmsPages";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Return & Refund Policy",
  description:
    "Return, exchange, and refund policy for purchases from Mahadev Mobiles, Tiroda.",
  alternates: { canonical: "/refund-policy" },
};

export default async function RefundPolicyPage() {
  const content = await getStoreCmsPage("refund_policy_content");
  return <CmsPageShell title="Return & Refund Policy" content={content} />;
}
