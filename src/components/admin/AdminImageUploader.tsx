"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardPaste, ImagePlus, Loader2, Link2, X } from "lucide-react";

type UploadResponse = {
  url?: string;
  bytes?: number;
  width?: number;
  height?: number;
  quality?: number;
  error?: string;
};

export type AdminImageUploaderProps = {
  value?: string;
  onChange: (url: string) => void;
  /** R2 key prefix, e.g. manual/power-bank */
  prefix?: string;
  label?: string;
  helpText?: string;
  allowUrlPaste?: boolean;
  /** When true, selecting multiple files calls onUploadedMany */
  multiple?: boolean;
  onUploadedMany?: (urls: string[]) => void;
  className?: string;
  compact?: boolean;
  /** Hide the left preview thumbnail (useful for multi-add galleries). */
  hidePreview?: boolean;
};

function formatKb(bytes?: number) {
  if (!bytes || bytes <= 0) return null;
  return `${Math.round(bytes / 1024)} KB`;
}

function extForMime(type: string) {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("avif")) return "avif";
  return "jpg";
}

async function uploadFile(file: File, prefix: string): Promise<UploadResponse> {
  const body = new FormData();
  body.append("file", file);
  body.append("prefix", prefix);
  body.append("knockOutWhite", "true");

  const res = await fetch("/api/admin/upload-image", {
    method: "POST",
    body,
  });
  const data = (await res.json().catch(() => ({}))) as UploadResponse;
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  if (!data.url) {
    throw new Error(data.error || "Upload succeeded but no URL returned");
  }
  return data;
}

function filesFromClipboard(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return [];
  const out: File[] = [];

  if (clipboardData.files?.length) {
    for (const f of Array.from(clipboardData.files)) {
      if (f.type.startsWith("image/")) out.push(f);
    }
  }

  if (out.length === 0 && clipboardData.items?.length) {
    for (const item of Array.from(clipboardData.items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (!blob) continue;
        const name =
          blob.name && blob.name !== "image.png"
            ? blob.name
            : `pasted-${Date.now()}.${extForMime(blob.type || "image/png")}`;
        out.push(
          new File([blob], name, { type: blob.type || "image/png" })
        );
      }
    }
  }

  return out;
}

function httpUrlFromClipboard(clipboardData: DataTransfer | null): string | null {
  if (!clipboardData) return null;
  const text = clipboardData.getData("text/plain")?.trim() || "";
  if (/^https?:\/\/\S+/i.test(text)) return text.split(/\s+/)[0];
  return null;
}

