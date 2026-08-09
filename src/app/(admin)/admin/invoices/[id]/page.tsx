"use client";

import React, { Suspense, useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Ban, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InvoiceDocument } from "@/components/admin/InvoiceDocument";
import { cancelInvoice, getInvoice } from "../actions";
import type { InvoiceRecord } from "@/lib/invoice/types";

function InvoiceDetailInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
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
        setInvoice(res.invoice as InvoiceRecord);
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
    if (refreshed.invoice) setInvoice(refreshed.invoice as InvoiceRecord);
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
    <div className="min-h-screen">
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
          {invoice.status === "issued" && (
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

      <div className="max-w-4xl mx-auto bg-white shadow-lg border rounded-xl print:shadow-none print:border-0 print:rounded-none print:max-w-none invoice-sheet">
        <div className="p-8 md:p-10 print:p-0">
          <InvoiceDocument invoice={invoice} />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @page {
            size: A4;
            margin: 8mm 10mm;
          }
          @media print {
            html, body {
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body * { visibility: hidden; }
            .invoice-sheet, .invoice-sheet * { visibility: visible; }
            .invoice-sheet {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              max-width: none !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .invoice-doc {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .print\\:hidden { display: none !important; }
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
