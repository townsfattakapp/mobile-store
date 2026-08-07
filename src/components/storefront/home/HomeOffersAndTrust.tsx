"use client";

import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CreditCard, ShieldCheck, Truck, Wrench, Sparkles } from "lucide-react";
import { useStoreConfig } from "@/components/storefront/StoreConfigProvider";
import { brandLogoParts } from "@/lib/store/profile-shared";

const TRUST = [
  { icon: BadgeCheck, title: "100% genuine", text: "Authorised channels and sealed retail units." },
  { icon: ShieldCheck, title: "Warranty support", text: "Brand warranty on new. Clear cover on pre-owned." },
  { icon: CreditCard, title: "Secure payments", text: "Razorpay checkout with trusted Indian banks." },
  { icon: Sparkles, title: "Easy EMI", text: "Spread the upgrade across flexible instalments." },
  { icon: Truck, title: "Fast handoff", text: "Delivery or store pickup — whichever suits you." },
  { icon: Wrench, title: "Quality-checked", text: "Pre-owned devices inspected before listing." },
];

const OFFERS = [
  {
    title: "Exchange, simplified",
    text: "Bring your old phone. We’ll help you move into something newer with transparent value.",
    href: "/new-mobiles",
  },
  {
    title: "Bank offers & EMI",
    text: "Pay securely online and explore EMI options at checkout when available.",
    href: "/new-mobiles",
  },
  {
    title: "Limited-time pricing",
    text: "Select launches and pre-owned pieces priced to move — without loud sale noise.",
    href: "/used-mobiles",
  },
];

export function HomeOffersAndTrust() {
  const store = useStoreConfig();
  const brand = brandLogoParts(store.brand_name);

  return (
    <>
      <section id="offers" className="ms-section" aria-labelledby="offers-heading">
        <div className="ms-shell">
          <div className="ms-section-head">
            <div>
              <p className="ms-eyebrow">Thoughtful offers</p>
              <h2 id="offers-heading" className="ms-display ms-display--md">
                Value, without the noise.
              </h2>
            </div>
          </div>

          <div className="ms-offer-grid">
            {OFFERS.map((offer) => (
              <Link key={offer.title} href={offer.href} className="ms-offer group">
                <h3 className="ms-offer-title">{offer.title}</h3>
                <p className="ms-offer-text">{offer.text}</p>
                <span className="ms-textlink">
                  Learn more
                  <ArrowUpRight
                    size={14}
                    className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="ms-section ms-section--trust" aria-labelledby="trust-heading">
        <div className="ms-shell">
          <div className="ms-section-head">
            <div>
              <p className="ms-eyebrow">Why {brand.full}</p>
              <h2 id="trust-heading" className="ms-display ms-display--md">
                Built for an ₹80,000 decision.
              </h2>
            </div>
          </div>

          <ul className="ms-trust-grid">
            {TRUST.map(({ icon: Icon, title, text }) => (
              <li key={title} className="ms-trust">
                <Icon className="ms-trust-icon" strokeWidth={1.5} aria-hidden />
                <h3 className="ms-trust-title">{title}</h3>
                <p className="ms-trust-text">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
