import React from "react";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(text: string): string {
  let out = escapeHtml(text);
  // links [label](url) — only http(s) or relative /
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const safeHref = String(href).trim();
    if (!/^(https?:\/\/|\/)/i.test(safeHref)) return escapeHtml(label);
    const rel = safeHref.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHtml(safeHref)}"${rel}>${escapeHtml(label)}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

/**
 * Tiny safe markdown subset for store CMS pages:
 * # / ## / ### headings, paragraphs, -/* lists, 1. numbered lists, **bold**, [links](url)
 */
export function renderCmsMarkdown(source: string): string {
  const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      html.push(listType === "ol" ? "</ol>" : "</ul>");
      listType = null;
    }
  };

  const openList = (type: "ul" | "ol") => {
    if (listType === type) return;
    closeList();
    html.push(type === "ol" ? "<ol>" : "<ul>");
    listType = type;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      i += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineFormat(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      openList("ul");
      html.push(`<li>${inlineFormat(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      openList("ol");
      html.push(`<li>${inlineFormat(trimmed.replace(/^\d+\.\s+/, ""))}</li>`);
      i += 1;
      continue;
    }

    closeList();
    const para: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next || /^(#{1,3})\s+/.test(next) || /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next)) {
        break;
      }
      para.push(next);
      i += 1;
    }
    html.push(`<p>${inlineFormat(para.join(" "))}</p>`);
  }

  closeList();
  return html.join("\n");
}

export function CmsMarkdown({ source, className }: { source: string; className?: string }) {
  return (
    <div
      className={className || "ms-cms-prose"}
      dangerouslySetInnerHTML={{ __html: renderCmsMarkdown(source) }}
    />
  );
}
