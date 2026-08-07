import React, { Suspense } from "react";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import type { Metadata } from "next";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { CartDrawer } from "@/components/storefront/CartDrawer";
import { StoreConfigProvider } from "@/components/storefront/StoreConfigProvider";
import { InstagramReelsSection } from "@/components/storefront/InstagramReelsSection";
import { ScrollToTop } from "@/components/storefront/ScrollToTop";
import { getStorefrontProfile } from "@/lib/store/profile";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-ms-display",
  weight: ["500", "600", "700"],
});

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ms-body",
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getStorefrontProfile();
  return {
    title: profile.seo_title,
    description: profile.seo_description,
  };
}

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const profile = await getStorefrontProfile();

  return (
    <div
      className={`${display.variable} ${body.variable} flex min-h-screen flex-col bg-[#fbf8f3]`}
      style={{ fontFamily: "var(--font-ms-body), ui-sans-serif, system-ui, sans-serif" }}
    >
      <StoreConfigProvider value={profile}>
        <Suspense fallback={null}>
          <ScrollToTop />
        </Suspense>
        <Header />
        <CartDrawer />
        <main className="flex-1">{children}</main>
        <InstagramReelsSection />
        <Footer />
      </StoreConfigProvider>
    </div>
  );
}
