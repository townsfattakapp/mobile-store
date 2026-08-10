import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { CmsPageShell } from "@/components/storefront/CmsPageShell";
import { getStoreCmsPage } from "@/lib/store/cmsPages";
import { getStorefrontProfile } from "@/lib/store/profile";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Visit Mahadev Mobiles at Old Bus Stop, Tiroda — call, WhatsApp, or email for phones and accessories.",
  alternates: { canonical: "/contact" },
};

function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : undefined;
}

export default async function ContactPage() {
  const [content, profile] = await Promise.all([
    getStoreCmsPage("contact_page_content"),
    getStorefrontProfile(),
  ]);

  const cards = [
    profile.address_line
      ? {
          icon: MapPin,
          label: "Address",
          value: profile.address_line,
          href: undefined as string | undefined,
        }
      : null,
    profile.phone
      ? {
          icon: Phone,
          label: "Phone",
          value: profile.phone,
          href: telHref(profile.phone),
        }
      : null,
    profile.email
      ? {
          icon: Mail,
          label: "Email",
          value: profile.email,
          href: `mailto:${profile.email}`,
        }
      : null,
    profile.business_hours
      ? {
          icon: Clock,
          label: "Hours",
          value: profile.business_hours,
          href: undefined as string | undefined,
        }
      : null,
  ].filter(Boolean) as {
    icon: typeof MapPin;
    label: string;
    value: string;
    href?: string;
  }[];

  return (
    <CmsPageShell title="Contact Us" content={content}>
      <div className="ms-contact-cards">
        {cards.map((card) => {
          const Icon = card.icon;
          const inner = (
            <>
              <span className="ms-contact-card-icon" aria-hidden>
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <span>
                <span className="ms-contact-card-label">{card.label}</span>
                <span className="ms-contact-card-value">{card.value}</span>
              </span>
            </>
          );
          return card.href ? (
            <a key={card.label} href={card.href} className="ms-contact-card">
              {inner}
            </a>
          ) : (
            <div key={card.label} className="ms-contact-card">
              {inner}
            </div>
          );
        })}
      </div>
      <div className="ms-contact-actions">
        {profile.whatsapp_url ? (
          <a
            href={profile.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-contact-btn ms-contact-btn--primary"
          >
            WhatsApp community
          </a>
        ) : null}
        <Link href="/new-mobiles" className="ms-contact-btn ms-contact-btn--ghost">
          Shop mobiles
        </Link>
      </div>
    </CmsPageShell>
  );
}
