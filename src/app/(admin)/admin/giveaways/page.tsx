"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";
import { Gift, Plus, RefreshCw } from "lucide-react";
import {
  listGiveawaysAction,
  upsertGiveawayAction,
  type GiveawayFormInput,
} from "./actions";
import type { GiveawayStatus } from "@/lib/giveaway/types";

const DEFAULT_RULES: GiveawayFormInput["rules"] = [
  { action_type: "join", entries: 1, enabled: true },
  {
    action_type: "whatsapp_share",
    entries: 1,
    enabled: true,
    configuration: { cooldown_hours: 24 },
  },
  { action_type: "referral", entries: 2, enabled: true },
  {
    action_type: "purchase",
    entries: 5,
    min_order_amount: 20000,
    enabled: true,
  },
  {
    action_type: "purchase",
    entries: 10,
    min_order_amount: 50000,
    enabled: true,
  },
];

function emptyForm(): GiveawayFormInput {
  return {
    title: "",
    slug: "",
    description: "",
    prize_title: "",
    prize_description: "",
    prize_image: "",
    terms_and_conditions: "",
    start_at: "",
    end_at: "",
    status: "draft",
    max_winners: 1,
    rules: (DEFAULT_RULES || []).map((r) => ({ ...r })),
  };
}

export default function GiveawaysAdminPage() {
  const [giveaways, setGiveaways] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<GiveawayFormInput>(emptyForm());
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listGiveawaysAction();
    if (res.error) setError(res.error);
    setGiveaways(res.giveaways || []);
    setMetrics(res.metrics);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await upsertGiveawayAction(form);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setForm(emptyForm());
    setShowForm(false);
    await load();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] flex items-center gap-2">
            <Gift className="h-6 w-6" /> Giveaways
          </h1>
          <p className="text-sm text-[#6e6e73] mt-1">
            Campaigns, entry rules, leaderboard, referrals, and secure winner draws.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={load} className="flex items-center gap-2">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            {showForm ? "Close" : "New giveaway"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            ["Total", metrics.totalGiveaways],
            ["Active", metrics.activeGiveaways],
            ["Participants", metrics.participants],
            ["Entries", metrics.totalEntries],
            ["Referrals", metrics.referrals],
            [
              "Purchase ₹",
              Number(metrics.purchaseRevenue || 0).toLocaleString("en-IN"),
            ],
          ].map(([label, val]) => (
            <div key={String(label)} className="rounded-xl border bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
              <p className="text-xl font-bold mt-1">{val}</p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl border shadow-sm p-5 space-y-4"
        >
          <h2 className="text-lg font-semibold">Create giveaway</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
            <Input
              label="Slug"
              placeholder="auto from title if empty"
              value={form.slug || ""}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
            <Input
              label="Prize title"
              value={form.prize_title}
              onChange={(e) => setForm((f) => ({ ...f, prize_title: e.target.value }))}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                className="w-full h-10 border rounded-lg px-3 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as GiveawayStatus }))
                }
              >
                {["draft", "scheduled", "active", "paused", "completed", "cancelled"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  )
                )}
              </select>
            </div>
            <Input
              label="Starts at"
              type="datetime-local"
              value={form.start_at || ""}
              onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
            />
            <Input
              label="Ends at"
              type="datetime-local"
              value={form.end_at || ""}
              onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
            />
            <Input
              label="Max winners"
              type="number"
              min={1}
              value={form.max_winners || 1}
              onChange={(e) =>
                setForm((f) => ({ ...f, max_winners: Number(e.target.value) || 1 }))
              }
            />
          </div>
          <Input
            label="Short description"
            value={form.description || ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prize image</label>
            <AdminImageUploader
              prefix="giveaways"
              value={form.prize_image || ""}
              onChange={(url) => setForm((f) => ({ ...f, prize_image: url }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Terms & conditions
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[100px]"
              value={form.terms_and_conditions || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, terms_and_conditions: e.target.value }))
              }
            />
          </div>
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Entry rules</p>
                <p className="text-xs text-gray-500">
                  Starting defaults — change entries, purchase ₹ thresholds, or add/remove rules before create.
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-medium underline underline-offset-2 shrink-0"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    rules: [
                      ...(f.rules || []),
                      {
                        action_type: "purchase",
                        entries: 5,
                        min_order_amount: 20000,
                        enabled: true,
                        configuration: {},
                      },
                    ],
                  }))
                }
              >
                Add rule
              </button>
            </div>

            {(form.rules || []).map((r, idx) => (
              <div
                key={idx}
                className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end rounded-md bg-gray-50 p-2"
              >
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Action</label>
                  <select
                    className="w-full h-10 border rounded-lg px-2 text-sm bg-white"
                    value={r.action_type}
                    onChange={(e) => {
                      const rules = [...(form.rules || [])];
                      const action_type = e.target.value;
                      rules[idx] = {
                        ...rules[idx],
                        action_type,
                        configuration:
                          action_type === "whatsapp_share"
                            ? {
                                ...(rules[idx].configuration || {}),
                                cooldown_hours:
                                  Number(
                                    (rules[idx].configuration as any)?.cooldown_hours
                                  ) || 24,
                              }
                            : rules[idx].configuration || {},
                      };
                      setForm((f) => ({ ...f, rules }));
                    }}
                  >
                    {[
                      "join",
                      "referral",
                      "whatsapp_share",
                      "purchase",
                      "bonus",
                      "social_action",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Entries"
                  type="number"
                  value={r.entries}
                  onChange={(e) => {
                    const rules = [...(form.rules || [])];
                    rules[idx] = { ...rules[idx], entries: Number(e.target.value) || 0 };
                    setForm((f) => ({ ...f, rules }));
                  }}
                />
                <Input
                  label="Min ₹"
                  type="number"
                  placeholder={r.action_type === "purchase" ? "e.g. 20000" : "—"}
                  value={r.min_order_amount ?? ""}
                  onChange={(e) => {
                    const rules = [...(form.rules || [])];
                    rules[idx] = {
                      ...rules[idx],
                      min_order_amount: e.target.value ? Number(e.target.value) : null,
                    };
                    setForm((f) => ({ ...f, rules }));
                  }}
                />
                <Input
                  label="Max ₹"
                  type="number"
                  placeholder="optional"
                  value={r.max_order_amount ?? ""}
                  onChange={(e) => {
                    const rules = [...(form.rules || [])];
                    rules[idx] = {
                      ...rules[idx],
                      max_order_amount: e.target.value ? Number(e.target.value) : null,
                    };
                    setForm((f) => ({ ...f, rules }));
                  }}
                />
                {r.action_type === "whatsapp_share" ? (
                  <Input
                    label="Cooldown (hours)"
                    type="number"
                    min={1}
                    value={
                      Number((r.configuration as any)?.cooldown_hours) || 24
                    }
                    onChange={(e) => {
                      const rules = [...(form.rules || [])];
                      rules[idx] = {
                        ...rules[idx],
                        configuration: {
                          ...(rules[idx].configuration || {}),
                          cooldown_hours: Number(e.target.value) || 24,
                        },
                      };
                      setForm((f) => ({ ...f, rules }));
                    }}
                  />
                ) : (
                  <label className="flex items-center gap-2 text-sm h-10 md:mt-6">
                    <input
                      type="checkbox"
                      checked={r.enabled !== false}
                      onChange={(e) => {
                        const rules = [...(form.rules || [])];
                        rules[idx] = { ...rules[idx], enabled: e.target.checked };
                        setForm((f) => ({ ...f, rules }));
                      }}
                    />
                    Enabled
                  </label>
                )}
                <div className="flex items-center gap-2 h-10 md:mt-6">
                  {r.action_type === "whatsapp_share" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={r.enabled !== false}
                        onChange={(e) => {
                          const rules = [...(form.rules || [])];
                          rules[idx] = { ...rules[idx], enabled: e.target.checked };
                          setForm((f) => ({ ...f, rules }));
                        }}
                      />
                      On
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs text-red-600 ml-auto"
                    onClick={() => {
                      const rules = (form.rules || []).filter((_, i) => i !== idx);
                      setForm((f) => ({ ...f, rules }));
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {(form.rules || []).length === 0 ? (
              <p className="text-xs text-amber-800">
                No rules — add at least a Join rule or entries won’t be awarded.
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Create giveaway"}
          </Button>
        </form>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Campaign</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600">Window</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : giveaways.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  No giveaways yet.
                </td>
              </tr>
            ) : (
              giveaways.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{g.title}</div>
                    <div className="text-xs text-gray-500">
                      {g.prize_title} · /giveaway/{g.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100">
                      {g.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {g.start_at ? new Date(g.start_at).toLocaleString() : "—"}
                    {" → "}
                    {g.end_at ? new Date(g.end_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/giveaways/${g.id}`}
                      className="text-sm font-medium underline underline-offset-2"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
