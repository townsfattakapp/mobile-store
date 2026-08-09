"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { useStoreConfig } from "@/components/storefront/StoreConfigProvider";
import { brandLogoParts } from "@/lib/store/profile-shared";
import { FOOTER_SHOP_LINKS } from "@/lib/storefront/nav";

const SUPPORT = [
  { href: "/contact", label: "Contact Us" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/refund-policy", label: "Return Policy" },
  { href: "/warranty", label: "Warranty Info" },
];

const LEGAL = [
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/sitemap", label: "Sitemap" },
];

function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : undefined;
}

export function Footer() {
  const store = useStoreConfig();
  const logo = brandLogoParts(store.brand_name);
  const year = new Date().getFullYear();
  const designedUrl = store.designed_by_url?.startsWith("http")
    ? store.designed_by_url
    : `https://${store.designed_by_url.replace(/^https?:\/\//, "")}`;

  return (
    <footer className="ms-footer">
      <div className="ms-footer-glow" aria-hidden />
      <div className="ms-footer-jaali" aria-hidden />

      <div className="ms-footer-shell">
        <div className="ms-footer-brandrow">
          <div className="ms-footer-brandblock">
            <Link href="/" className="ms-footer-logo">
              {logo.lead}
              {logo.accent ? <span>{logo.accent}</span> : null}
            </Link>
            <p className="ms-footer-tagline">{store.tagline}</p>
            <div className="ms-footer-social">
              {store.instagram_url ? (
                <a
                  href={store.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-footer-social-link"
                >
                  Instagram
                  <ArrowUpRight size={12} aria-hidden />
                </a>
              ) : null}
              {store.whatsapp_url ? (
                <a
                  href={store.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-footer-social-link"
                >
                  WhatsApp
                  <ArrowUpRight size={12} aria-hidden />
                </a>
              ) : null}
            </div>
          </div>

          <div className="ms-footer-ctas">
            <Link href="/new-mobiles" className="ms-footer-cta ms-footer-cta--primary">
              Shop mobiles
              <ArrowUpRight size={15} strokeWidth={2} />
            </Link>
            <Link href="/used-mobiles" className="ms-footer-cta ms-footer-cta--ghost">
              Browse pre-owned
            </Link>
          </div>
        </div>

        <div className="ms-footer-grid">
          <div className="ms-footer-col ms-footer-col--shop">
            <h4 className="ms-footer-heading">Shop</h4>
            <ul className="ms-footer-list">
              {FOOTER_SHOP_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="ms-footer-link group">
                    {item.label}
                    <ArrowUpRight size={13} className="ms-footer-link-icon" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="ms-footer-col ms-footer-col--support">
            <h4 className="ms-footer-heading">Support</h4>
            <ul className="ms-footer-list">
              {SUPPORT.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="ms-footer-link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="ms-footer-col ms-footer-col--contact">
            <h4 className="ms-footer-heading">Call & visit</h4>
            <ul className="ms-footer-list ms-footer-contact">
              {store.address_line ? (
                <li>
                  <div className="ms-footer-contact-item">
                    <MapPin size={16} strokeWidth={1.75} aria-hidden />
                    <span>
                      <span className="ms-footer-contact-label">Address</span>
                      {store.address_line}
                    </span>
                  </div>
                </li>
              ) : null}
              <li>
                <a href={telHref(store.phone)} className="ms-footer-contact-item">
                  <Phone size={16} strokeWidth={1.75} aria-hidden />
                  <span>
                    <span className="ms-footer-contact-label">Phone</span>
                    {store.phone}
                  </span>
                </a>
              </li>
              {store.email ? (
                <li>
                  <a href={`mailto:${store.email}`} className="ms-footer-contact-item">
                    <Mail size={16} strokeWidth={1.75} aria-hidden />
                    <span>
                      <span className="ms-footer-contact-label">Email</span>
                      {store.email}
                    </span>
                  </a>
                </li>
              ) : null}
            </ul>
            <p className="ms-footer-hours">{store.business_hours}</p>
          </div>
        </div>

        <div className="ms-footer-bottom">
          <div className="ms-footer-bottom-main">
            <p className="ms-footer-copy">
              © {year} {logo.full}. All rights reserved.
            </p>
            <nav className="ms-footer-legal" aria-label="Legal">
              {LEGAL.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="ms-footer-credit">
            <p>
              Designed by{" "}
              <span className="ms-footer-credit-brand">{store.designed_by_name}</span>
              <span className="ms-footer-credit-sep">·</span>
              {store.designed_by_org}
            </p>
            <a
              href={designedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ms-footer-credit-link"
            >
              {store.designed_by_url.replace(/^https?:\/\//, "")}
              <ArrowUpRight size={12} strokeWidth={2} aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
