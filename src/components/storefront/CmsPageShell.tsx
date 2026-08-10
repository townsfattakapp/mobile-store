import React from "react";
import Link from "next/link";
import { CmsMarkdown } from "@/components/storefront/CmsMarkdown";

type Props = {
  title: string;
  eyebrow?: string;
  content: string;
  children?: React.ReactNode;
};

export function CmsPageShell({ title, eyebrow = "Mahadev Mobiles", content, children }: Props) {
  return (
    <div className="ms-cms-page">
      <div className="ms-cms-page-inner">
        <nav className="ms-cms-crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden>/</span>
          <span>{title}</span>
        </nav>
        <header className="ms-cms-header">
          <p className="ms-cms-eyebrow">{eyebrow}</p>
          <h1 className="ms-cms-title">{title}</h1>
        </header>
        {children}
        <CmsMarkdown source={content} />
      </div>
    </div>
  );
}
