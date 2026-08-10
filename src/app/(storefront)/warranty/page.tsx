import type { Metadata } from "next";
import { CmsPageShell } from "@/components/storefront/CmsPageShell";
import { getStoreCmsPage } from "@/lib/store/cmsPages";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Warranty Information",
  description:
    "Warranty cover for new and pre-owned mobiles purchased from Mahadev Mobiles, Tiroda.",
  alternates: { canonical: "/warranty" },
};

export default async function WarrantyPage() {
  const content = await getStoreCmsPage("warranty_content");
  return <CmsPageShell title="Warranty Information" content={content} />;
}
