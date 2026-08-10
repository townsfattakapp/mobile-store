"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";
import {
  adjustEntriesAction,
  announceWinnersAction,
  exportParticipantsCsvAction,
  getGiveawayDetailAction,
  resolveRiskFlagAction,
  runDrawAction,
  setGiveawayStatusAction,
  upsertGiveawayAction,
} from "../actions";
import type { GiveawayStatus } from "@/lib/giveaway/types";

export default function GiveawayDetailAdminPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adjust, setAdjust] = useState({ participantId: "", entries: 1, reason: "" });
  const [edit, setEdit] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getGiveawayDetailAction(id);
    if (res.error) setError(res.error);
    else {
      setData(res);
      const g = res.giveaway;
      setEdit({
        id: g.id,
        title: g.title,
        slug: g.slug,
        description: g.description || "",
        prize_title: g.prize_title,
        prize_description: g.prize_description || "",
        prize_image: g.prize_image || "",
        terms_and_conditions: g.terms_and_conditions || "",
        start_at: g.start_at ? g.start_at.slice(0, 16) : "",
        end_at: g.end_at ? g.end_at.slice(0, 16) : "",
        status: g.status,
        max_winners: g.max_winners,
        rules: (res.rules || []).map((r: any) => ({
          action_type: r.action_type,
          entries: r.entries,
          min_order_amount: r.min_order_amount,
          max_order_amount: r.max_order_amount,
          enabled: r.enabled,
          configuration: r.configuration || {},
        })),
      });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading giveaway…</div>;
  }

  if (error || !data || !edit) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-sm text-red-700">{error || "Not found"}</p>
        <Link href="/admin/giveaways" className="underline text-sm">
          Back
        </Link>
      </div>
    );
  }

  const saveEdit = async () => {
    setBusy(true);
    setError(null);
    const res = await upsertGiveawayAction(edit);
    setBusy(false);
    if (res.error) setError(res.error);
    else load();
  };

  const changeStatus = async (status: GiveawayStatus) => {
    setBusy(true);
    const res = await setGiveawayStatusAction(id, status);
    setBusy(false);
    if (res.error) alert(res.error);
    else load();
  };

  const doDraw = async () => {
    if (!confirm("Execute secure weighted draw? This can only run once.")) return;
    setBusy(true);
    const res = await runDrawAction(id);
    setBusy(false);
    if (res.error) alert(res.error);
    else {
      alert(`Winners: ${(res.winners || []).map((w: any) => w.displayName).join(", ")}`);
      load();
    }
  };

  const doAnnounce = async () => {
    setBusy(true);
    const res = await announceWinnersAction(id);
    setBusy(false);
    if (res.error) alert(res.error);
    else load();
  };

  const doAdjust = async () => {
    setBusy(true);
    const res = await adjustEntriesAction({
      giveawayId: id,
      participantId: adjust.participantId,
      entries: Number(adjust.entries),
      reason: adjust.reason,
    });
    setBusy(false);
    if (res.error) alert(res.error);
    else {
      setAdjust({ participantId: "", entries: 1, reason: "" });
      load();
    }
  };

  const doExport = async () => {
    const res = await exportParticipantsCsvAction(id);
    if (res.error || !res.csv) {
      alert(res.error || "Export failed");
      return;
    }
    const blob = new Blob([res.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `giveaway-${edit.slug}-participants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/giveaways" className="text-xs text-gray-500 hover:underline">
            ← Giveaways
          </Link>
          <h1 className="text-2xl font-bold mt-1">{data.giveaway.title}</h1>
          <p className="text-sm text-gray-500">
            Public:{" "}
            <a
              className="underline"
              href={`/giveaway/${data.giveaway.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              /giveaway/{data.giveaway.slug}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["draft", "scheduled", "active", "paused", "completed", "cancelled"] as GiveawayStatus[]).map(
            (s) => (
              <button
                key={s}
                type="button"
                disabled={busy || data.giveaway.status === s}
                onClick={() => changeStatus(s)}
                className={`text-xs px-2.5 py-1.5 rounded-md border ${
                  data.giveaway.status === s
                    ? "bg-[#1d1d1f] text-white"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            )
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-white p-3">
          <p className="text-[11px] text-gray-500">Participants</p>
          <p className="text-xl font-bold">{data.analytics.participants}</p>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <p className="text-[11px] text-gray-500">Total entries</p>
          <p className="text-xl font-bold">{data.analytics.totalEntries}</p>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <p className="text-[11px] text-gray-500">Referrals</p>
          <p className="text-xl font-bold">{data.analytics.referrals}</p>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <p className="text-[11px] text-gray-500">Entry sources</p>
          <p className="text-xs mt-1 text-gray-600">
            {Object.entries(data.analytics.sourceDistribution || {})
              .map(([k, v]) => `${k}:${v}`)
              .join(" · ") || "—"}
          </p>
        </div>
      </div>

      {/* Edit */}
      <section className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="font-semibold text-lg">Edit campaign</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Title"
            value={edit.title}
            onChange={(e) => setEdit((f: any) => ({ ...f, title: e.target.value }))}
          />
          <Input
            label="Slug"
            value={edit.slug}
            onChange={(e) => setEdit((f: any) => ({ ...f, slug: e.target.value }))}
          />
          <Input
            label="Prize title"
            value={edit.prize_title}
            onChange={(e) => setEdit((f: any) => ({ ...f, prize_title: e.target.value }))}
          />
          <Input
            label="Max winners"
            type="number"
            value={edit.max_winners}
            onChange={(e) =>
              setEdit((f: any) => ({ ...f, max_winners: Number(e.target.value) || 1 }))
            }
          />
          <Input
            label="Start"
            type="datetime-local"
            value={edit.start_at || ""}
            onChange={(e) => setEdit((f: any) => ({ ...f, start_at: e.target.value }))}
          />
          <Input
            label="End"
            type="datetime-local"
            value={edit.end_at || ""}
            onChange={(e) => setEdit((f: any) => ({ ...f, end_at: e.target.value }))}
          />
        </div>
        <Input
          label="Description"
          value={edit.description || ""}
          onChange={(e) => setEdit((f: any) => ({ ...f, description: e.target.value }))}
        />
        <div>
          <label className="block text-sm font-medium mb-1">Prize image</label>
          <AdminImageUploader
            prefix="giveaways"
            value={edit.prize_image || ""}
            onChange={(url) => setEdit((f: any) => ({ ...f, prize_image: url }))}
          />
        </div>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]"
          placeholder="Terms"
          value={edit.terms_and_conditions || ""}
          onChange={(e) =>
            setEdit((f: any) => ({ ...f, terms_and_conditions: e.target.value }))
          }
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Entry rules</h3>
            <button
              type="button"
              className="text-xs underline"
              onClick={() =>
                setEdit((f: any) => ({
                  ...f,
                  rules: [
                    ...(f.rules || []),
                    { action_type: "bonus", entries: 1, enabled: true },
                  ],
                }))
              }
            >
              Add rule
            </button>
          </div>
          {(edit.rules || []).map((r: any, idx: number) => (
            <div key={idx} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
              <select
                className="h-10 border rounded-lg px-2 text-sm"
                value={r.action_type}
                onChange={(e) => {
                  const rules = [...edit.rules];
                  rules[idx] = { ...rules[idx], action_type: e.target.value };
                  setEdit((f: any) => ({ ...f, rules }));
                }}
              >
                {[
                  "join",
                  "referral",
                  "whatsapp_share",
                  "purchase",
                  "bonus",
                  "social_action",
                  "admin_adjustment",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Input
                label="Entries"
                type="number"
                value={r.entries}
                onChange={(e) => {
                  const rules = [...edit.rules];
                  rules[idx] = { ...rules[idx], entries: Number(e.target.value) };
                  setEdit((f: any) => ({ ...f, rules }));
                }}
              />
              <Input
                label="Min ₹"
                type="number"
                value={r.min_order_amount ?? ""}
                onChange={(e) => {
                  const rules = [...edit.rules];
                  rules[idx] = {
                    ...rules[idx],
                    min_order_amount: e.target.value ? Number(e.target.value) : null,
                  };
                  setEdit((f: any) => ({ ...f, rules }));
                }}
              />
              <Input
                label="Max ₹"
                type="number"
                value={r.max_order_amount ?? ""}
                onChange={(e) => {
                  const rules = [...edit.rules];
                  rules[idx] = {
                    ...rules[idx],
                    max_order_amount: e.target.value ? Number(e.target.value) : null,
                  };
                  setEdit((f: any) => ({ ...f, rules }));
                }}
              />
              <label className="flex items-center gap-2 text-sm h-10">
                <input
                  type="checkbox"
                  checked={r.enabled !== false}
                  onChange={(e) => {
                    const rules = [...edit.rules];
                    rules[idx] = { ...rules[idx], enabled: e.target.checked };
                    setEdit((f: any) => ({ ...f, rules }));
                  }}
                />
                Enabled
              </label>
              <button
                type="button"
                className="text-xs text-red-600 h-10"
                onClick={() => {
                  const rules = edit.rules.filter((_: any, i: number) => i !== idx);
                  setEdit((f: any) => ({ ...f, rules }));
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <Button type="button" onClick={saveEdit} disabled={busy}>
          Save changes
        </Button>
      </section>

      {/* Draw */}
      <section className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="font-semibold text-lg">Winner draw</h2>
        <p className="text-sm text-gray-600">
          Weighted raffle (1 entry = 1 chance). End the giveaway first, then draw once.
          Announcing emails winners via Resend.
        </p>
        {data.draw ? (
          <p className="text-sm">
            Draw executed {new Date(data.draw.executed_at).toLocaleString()} ·{" "}
            {data.draw.total_eligible_entries} eligible entries ·{" "}
            {(data.winners || []).map((w: any) => w.display_name).join(", ") || "—"}
          </p>
        ) : (
          <Button type="button" onClick={doDraw} disabled={busy}>
            Execute secure draw
          </Button>
        )}
        {data.winners?.length > 0 && !data.winners.every((w: any) => w.publicly_announced) ? (
          <Button type="button" variant="secondary" onClick={doAnnounce} disabled={busy}>
            Announce winners + email
          </Button>
        ) : null}
      </section>

      {/* Adjust */}
      <section className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="font-semibold text-lg">Manual entry adjustment</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className="h-10 border rounded-lg px-2 text-sm"
            value={adjust.participantId}
            onChange={(e) => setAdjust((a) => ({ ...a, participantId: e.target.value }))}
          >
            <option value="">Select participant</option>
            {(data.participants || []).map((p: any) => {
              const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
              return (
                <option key={p.id} value={p.id}>
                  #{p.rank} {profile?.full_name || profile?.email} ({p.entries})
                </option>
              );
            })}
          </select>
          <Input
            label="Delta (+/−)"
            type="number"
            value={adjust.entries}
            onChange={(e) =>
              setAdjust((a) => ({ ...a, entries: Number(e.target.value) || 0 }))
            }
          />
          <Input
            label="Reason"
            value={adjust.reason}
            onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))}
          />
          <Button type="button" className="mt-6" onClick={doAdjust} disabled={busy}>
            Apply
          </Button>
        </div>
      </section>

      {/* Participants */}
      <section className="rounded-xl border bg-white overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b">
          <h2 className="font-semibold text-lg">Participants</h2>
          <Button type="button" variant="outline" onClick={doExport}>
            Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left">Rank</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Entries</th>
                <th className="px-3 py-2 text-left">Referrals</th>
                <th className="px-3 py-2 text-left">Purchase ₹</th>
                <th className="px-3 py-2 text-left">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data.participants || []).map((p: any) => {
                const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2">#{p.rank}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{profile?.full_name || "—"}</div>
                      <div className="text-xs text-gray-500">{profile?.email}</div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{p.entries}</td>
                    <td className="px-3 py-2">{p.referral_count}</td>
                    <td className="px-3 py-2">
                      {Number(p.purchase_contribution || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {new Date(p.joined_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Entry history */}
      <section className="rounded-xl border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-lg">Entry history (latest 500)</h2>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Entries</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data.entries || []).map((e: any) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{e.source_type}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">{e.entries}</td>
                  <td className="px-3 py-2 text-xs break-all">{e.source_id || "—"}</td>
                  <td className="px-3 py-2 text-xs">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Risk */}
      <section className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="font-semibold text-lg">Risk flags</h2>
        {(data.flags || []).length === 0 ? (
          <p className="text-sm text-gray-500">No flags.</p>
        ) : (
          <ul className="space-y-2">
            {(data.flags || []).map((f: any) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{f.flag_type}</span>
                  <span className="text-gray-500 ml-2">{f.status}</span>
                </div>
                {f.status === "open" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={async () => {
                        await resolveRiskFlagAction(f.id, id, "resolved");
                        load();
                      }}
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={async () => {
                        await resolveRiskFlagAction(f.id, id, "dismissed");
                        load();
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Audit */}
      <section className="rounded-xl border bg-white p-5 space-y-2">
        <h2 className="font-semibold text-lg">Audit log</h2>
        <ul className="text-xs space-y-1 max-h-60 overflow-y-auto">
          {(data.audit || []).map((a: any) => (
            <li key={a.id} className="border-b py-1.5">
              {new Date(a.created_at).toLocaleString()} · <strong>{a.action}</strong>{" "}
              {a.entity} {a.entity_id}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
