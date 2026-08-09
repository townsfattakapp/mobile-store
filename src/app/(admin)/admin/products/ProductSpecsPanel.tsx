"use client";

import React from "react";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type SpecRow = { name: string; value: string };
export type SpecSection = { title: string; items: SpecRow[] };

const HIGHLIGHT_KEYS = [
  "processor",
  "display",
  "camera",
  "battery",
  "os",
  "dimensions",
  "weight",
] as const;

type Props = {
  highlights: Record<string, string>;
  description: string;
  sections: SpecSection[];
  refreshing?: boolean;
  onChange: (next: {
    highlights: Record<string, string>;
    description: string;
    sections: SpecSection[];
  }) => void;
  onRefreshFromGsmArena?: () => void;
};

export function ProductSpecsPanel({
  highlights,
  description,
  sections,
  refreshing,
  onChange,
  onRefreshFromGsmArena,
}: Props) {
  const updateHighlight = (key: string, value: string) => {
    onChange({
      highlights: { ...highlights, [key]: value },
      description,
      sections,
    });
  };

  const updateSectionTitle = (si: number, title: string) => {
    const next = sections.map((s, i) => (i === si ? { ...s, title } : s));
    onChange({ highlights, description, sections: next });
  };

  const updateRow = (
    si: number,
    ri: number,
    field: "name" | "value",
    value: string
  ) => {
    const next = sections.map((s, i) => {
      if (i !== si) return s;
      const items = s.items.map((row, j) =>
        j === ri ? { ...row, [field]: value } : row
      );
      return { ...s, items };
    });
    onChange({ highlights, description, sections: next });
  };

  const addRow = (si: number) => {
    const next = sections.map((s, i) =>
      i === si
        ? { ...s, items: [...s.items, { name: "", value: "" }] }
        : s
    );
    onChange({ highlights, description, sections: next });
  };

  const removeRow = (si: number, ri: number) => {
    const next = sections.map((s, i) =>
      i === si
        ? { ...s, items: s.items.filter((_, j) => j !== ri) }
        : s
    );
    onChange({ highlights, description, sections: next });
  };

  const removeSection = (si: number) => {
    onChange({
      highlights,
      description,
      sections: sections.filter((_, i) => i !== si),
    });
  };

  const addSection = () => {
    onChange({
      highlights,
      description,
      sections: [...sections, { title: "New section", items: [{ name: "", value: "" }] }],
    });
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Technical specifications</h2>
            <p className="text-sm text-gray-500">
              Shown on the product page. These come from the master catalog
              (GSMArena-style). Edit or refresh anytime.
            </p>
          </div>
          {onRefreshFromGsmArena && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={onRefreshFromGsmArena}
              className="flex items-center gap-2"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing…" : "Refresh from GSMArena"}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HIGHLIGHT_KEYS.map((key) => (
            <Input
              key={key}
              label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              value={highlights[key] || ""}
              onChange={(e) => updateHighlight(key, e.target.value)}
              placeholder="—"
            />
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) =>
              onChange({
                highlights,
                description: e.target.value,
                sections,
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none text-[#1d1d1f] bg-white"
            placeholder="Short product description for the specs section"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#1d1d1f]">
            Spec sections ({sections.length})
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSection}
            className="flex items-center gap-1"
          >
            <Plus size={14} /> Add section
          </Button>
        </div>

        {sections.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white py-12 text-center text-sm text-gray-500">
            No structured sections yet. Use “Refresh from GSMArena” or add a
            section manually.
          </div>
        ) : (
          sections.map((section, si) => (
            <div
              key={`${section.title}-${si}`}
              className="bg-white rounded-xl border shadow-sm overflow-hidden"
            >
              <div className="flex items-center gap-3 border-b px-4 py-3 bg-neutral-50">
                <input
                  value={section.title}
                  onChange={(e) => updateSectionTitle(si, e.target.value)}
                  className="flex-1 bg-transparent text-base font-semibold outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeSection(si)}
                  className="text-xs text-red-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 size={13} /> Remove section
                </button>
              </div>
              <div className="divide-y">
                {section.items.map((row, ri) => (
                  <div
                    key={ri}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 px-4 py-2.5 items-center"
                  >
                    <input
                      value={row.name}
                      onChange={(e) =>
                        updateRow(si, ri, "name", e.target.value)
                      }
                      placeholder="Label"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={row.value}
                      onChange={(e) =>
                        updateRow(si, ri, "value", e.target.value)
                      }
                      placeholder="Value"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(si, ri)}
                      className="justify-self-end p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      aria-label="Remove row"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t">
                <button
                  type="button"
                  onClick={() => addRow(si)}
                  className="text-xs font-medium text-gray-600 hover:text-black"
                >
                  + Add row
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export { HIGHLIGHT_KEYS };
