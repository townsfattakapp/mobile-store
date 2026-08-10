"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { INDIAN_STATES } from "@/lib/invoice/gst";
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from "@/lib/invoice/types";
import { getStoreSettings, saveStoreSettings } from "../invoices/actions";
import { getStorefrontProfileAction } from "./actions";
import { OrderPushEnableCard } from "@/components/admin/OrderPushEnableCard";

const TABS = [
  {
    id: "website",
    label: "Website",
    description: "Brand name, tagline, and homepage hero copy shown on the storefront.",
  },
  {
    id: "contact",
    label: "Contact",
    description: "Phone, WhatsApp, email, hours, address, and social links.",
  },
  {
    id: "seo",
    label: "SEO",
    description: "Browser title and meta description for Google and link previews.",
  },
  {
    id: "policies",
    label: "Policies",
    description: "Edit Warranty, Refund, Shipping, and Contact page content shown on the website.",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alerts when customers place or pay for website orders.",
  },
  {
    id: "invoices",
    label: "Invoices & GST",
    description: "Legal identity, GST registration, bank details, and invoice wording.",
  },
  {
    id: "credits",
    label: "Credits",
    description: "Fixed agency credit shown in the storefront footer.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

const POLICY_PAGES = [
  {
    id: "warranty",
    label: "Warranty",
    field: "warranty_content" as const,
    previewHref: "/warranty",
    hint: "Shown at /warranty — use # headings, - lists, **bold**, and [links](/path).",
  },
  {
    id: "refund",
    label: "Refund / Return",
    field: "refund_policy_content" as const,
    previewHref: "/refund-policy",
    hint: "Shown at /refund-policy.",
  },
  {
    id: "shipping",
    label: "Shipping",
    field: "shipping_policy_content" as const,
    previewHref: "/shipping-policy",
    hint: "Shown at /shipping-policy.",
  },
  {
    id: "contact-page",
    label: "Contact page",
    field: "contact_page_content" as const,
    previewHref: "/contact",
    hint: "Intro text on /contact. Phone, address, and hours still come from the Contact tab.",
  },
] as const;

type PolicyPageId = (typeof POLICY_PAGES)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function isPolicyPageId(value: string | null): value is PolicyPageId {
  return POLICY_PAGES.some((page) => page.id === value);
}

function AdminSettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabId = isTabId(tabParam) ? tabParam : "website";
  const policyParam = searchParams.get("page");
  const activePolicy: PolicyPageId = isPolicyPageId(policyParam) ? policyParam : "warranty";

  const [form, setForm] = useState<StoreSettings>({ ...DEFAULT_STORE_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [s, profile] = await Promise.all([getStoreSettings(), getStorefrontProfileAction()]);
      setForm({
        ...s,
        brand_name: profile.brand_name,
        tagline: profile.tagline,
        business_hours: profile.business_hours,
        phone: profile.phone || s.phone,
        email: profile.email || s.email,
        website: profile.website || s.website,
        address_line: profile.address_line,
        address_line1: s.address_line1 || "Old Bus Stop",
        address_line2: s.address_line2 || "Tiroda",
        city: s.city || "Tiroda",
        state: s.state || "Maharashtra",
        pin_code: s.pin_code || "441911",
        instagram_url: profile.instagram_url,
        whatsapp_url: profile.whatsapp_url,
        whatsapp_number: profile.whatsapp_number || s.whatsapp_number || "",
        instagram_reels: (profile.instagram_reels || []).join("\n"),
        twitter_url: profile.twitter_url,
        facebook_url: profile.facebook_url,
        seo_title: profile.seo_title,
        seo_description: profile.seo_description,
        hero_eyebrow: profile.hero_eyebrow,
        hero_headline: profile.hero_headline,
        hero_subcopy: profile.hero_subcopy,
      });
      setLoading(false);
    })();
  }, []);

  const setTab = (id: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    if (id !== "policies") params.delete("page");
    router.replace(`/admin/settings?${params.toString()}`, { scroll: false });
  };

  const setPolicyPage = (id: PolicyPageId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "policies");
    params.set("page", id);
    router.replace(`/admin/settings?${params.toString()}`, { scroll: false });
  };

  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onStateChange = (stateName: string) => {
    const found = INDIAN_STATES.find((s) => s.name === stateName);
    setForm((prev) => ({
      ...prev,
      state: stateName,
      state_code: found?.code || prev.state_code,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await saveStoreSettings(form);
    setSaving(false);
    if (res.error) {
      setMessage({ type: "err", text: res.error });
    } else {
      setMessage({
        type: "ok",
        text: "Settings saved. Storefront and invoice profile are live.",
      });
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-[#6e6e73]">Loading settings...</div>;
  }

  const current = TABS.find((tab) => tab.id === activeTab)!;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Store Settings</h1>
          <p className="text-sm text-[#6e6e73] mt-1">
            Organized by area — switch tabs to edit website, contact, SEO, alerts, and invoices.
          </p>
        </div>
        <Link href="/">
          <Button variant="outline">View storefront</Button>
        </Link>
      </div>

      {message && (
        <div
          className={`text-sm rounded-xl p-4 border ${
            message.type === "ok"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Top category tabs */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div
          role="tablist"
          aria-label="Settings categories"
          className="flex gap-1 overflow-x-auto border-b bg-neutral-50/80 px-2 py-2 scrollbar-thin"
        >
          {TABS.map((tab) => {
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(tab.id)}
                className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  selected
                    ? "bg-white text-[#1d1d1f] shadow-sm border border-neutral-200"
                    : "text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/70"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-8">
          <div className="border-b border-neutral-100 pb-4">
            <h2 className="text-lg font-semibold text-[#1d1d1f]">{current.label}</h2>
            <p className="text-sm text-[#6e6e73] mt-1">{current.description}</p>
          </div>

          {activeTab === "website" && (
            <section className="space-y-4" role="tabpanel">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Brand name (logo) *"
                  value={form.brand_name || ""}
                  onChange={(e) => set("brand_name", e.target.value)}
                  placeholder="Mahadev Mobiles"
                  required
                />
                <Input
                  label="Preview"
                  value={(form.brand_name || "Mahadev Mobiles").replace(/\.+$/, "")}
                  disabled
                />
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">Tagline</label>
                  <textarea
                    value={form.tagline || ""}
                    onChange={(e) => set("tagline", e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[#1d1d1f] bg-white focus:ring-2 focus:ring-black outline-none resize-none"
                  />
                </div>
                <Input
                  label="Hero eyebrow"
                  value={form.hero_eyebrow || ""}
                  onChange={(e) => set("hero_eyebrow", e.target.value)}
                />
                <Input
                  label="Hero headline"
                  value={form.hero_headline || ""}
                  onChange={(e) => set("hero_headline", e.target.value)}
                />
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">Hero subcopy</label>
                  <textarea
                    value={form.hero_subcopy || ""}
                    onChange={(e) => set("hero_subcopy", e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[#1d1d1f] bg-white focus:ring-2 focus:ring-black outline-none resize-none"
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === "contact" && (
            <section className="space-y-6" role="tabpanel">
              <div>
                <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">Public contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Public phone"
                    value={form.phone || ""}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                  <Input
                    label="WhatsApp number (product chat)"
                    value={form.whatsapp_number || ""}
                    onChange={(e) => set("whatsapp_number", e.target.value)}
                    placeholder="9876543210 or 919876543210"
                  />
                  <p className="md:col-span-2 text-xs text-[#6e6e73] -mt-2">
                    Used for “Chat with Seller” on product pages. Saved as digits with country code
                    (India: 91XXXXXXXXXX). Leave blank to fall back to the public phone number.
                  </p>
                  <Input
                    label="Public email"
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => set("email", e.target.value)}
                  />
                  <Input
                    label="Website"
                    value={form.website || ""}
                    onChange={(e) => set("website", e.target.value)}
                  />
                  <div className="md:col-span-2">
                    <Input
                      label="Store address (shown on website)"
                      value={form.address_line || ""}
                      onChange={(e) => set("address_line", e.target.value)}
                      placeholder="Old Bus Stop, Tiroda, Maharashtra 441911"
                    />
                  </div>
                  <Input
                    label="Business hours"
                    value={form.business_hours || ""}
                    onChange={(e) => set("business_hours", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">Social & community</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Instagram URL"
                    value={form.instagram_url || ""}
                    onChange={(e) => set("instagram_url", e.target.value)}
                    placeholder="https://www.instagram.com/..."
                  />
                  <Input
                    label="WhatsApp community / group URL"
                    value={form.whatsapp_url || ""}
                    onChange={(e) => set("whatsapp_url", e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                  />
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">
                      Instagram Reels (shown above footer)
                    </label>
                    <textarea
                      value={
                        Array.isArray(form.instagram_reels)
                          ? form.instagram_reels.join("\n")
                          : form.instagram_reels || ""
                      }
                      onChange={(e) => set("instagram_reels", e.target.value)}
                      rows={4}
                      placeholder={
                        "https://www.instagram.com/reel/XXXX/\nhttps://www.instagram.com/reel/YYYY/"
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[#1d1d1f] bg-white focus:ring-2 focus:ring-black outline-none resize-y font-mono text-xs"
                    />
                    <p className="text-xs text-[#6e6e73] mt-1.5">
                      Paste up to 6 public Reel links — one per line. Use{" "}
                      <code className="text-[11px] bg-neutral-100 px-1 rounded">
                        https://www.instagram.com/reel/XXXX/
                      </code>
                      , not the profile URL.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "seo" && (
            <section className="space-y-4" role="tabpanel">
              <div className="grid grid-cols-1 gap-4">
                <Input
                  label="Browser title"
                  value={form.seo_title || ""}
                  onChange={(e) => set("seo_title", e.target.value)}
                />
                <div>
                  <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">
                    Meta description
                  </label>
                  <textarea
                    value={form.seo_description || ""}
                    onChange={(e) => set("seo_description", e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[#1d1d1f] bg-white focus:ring-2 focus:ring-black outline-none resize-none"
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === "policies" && (
            <section className="space-y-4" role="tabpanel">
              <div className="flex flex-wrap gap-2">
                {POLICY_PAGES.map((page) => {
                  const selected = page.id === activePolicy;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setPolicyPage(page.id)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                        selected
                          ? "bg-[#1d1d1f] text-white border-[#1d1d1f]"
                          : "bg-white text-[#424245] border-neutral-200 hover:border-neutral-400"
                      }`}
                    >
                      {page.label}
                    </button>
                  );
                })}
              </div>

              {POLICY_PAGES.filter((page) => page.id === activePolicy).map((page) => (
                <div key={page.id} className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs text-[#6e6e73]">{page.hint}</p>
                    <Link
                      href={page.previewHref}
                      target="_blank"
                      className="text-xs font-semibold text-[#3b2f7c] hover:underline shrink-0"
                    >
                      Preview live page →
                    </Link>
                  </div>
                  <textarea
                    value={(form[page.field] as string) || ""}
                    onChange={(e) => set(page.field, e.target.value)}
                    rows={18}
                    spellCheck
                    className="w-full px-3 py-3 border border-neutral-300 rounded-md text-[#1d1d1f] bg-white focus:ring-2 focus:ring-black outline-none resize-y font-mono text-xs leading-relaxed"
                  />
                  <p className="text-[11px] text-[#6e6e73]">
                    Tip: blank lines start new paragraphs. Headings use{" "}
                    <code className="bg-neutral-100 px-1 rounded"># Title</code> or{" "}
                    <code className="bg-neutral-100 px-1 rounded">## Section</code>.
                  </p>
                </div>
              ))}
            </section>
          )}

          {activeTab === "notifications" && (
            <section className="space-y-4" role="tabpanel">
              <p className="text-sm text-[#6e6e73]">
                Keep Public email and WhatsApp number filled under Contact. Email uses Resend;
                WhatsApp uses CallMeBot; browser push uses this device.
              </p>
              <OrderPushEnableCard />
              <div className="rounded-xl border bg-neutral-50 p-4 text-xs text-[#6e6e73] space-y-1">
                <p>
                  <strong className="text-[#1d1d1f]">Email:</strong> Public email + server{" "}
                  <code className="bg-white px-1 rounded">RESEND_API_KEY</code>
                </p>
                <p>
                  <strong className="text-[#1d1d1f]">WhatsApp:</strong> CallMeBot on the store
                  WhatsApp number +{" "}
                  <code className="bg-white px-1 rounded">CALLMEBOT_API_KEY</code>
                </p>
                <p>
                  <strong className="text-[#1d1d1f]">Browser push:</strong> enable here after VAPID
                  keys are configured on the server.
                </p>
              </div>
            </section>
          )}

          {activeTab === "invoices" && (
            <section className="space-y-8" role="tabpanel">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[#1d1d1f]">Business identity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Legal Name *"
                    value={form.legal_name}
                    onChange={(e) => set("legal_name", e.target.value)}
                    required
                  />
                  <Input
                    label="Trade Name"
                    value={form.trade_name || ""}
                    onChange={(e) => set("trade_name", e.target.value)}
                  />
                  <Input
                    label="Address Line 1 *"
                    value={form.address_line1}
                    onChange={(e) => set("address_line1", e.target.value)}
                    required
                  />
                  <Input
                    label="Address Line 2"
                    value={form.address_line2 || ""}
                    onChange={(e) => set("address_line2", e.target.value)}
                  />
                  <Input
                    label="City *"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    required
                  />
                  <Input
                    label="PIN Code *"
                    value={form.pin_code}
                    onChange={(e) => set("pin_code", e.target.value)}
                    required
                  />
                  <div>
                    <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">State *</label>
                    <select
                      value={form.state}
                      onChange={(e) => onStateChange(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-300 rounded-md text-[#1d1d1f] bg-white focus:ring-2 focus:ring-black outline-none"
                      required
                    >
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.name}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="State Code"
                    value={form.state_code}
                    onChange={(e) => set("state_code", e.target.value)}
                    required
                  />
                  <Input
                    label="PAN"
                    value={form.pan || ""}
                    onChange={(e) => set("pan", e.target.value.toUpperCase())}
                    maxLength={10}
                    placeholder="ABCDE1234F"
                  />
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <h3 className="text-sm font-semibold text-[#1d1d1f]">GST registration</h3>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.gst_registered}
                    onChange={(e) => set("gst_registered", e.target.checked)}
                    className="mt-1 w-4 h-4"
                  />
                  <span>
                    <span className="font-medium text-[#1d1d1f] block">GST Registered</span>
                    <span className="text-sm text-[#6e6e73]">
                      Enable to issue Tax Invoices with CGST/SGST or IGST breakup.
                    </span>
                  </span>
                </label>

                {form.gst_registered && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                    <Input
                      label="GSTIN *"
                      value={form.gstin || ""}
                      onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                      placeholder="27AAAAA0000A1Z5"
                      maxLength={15}
                      required={form.gst_registered}
                    />
                    <label className="flex items-start gap-3 cursor-pointer md:col-span-2 mt-2">
                      <input
                        type="checkbox"
                        checked={form.composition_scheme}
                        onChange={(e) => set("composition_scheme", e.target.checked)}
                        className="mt-1 w-4 h-4"
                      />
                      <span>
                        <span className="font-medium text-[#1d1d1f] block">Composition Scheme</span>
                        <span className="text-sm text-[#6e6e73]">
                          Issues Bill of Supply (cannot collect tax from customers).
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Default HSN (Mobiles)"
                    value={form.default_hsn}
                    onChange={(e) => set("default_hsn", e.target.value)}
                  />
                  <Input
                    label="Default GST Rate %"
                    type="number"
                    step="0.01"
                    value={form.default_gst_rate}
                    onChange={(e) => set("default_gst_rate", Number(e.target.value))}
                  />
                  <label className="flex items-start gap-3 cursor-pointer mt-6">
                    <input
                      type="checkbox"
                      checked={form.tax_inclusive_pricing}
                      onChange={(e) => set("tax_inclusive_pricing", e.target.checked)}
                      className="mt-1 w-4 h-4"
                    />
                    <span className="text-sm">
                      <span className="font-medium block">Tax-inclusive prices</span>
                      <span className="text-[#6e6e73]">Selling prices include GST</span>
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="GST Invoice Prefix"
                    value={form.invoice_prefix_gst}
                    onChange={(e) => set("invoice_prefix_gst", e.target.value.toUpperCase())}
                  />
                  <Input
                    label="Non-GST Bill Prefix"
                    value={form.invoice_prefix_nongst}
                    onChange={(e) => set("invoice_prefix_nongst", e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <h3 className="text-sm font-semibold text-[#1d1d1f]">Bank details (optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Bank Name"
                    value={form.bank_name || ""}
                    onChange={(e) => set("bank_name", e.target.value)}
                  />
                  <Input
                    label="Account Number"
                    value={form.bank_account || ""}
                    onChange={(e) => set("bank_account", e.target.value)}
                  />
                  <Input
                    label="IFSC"
                    value={form.bank_ifsc || ""}
                    onChange={(e) => set("bank_ifsc", e.target.value.toUpperCase())}
                  />
                  <Input
                    label="Branch"
                    value={form.bank_branch || ""}
                    onChange={(e) => set("bank_branch", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <h3 className="text-sm font-semibold text-[#1d1d1f]">Invoice footer</h3>
                <Input
                  label="Authorized Signatory Label"
                  value={form.authorized_signatory || ""}
                  onChange={(e) => set("authorized_signatory", e.target.value)}
                />
                <div>
                  <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">
                    Terms & Conditions
                  </label>
                  <textarea
                    value={form.terms || ""}
                    onChange={(e) => set("terms", e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[#1d1d1f] bg-white focus:ring-2 focus:ring-black outline-none resize-none"
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === "credits" && (
            <section className="space-y-4" role="tabpanel">
              <p className="text-sm text-[#6e6e73]">
                Agency credit is fixed and cannot be changed from the admin panel.
              </p>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-2 text-sm text-[#1d1d1f]">
                <p>
                  <span className="text-[#6e6e73]">Designed by</span>
                  <br />
                  <span className="font-semibold">Evolw — Fattakse</span>
                </p>
                <p>
                  <span className="text-[#6e6e73]">Organization</span>
                  <br />
                  <span className="font-semibold">A Unit of EVOLW</span>
                </p>
                <p>
                  <span className="text-[#6e6e73]">Website</span>
                  <br />
                  <a
                    href="https://www.evolw.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#3b2f7c] hover:underline"
                  >
                    www.evolw.in
                  </a>
                </p>
              </div>
            </section>
          )}

          {/* Sticky save — always saves full form across tabs */}
          <div className="fixed bottom-0 inset-x-0 z-20 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-[#6e6e73]">
                Saves every category at once — edits on other tabs are kept.
              </p>
              <Button type="submit" className="sm:min-w-[180px]" isLoading={saving}>
                Save all settings
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#6e6e73]">Loading settings...</div>}>
      <AdminSettingsInner />
    </Suspense>
  );
}
