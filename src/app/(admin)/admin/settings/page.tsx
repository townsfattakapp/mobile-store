"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { INDIAN_STATES } from "@/lib/invoice/gst";
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from "@/lib/invoice/types";
import { getStoreSettings, saveStoreSettings } from "../invoices/actions";
import { getStorefrontProfileAction } from "./actions";
import { OrderPushEnableCard } from "@/components/admin/OrderPushEnableCard";

export default function AdminSettingsPage() {
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
        text: "Saved. Storefront branding, contact, and GST settings are live.",
      });
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-[#6e6e73]">Loading settings...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Store Settings</h1>
          <p className="text-sm text-[#6e6e73] mt-1">
            Manage website branding, contact details, SEO, and GST invoice profile from one place.
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

      <form onSubmit={handleSave} className="bg-white border rounded-xl shadow-sm p-6 space-y-10">
        {/* Storefront branding */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold border-b pb-2">Website Branding</h2>
            <p className="text-xs text-[#6e6e73] mt-2">
              Controls the logo text (e.g. MOBISTORE.), hero copy, footer, and browser title.
            </p>
          </div>
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

        {/* Contact & hours */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Contact & Hours</h2>
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
              Separate from the WhatsApp community URL below.
            </p>
            <Input
              label="Public email"
              type="email"
              value={form.email || ""}
              onChange={(e) => set("email", e.target.value)}
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
              label="Website"
              value={form.website || ""}
              onChange={(e) => set("website", e.target.value)}
            />
            <Input
              label="Business hours"
              value={form.business_hours || ""}
              onChange={(e) => set("business_hours", e.target.value)}
            />
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
                placeholder={"https://www.instagram.com/reel/XXXX/\nhttps://www.instagram.com/reel/YYYY/"}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[#1d1d1f] bg-white focus:ring-2 focus:ring-black outline-none resize-y font-mono text-xs"
              />
              <p className="text-xs text-[#6e6e73] mt-1.5">
                Paste up to 6 public Reel (or post) links — one per line. Open a reel → Share → Copy link.
                The section stays hidden until at least one <strong>public Reel link</strong> is
                saved. Use links like{" "}
                <code className="text-[11px] bg-neutral-100 px-1 rounded">
                  https://www.instagram.com/reel/XXXX/
                </code>
                — not the profile page URL (that cannot be embedded).
              </p>
            </div>
          </div>
        </section>

        {/* Instant order alerts */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold border-b pb-2">Order notifications</h2>
            <p className="text-xs text-[#6e6e73] mt-2">
              Get alerted when a customer places an order on the website, and again when online
              payment is confirmed. Keep your public email and WhatsApp number filled above.
              Email uses Resend; WhatsApp uses CallMeBot; browser push uses this device.
            </p>
          </div>
          <OrderPushEnableCard />
          <div className="rounded-xl border bg-neutral-50 p-4 text-xs text-[#6e6e73] space-y-1">
            <p>
              <strong className="text-[#1d1d1f]">Email:</strong> set Public email above + server{" "}
              <code className="bg-white px-1 rounded">RESEND_API_KEY</code>
            </p>
            <p>
              <strong className="text-[#1d1d1f]">WhatsApp:</strong> activate CallMeBot on the store
              WhatsApp number, then set{" "}
              <code className="bg-white px-1 rounded">CALLMEBOT_API_KEY</code>
            </p>
            <p>
              <strong className="text-[#1d1d1f]">Browser push:</strong> enable on this phone after
              VAPID keys are configured on the server.
            </p>
          </div>
        </section>

        {/* Designer credit (locked) */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Footer Credit</h2>
          <p className="text-xs text-[#6e6e73]">
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

        {/* SEO */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">SEO</h2>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Browser title"
              value={form.seo_title || ""}
              onChange={(e) => set("seo_title", e.target.value)}
            />
            <div>
              <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">Meta description</label>
              <textarea
                value={form.seo_description || ""}
                onChange={(e) => set("seo_description", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[#1d1d1f] bg-white focus:ring-2 focus:ring-black outline-none resize-none"
              />
            </div>
          </div>
        </section>

        {/* Legal identity */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Business Identity (Invoices)</h2>
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
        </section>

        {/* GST */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">GST Registration</h2>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
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
        </section>

        {/* Bank */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Bank Details (optional)</h2>
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
        </section>

        {/* Terms */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Invoice Footer</h2>
          <Input
            label="Authorized Signatory Label"
            value={form.authorized_signatory || ""}
            onChange={(e) => set("authorized_signatory", e.target.value)}
          />
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] mb-1.5 block">Terms & Conditions</label>
            <textarea
              value={form.terms || ""}
              onChange={(e) => set("terms", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[#1d1d1f] bg-white focus:ring-2 focus:ring-black outline-none resize-none"
            />
          </div>
        </section>

        <Button type="submit" className="w-full" isLoading={saving}>
          Save all settings
        </Button>
      </form>
    </div>
  );
}
