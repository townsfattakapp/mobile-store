"use client";

import React, { Suspense, useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Ban, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InvoiceDocument } from "@/components/admin/InvoiceDocument";
import { cancelInvoice, getInvoice } from "../actions";
import type { InvoiceRecord } from "@/lib/invoice/types";
import { InvoiceArchiveControls } from "@/components/admin/ArchiveControls";

type InvoiceWithArchive = InvoiceRecord & {
  deleted_at?: string | null;
  delete_reason?: string | null;
};

function InvoiceDetailInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceWithArchive | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await getInvoice(id);
      if (res.error || !res.invoice) {
        setError(res.error || "Invoice not found");
        setInvoice(null);
      } else {
        setInvoice(res.invoice as InvoiceWithArchive);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!loading && invoice && searchParams.get("print") === "1") {
      const t = setTimeout(() => window.print(), 150);
      return () => clearTimeout(t);
    }
  }, [loading, invoice, searchParams]);

  const handleCancel = async () => {
    const reason = window.prompt("Reason for cancelling this invoice (required):");
    if (!reason?.trim()) return;
    setCancelling(true);
    const res = await cancelInvoice(id, reason);
    setCancelling(false);
    if (res.error) {
      alert(res.error);
      return;
    }
    const refreshed = await getInvoice(id);
    if (refreshed.invoice) setInvoice(refreshed.invoice as InvoiceWithArchive);
  };

  if (loading) {
    return <div className="p-8 text-center text-[#6e6e73]">Loading invoice...</div>;
  }

  if (error || !invoice) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{error || "Invoice not found"}</p>
        <Button variant="outline" onClick={() => router.push("/admin/invoices")}>
          Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="invoice-page min-h-screen print:min-h-0">
      <div className="print:hidden max-w-4xl mx-auto mb-6 flex flex-wrap justify-between items-center gap-3 px-2">
        <Button variant="outline" onClick={() => router.push("/admin/invoices")} className="gap-2 bg-white">
          <ArrowLeft className="w-4 h-4" /> All Invoices
        </Button>
        <div className="flex gap-2">
          {invoice.orders?.id && (
            <Link href={`/admin/orders/${invoice.orders.id}`}>
              <Button variant="outline">View Order</Button>
            </Link>
          )}
          <InvoiceArchiveControls
            invoiceId={invoice.id}
            archived={Boolean(invoice.deleted_at)}
          />
          {invoice.status === "issued" && !invoice.deleted_at && (
            <Button
              variant="outline"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleCancel}
              isLoading={cancelling}
            >
              <Ban className="w-4 h-4" /> Cancel Invoice
            </Button>
          )}
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print / PDF
          </Button>
        </div>
      </div>

      {invoice.deleted_at ? (
        <div className="print:hidden max-w-4xl mx-auto mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This invoice is in Trash
          {invoice.delete_reason ? ` — ${invoice.delete_reason}` : ""}.
        </div>
      ) : null}

      <div className="max-w-4xl mx-auto bg-white shadow-lg border rounded-xl print:shadow-none print:border-0 print:rounded-none print:max-w-none invoice-sheet">
        <div className="p-8 md:p-10 print:p-0">
          <InvoiceDocument invoice={invoice} />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          @media print {
            html, body {
              height: auto !important;
              min-height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              overflow: hidden !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            /* Hide everything except the invoice — avoids blank page 2 from layout chrome */
            body * {
              visibility: hidden !important;
            }
            .invoice-sheet,
            .invoice-sheet * {
              visibility: visible !important;
            }
            .invoice-page {
              min-height: 0 !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }
            .print\\:hidden {
              display: none !important;
              height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }
            .invoice-sheet {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              background: white !important;
              /* Slight shrink so Safari header/footer + one-line spill never creates page 2 */
              zoom: 0.92;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              break-after: avoid !important;
            }
            .invoice-doc {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        `,
      }} />
    </div>
  );
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#6e6e73]">Loading invoice...</div>}>
      <InvoiceDetailInner id={id} />
    </Suspense>
  );
}
