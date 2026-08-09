"use client";

import React from "react";
import { format } from "date-fns";
import { formatINRPlain } from "@/lib/invoice/gst";
import type { InvoiceRecord } from "@/lib/invoice/types";

type Props = {
  invoice: InvoiceRecord;
};

export function InvoiceDocument({ invoice }: Props) {
  const store = invoice.store_snapshot;
  const customer = invoice.customer_snapshot;
  const items = invoice.items_snapshot || [];
  const totals = invoice.totals_snapshot;
  const isTaxInvoice = invoice.invoice_type === "tax_invoice" && invoice.is_gst;
  const isBillOfSupply = invoice.invoice_type === "bill_of_supply";
  const isCancelled = invoice.status === "cancelled";
  const showGstCols = isTaxInvoice;

  return (
    <div className="bg-white text-[#1d1d1f] text-[10px] leading-snug relative invoice-doc">
      {isCancelled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="text-5xl font-black text-red-500/20 rotate-[-24deg] border-4 border-red-500/30 px-6 py-3 uppercase tracking-widest">
            Cancelled
          </span>
        </div>
      )}

      {/* Top bar */}
      <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#6e6e73] mb-0.5">
            {isTaxInvoice ? "Original for Recipient" : "Customer Copy"}
          </p>
          <h1 className="text-lg font-black tracking-tight uppercase leading-tight">
            {store.document_title || (isTaxInvoice ? "Tax Invoice" : "Retail Invoice")}
          </h1>
          {isBillOfSupply && (
            <p className="text-[9px] text-[#6e6e73] mt-0.5 max-w-md">
              Composition taxable person, not eligible to collect tax on supplies
            </p>
          )}
          {!invoice.is_gst && (
            <p className="text-[9px] text-[#6e6e73] mt-0.5">Non-GST Invoice / Bill</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tracking-tight">{store.trade_name || store.legal_name}</p>
          <p className="text-[#424245] mt-0.5 leading-snug">
            {store.address_line1}
            {store.address_line2 ? `, ${store.address_line2}` : ""}
            <br />
            {store.city}, {store.state} - {store.pin_code}
            <br />
            State Code: {store.state_code}
          </p>
          {store.phone && <p>Phone: {store.phone}</p>}
          {store.email && <p>Email: {store.email}</p>}
          {store.gstin && (
            <p className="font-semibold mt-0.5">GSTIN: {store.gstin}</p>
          )}
          {store.pan && <p>PAN: {store.pan}</p>}
        </div>
      </div>

      {/* Meta + parties */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="border border-gray-300 rounded-md p-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#6e6e73] mb-1">
            Bill To / Consignee
          </p>
          <p className="font-bold text-[11px]">{customer.full_name}</p>
          <p className="text-[#424245] mt-0.5 leading-snug">
            {customer.address_line}
            <br />
            {customer.city}, {customer.state} - {customer.pin_code}
            <br />
            State Code: {customer.state_code || customer.place_of_supply_code}
          </p>
          {customer.mobile_number && <p className="mt-0.5">Mobile: {customer.mobile_number}</p>}
          {customer.email && <p>Email: {customer.email}</p>}
          {customer.gstin && <p className="font-semibold mt-0.5">GSTIN: {customer.gstin}</p>}
        </div>

        <div className="border border-gray-300 rounded-md p-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#6e6e73] mb-1">
            Invoice Details
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-[#6e6e73]">Invoice No.</dt>
            <dd className="font-bold">{invoice.invoice_number}</dd>
            <dt className="text-[#6e6e73]">Invoice Date</dt>
            <dd className="font-medium">{format(new Date(invoice.invoice_date), "dd MMM yyyy")}</dd>
            <dt className="text-[#6e6e73]">Financial Year</dt>
            <dd>{invoice.financial_year}</dd>
            {invoice.orders?.order_number && (
              <>
                <dt className="text-[#6e6e73]">Order No.</dt>
                <dd>{invoice.orders.order_number}</dd>
              </>
            )}
            {invoice.is_gst && (
              <>
                <dt className="text-[#6e6e73]">Place of Supply</dt>
                <dd>
                  {invoice.place_of_supply_state} ({invoice.place_of_supply_code})
                </dd>
                <dt className="text-[#6e6e73]">Supply Type</dt>
                <dd className="capitalize">
                  {invoice.supply_type === "intra"
                    ? "Intra-State (CGST + SGST)"
                    : invoice.supply_type === "inter"
                      ? "Inter-State (IGST)"
                      : "N/A"}
                </dd>
                <dt className="text-[#6e6e73]">Reverse Charge</dt>
                <dd>{invoice.reverse_charge ? "Yes" : "No"}</dd>
              </>
            )}
            {invoice.orders?.payment_method && (
              <>
                <dt className="text-[#6e6e73]">Payment</dt>
                <dd className="capitalize">
                  {invoice.orders.payment_method === "cod"
                    ? "Cash on Delivery"
                    : invoice.orders.payment_method}
                  {" · "}
                  {invoice.orders.payment_status}
                </dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Line items */}
      <table className="w-full border-collapse mb-2">
        <thead>
          <tr className="bg-neutral-100 border border-gray-300">
            <th className="border border-gray-300 px-1.5 py-1 text-left w-6">#</th>
            <th className="border border-gray-300 px-1.5 py-1 text-left">Description</th>
            <th className="border border-gray-300 px-1.5 py-1 text-left">HSN</th>
            <th className="border border-gray-300 px-1.5 py-1 text-center">Qty</th>
            <th className="border border-gray-300 px-1.5 py-1 text-right">Rate</th>
            {showGstCols && (
              <>
                <th className="border border-gray-300 px-1.5 py-1 text-right">Taxable</th>
                <th className="border border-gray-300 px-1.5 py-1 text-right">CGST</th>
                <th className="border border-gray-300 px-1.5 py-1 text-right">SGST</th>
                <th className="border border-gray-300 px-1.5 py-1 text-right">IGST</th>
              </>
            )}
            <th className="border border-gray-300 px-1.5 py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="align-top">
              <td className="border border-gray-300 px-1.5 py-1">{idx + 1}</td>
              <td className="border border-gray-300 px-1.5 py-1">
                <p className="font-semibold">{item.product_name}</p>
                {item.variant_name && (
                  <p className="text-[#6e6e73]">{item.variant_name}</p>
                )}
                <p className="text-[#6e6e73] font-mono text-[9px]">SKU: {item.sku}</p>
              </td>
              <td className="border border-gray-300 px-1.5 py-1">{item.hsn}</td>
              <td className="border border-gray-300 px-1.5 py-1 text-center">
                {item.quantity} {item.unit}
              </td>
              <td className="border border-gray-300 px-1.5 py-1 text-right">
                {formatINRPlain(item.unit_price)}
              </td>
              {showGstCols && (
                <>
                  <td className="border border-gray-300 px-1.5 py-1 text-right">
                    {formatINRPlain(item.taxable_amount)}
                  </td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right">
                    {item.cgst > 0 ? (
                      <>
                        {formatINRPlain(item.cgst)}
                        <span className="block text-[8px] text-[#6e6e73]">@{item.cgst_rate}%</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right">
                    {item.sgst > 0 ? (
                      <>
                        {formatINRPlain(item.sgst)}
                        <span className="block text-[8px] text-[#6e6e73]">@{item.sgst_rate}%</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right">
                    {item.igst > 0 ? (
                      <>
                        {formatINRPlain(item.igst)}
                        <span className="block text-[8px] text-[#6e6e73]">@{item.igst_rate}%</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </>
              )}
              <td className="border border-gray-300 px-1.5 py-1 text-right font-semibold">
                {formatINRPlain(item.line_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#6e6e73] mb-0.5">
            Amount in Words
          </p>
          <p className="font-semibold text-[11px] border border-gray-300 rounded p-1.5 bg-neutral-50 leading-snug">
            {totals.amount_in_words}
          </p>
          {totals.tax_inclusive && isTaxInvoice && (
            <p className="text-[8px] text-[#6e6e73] mt-1">
              Prices are GST-inclusive. Taxable value back-calculated as per Rule.
            </p>
          )}
          {invoice.notes && (
            <p className="mt-1.5 text-[10px] text-[#424245]">
              <span className="font-semibold">Notes: </span>
              {invoice.notes}
            </p>
          )}
          {store.terms && (
            <p className="mt-1 text-[8px] text-[#6e6e73] leading-snug">
              <span className="font-semibold text-[#424245]">Terms: </span>
              {store.terms}
            </p>
          )}
        </div>

        <div className="border border-gray-300 rounded overflow-hidden">
          <table className="w-full">
            <tbody>
              {showGstCols && (
                <tr className="border-b border-gray-200">
                  <td className="px-2 py-0.5 text-[#6e6e73]">Taxable Value</td>
                  <td className="px-2 py-0.5 text-right font-medium">
                    ₹{formatINRPlain(totals.items_taxable + (totals.shipping_taxable || 0))}
                  </td>
                </tr>
              )}
              {(totals.discount || 0) > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="px-2 py-0.5 text-[#6e6e73]">
                    Total discount applied
                    {showGstCols ? " (in line amounts)" : ""}
                  </td>
                  <td className="px-2 py-0.5 text-right font-medium text-emerald-700">
                    ₹{formatINRPlain(totals.discount)}
                  </td>
                </tr>
              )}
              {totals.shipping_charge > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="px-2 py-0.5 text-[#6e6e73]">Shipping / Freight</td>
                  <td className="px-2 py-0.5 text-right font-medium">
                    ₹{formatINRPlain(totals.shipping_charge)}
                  </td>
                </tr>
              )}
              {showGstCols && totals.cgst_total > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="px-2 py-0.5 text-[#6e6e73]">CGST</td>
                  <td className="px-2 py-0.5 text-right font-medium">
                    ₹{formatINRPlain(totals.cgst_total)}
                  </td>
                </tr>
              )}
              {showGstCols && totals.sgst_total > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="px-2 py-0.5 text-[#6e6e73]">SGST</td>
                  <td className="px-2 py-0.5 text-right font-medium">
                    ₹{formatINRPlain(totals.sgst_total)}
                  </td>
                </tr>
              )}
              {showGstCols && totals.igst_total > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="px-2 py-0.5 text-[#6e6e73]">IGST</td>
                  <td className="px-2 py-0.5 text-right font-medium">
                    ₹{formatINRPlain(totals.igst_total)}
                  </td>
                </tr>
              )}
              {showGstCols && (
                <tr className="border-b border-gray-200">
                  <td className="px-2 py-0.5 text-[#6e6e73]">Total Tax</td>
                  <td className="px-2 py-0.5 text-right font-medium">
                    ₹{formatINRPlain(totals.tax_total)}
                  </td>
                </tr>
              )}
              {totals.round_off != null && Number(totals.round_off) !== 0 && (
                <tr className="border-b border-gray-200">
                  <td className="px-2 py-0.5 text-[#6e6e73]">Round Off</td>
                  <td className="px-2 py-0.5 text-right font-medium">
                    {Number(totals.round_off) > 0 ? "+" : "−"} ₹
                    {formatINRPlain(Math.abs(Number(totals.round_off)))}
                  </td>
                </tr>
              )}
              <tr className="bg-neutral-100">
                <td className="px-2 py-1.5 font-bold text-[11px]">Grand Total</td>
                <td className="px-2 py-1.5 text-right font-black text-sm">
                  ₹{formatINRPlain(totals.grand_total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bank + signature */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-300">
        <div className="text-[10px] leading-snug">
          {(store.bank_name || store.bank_account) && (
            <>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#6e6e73] mb-0.5">
                Bank Details
              </p>
              {store.bank_name && <p>Bank: {store.bank_name}</p>}
              {store.bank_account && <p>A/C: {store.bank_account}</p>}
              {store.bank_ifsc && <p>IFSC: {store.bank_ifsc}</p>}
              {store.bank_branch && <p>Branch: {store.bank_branch}</p>}
            </>
          )}
        </div>
        <div className="text-right flex flex-col items-end justify-end min-h-[48px]">
          <p className="font-semibold text-[10px]">For {store.legal_name}</p>
          <div className="h-7" />
          <p className="border-t border-gray-400 pt-0.5 text-[10px] text-[#6e6e73]">
            {store.authorized_signatory || "Authorized Signatory"}
          </p>
        </div>
      </div>

      <p className="text-center text-[8px] text-[#6e6e73] mt-2 print:mt-1 leading-tight">
        This is a computer-generated invoice
        {invoice.is_gst ? " under the GST Act, 2017" : ""}.
        {isCancelled && invoice.cancel_reason
          ? ` Cancelled: ${invoice.cancel_reason}`
          : ""}
      </p>
      <p className="text-center text-[9px] font-medium text-[#424245] mt-1 print:mt-0.5 tracking-wide">
        Powered By Evolw - Fattakse A unit of Evolw
      </p>
    </div>
  );
}