export function AdminImageUploader({
  value,
  onChange,
  prefix = "manual",
  label = "Product image",
  helpText = "Uploads to Cloudflare R2 as optimized WebP (target ≤ 200KB).",
  allowUrlPaste = true,
  multiple = false,
  onUploadedMany,
  className = "",
  compact = false,
  hidePreview = false,
}: AdminImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasteReady, setPasteReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  const handleFiles = useCallback(
    async (files: FileList | File[], source?: "paste" | "drop" | "browse") => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) {
        setError("Please choose an image file (JPG, PNG, WebP, etc.)");
        return;
      }

      setError(null);
      setUploading(true);
      setMeta(null);

      try {
        if (multiple && onUploadedMany) {
          const urls: string[] = [];
          let lastBytes = 0;
          for (const file of list.slice(0, 12)) {
            const data = await uploadFile(file, prefix);
            if (data.url) urls.push(data.url);
            lastBytes = data.bytes || lastBytes;
          }
          if (urls.length === 0) throw new Error("No images uploaded");
          onUploadedMany(urls);
          if (!value && urls[0]) onChange(urls[0]);
          setMeta(
            `${urls.length} image${urls.length > 1 ? "s" : ""} uploaded` +
              (source === "paste" ? " from paste" : "") +
              (lastBytes ? ` · last ${formatKb(lastBytes)}` : "")
          );
        } else {
          const data = await uploadFile(list[0], prefix);
          onChange(data.url!);
          const parts = [
            formatKb(data.bytes),
            data.width && data.height ? `${data.width}×${data.height}` : null,
            data.quality ? `q${data.quality}` : null,
            source === "paste" ? "pasted · WebP → R2" : "WebP → R2",
          ].filter(Boolean);
          setMeta(parts.join(" · "));
        }
      } catch (e: any) {
        setError(e?.message || "Upload failed");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [multiple, onUploadedMany, onChange, prefix, value]
  );

  const importRemoteUrl = useCallback(
    async (url: string) => {
      if (!url.startsWith("http")) {
        setError("Enter a valid http(s) image URL");
        return;
      }
      setError(null);
      setUploading(true);
      setMeta(null);
      try {
        const res = await fetch(url, { mode: "cors" }).catch(() => null);
        if (res?.ok) {
          const blob = await res.blob();
          if (!blob.type.startsWith("image/")) {
            throw new Error("URL did not return an image");
          }
          const file = new File([blob], "remote-image.jpg", {
            type: blob.type || "image/jpeg",
          });
          await handleFiles([file], "paste");
          setShowUrl(false);
          setUrlDraft("");
          return;
        }

        const form = new FormData();
        form.append("prefix", prefix);
        form.append("sourceUrl", url);
        const api = await fetch("/api/admin/upload-image", {
          method: "PUT",
          body: form,
        });
        const data = (await api.json().catch(() => ({}))) as UploadResponse;
        if (!api.ok || !data.url) {
          throw new Error(data.error || "Could not import image URL");
        }
        onChange(data.url);
        setMeta(
          [formatKb(data.bytes), "WebP → R2 (from URL)"].filter(Boolean).join(" · ")
        );
        setShowUrl(false);
        setUrlDraft("");
      } catch (e: any) {
        setError(
          e?.message ||
            "Could not import that URL. Try downloading the image and uploading the file instead."
        );
      } finally {
        setUploading(false);
      }
    },
    [handleFiles, onChange, prefix]
  );

  const handleClipboard = useCallback(
    async (clipboardData: DataTransfer | null) => {
      const images = filesFromClipboard(clipboardData);
      if (images.length > 0) {
        await handleFiles(images, "paste");
        return true;
      }
      if (allowUrlPaste) {
        const url = httpUrlFromClipboard(clipboardData);
        if (url) {
          await importRemoteUrl(url);
          return true;
        }
      }
      return false;
    },
    [allowUrlPaste, handleFiles, importRemoteUrl]
  );

  const onPasteZone = (e: React.ClipboardEvent) => {
    // Prefer our handler when images (or image URLs) are on the clipboard
    const hasImage =
      filesFromClipboard(e.clipboardData).length > 0 ||
      (allowUrlPaste && !!httpUrlFromClipboard(e.clipboardData));
    if (!hasImage) return;
    e.preventDefault();
    e.stopPropagation();
    void handleClipboard(e.clipboardData);
  };

  // Window paste while dropzone is focused / paste-ready (common screenshot workflow)
  useEffect(() => {
    if (!pasteReady || uploading) return;
    const onWindowPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        // Allow normal typing paste in fields — except our own zone input for URL
        if (!zoneRef.current?.contains(target)) return;
      }
      const hasImage =
        filesFromClipboard(e.clipboardData).length > 0 ||
        (allowUrlPaste && !!httpUrlFromClipboard(e.clipboardData));
      if (!hasImage) return;
      e.preventDefault();
      void handleClipboard(e.clipboardData);
    };
    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
  }, [pasteReady, uploading, allowUrlPaste, handleClipboard]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      void handleFiles(e.dataTransfer.files, "drop");
    }
  };

  const focusPasteZone = () => {
    zoneRef.current?.focus();
    setPasteReady(true);
  };

  const pasteFromClipboardButton = async () => {
    setError(null);
    focusPasteZone();
    try {
      if (!navigator.clipboard?.read) {
        setError("Click the upload box, then press ⌘V / Ctrl+V to paste an image.");
        return;
      }
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        files.push(
          new File([blob], `pasted-${Date.now()}.${extForMime(type)}`, {
            type,
          })
        );
      }
      if (files.length === 0) {
        // Fallback: maybe an image URL is on the clipboard as text
        try {
          const text = (await navigator.clipboard.readText()).trim();
          if (allowUrlPaste && /^https?:\/\//i.test(text)) {
            await importRemoteUrl(text.split(/\s+/)[0]);
            return;
          }
        } catch {
          /* ignore */
        }
        setError(
          "No image found on the clipboard. Copy a screenshot or image, click here, then paste."
        );
        return;
      }
      await handleFiles(files, "paste");
    } catch {
      setError("Click the upload box, then press ⌘V / Ctrl+V to paste an image.");
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {label ? (
        <label className="text-sm font-medium text-[#1d1d1f] block">{label}</label>
      ) : null}

      <div
        className={`flex ${compact ? "flex-col" : "flex-col sm:flex-row"} gap-4 items-start`}
      >
        {!hidePreview ? (
          <div
            className={`${
              compact ? "w-full h-36" : "w-28 h-28"
            } rounded-xl border bg-neutral-50 flex items-center justify-center overflow-hidden shrink-0 relative`}
          >
            {value ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value}
                  alt="Preview"
                  className="w-full h-full object-contain p-2"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setMeta(null);
                  }}
                  className="absolute top-1.5 right-1.5 rounded-full bg-white/95 border p-1 text-neutral-600 hover:text-red-600"
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <span className="text-neutral-400 text-[11px] px-2 text-center">
                No image
              </span>
            )}
          </div>
        ) : null}

        <div className="flex-1 w-full space-y-2">
          <div
            ref={zoneRef}
            tabIndex={0}
            role="button"
            aria-label="Image upload zone. Drop, browse, or paste an image."
            onClick={focusPasteZone}
            onFocus={() => setPasteReady(true)}
            onBlur={(e) => {
              if (!zoneRef.current?.contains(e.relatedTarget as Node)) {
                setPasteReady(false);
              }
            }}
            onPaste={onPasteZone}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragging(false);
            }}
            onDrop={onDrop}
            className={`rounded-xl border border-dashed px-4 py-5 outline-none transition-colors ${
              dragging
                ? "border-black bg-neutral-100"
                : pasteReady
                  ? "border-[#3b2f7c] bg-[#3b2f7c]/5 ring-2 ring-[#3b2f7c]/15"
                  : "border-neutral-300 bg-neutral-50/70"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/*"
              multiple={multiple}
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void handleFiles(e.target.files, "browse");
              }}
            />
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-black text-white px-3.5 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-60"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Optimizing…
                    </>
                  ) : (
                    <>
                      <ImagePlus size={16} />
                      {multiple ? "Upload images" : "Upload image"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    void pasteFromClipboardButton();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-[#1d1d1f] hover:bg-neutral-50 disabled:opacity-60"
                >
                  <ClipboardPaste size={16} />
                  Paste image
                </button>
              </div>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                Drag & drop{multiple ? " (up to 12)" : ""}, browse, or{" "}
                <strong className="font-semibold text-[#1d1d1f]">
                  paste with ⌘V / Ctrl+V
                </strong>{" "}
                (screenshot or copied image). Converted to WebP → R2.
                {pasteReady ? (
                  <span className="ml-1 text-[#3b2f7c] font-medium">
                    Ready for paste…
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          {allowUrlPaste ? (
            <div>
              {!showUrl ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3b2f7c] hover:underline"
                  onClick={() => setShowUrl(true)}
                  disabled={uploading}
                >
                  <Link2 size={13} />
                  Or paste image URL
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    onPaste={(e) => {
                      const text =
                        e.clipboardData.getData("text/plain")?.trim() || "";
                      if (/^https?:\/\//i.test(text)) {
                        // Let the value update, but also support pasting an image file into this field
                        return;
                      }
                      const images = filesFromClipboard(e.clipboardData);
                      if (images.length) {
                        e.preventDefault();
                        void handleFiles(images, "paste");
                      }
                    }}
                    placeholder="https://… or paste an image here"
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-md outline-none focus:ring-2 focus:ring-black text-sm"
                    disabled={uploading}
                  />
                  <button
                    type="button"
                    onClick={() => void importRemoteUrl(urlDraft.trim())}
                    disabled={uploading || !urlDraft.trim()}
                    className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Import
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {helpText ? (
            <p className="text-xs text-[#6e6e73]">{helpText}</p>
          ) : null}
          {meta ? (
            <p className="text-xs font-medium text-emerald-700">{meta}</p>
          ) : null}
          {error ? (
            <p className="text-xs font-medium text-red-600">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
