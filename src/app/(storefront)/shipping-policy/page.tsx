import type { Metadata } from "next";
import { CmsPageShell } from "@/components/storefront/CmsPageShell";
import { getStoreCmsPage } from "@/lib/store/cmsPages";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy",
  description:
    "Store pickup, local delivery, and courier policy for Mahadev Mobiles, Tiroda.",
  alternates: { canonical: "/shipping-policy" },
};

export default async function ShippingPolicyPage() {
  const content = await getStoreCmsPage("shipping_policy_content");
  return <CmsPageShell title="Shipping & Delivery Policy" content={content} />;
}
