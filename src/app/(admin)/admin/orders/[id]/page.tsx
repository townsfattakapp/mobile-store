import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/Button";
import { normalizeAddress } from "@/lib/invoice/types";
import { normalizePhoneKey } from "@/lib/customers/phone";
import { OrderStatusPanel } from "./OrderStatusPanel";
import { ORDER_STATUS_LABEL } from "./orderStatus";
import { OrderArchiveControls } from "@/components/admin/ArchiveControls";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function money(n: unknown) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "confirmed":
    case "processing":
    case "ready_for_pickup":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "shipped":
    case "out_for_delivery":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "delivered":
      return "bg-green-100 text-green-800 border-green-200";
    case "cancelled":
    case "returned":
    case "refunded":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function paymentBadgeClass(status: string) {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800";
    case "failed":
    case "refunded":
      return "bg-red-100 text-red-800";
    default:
      return "bg-yellow-100 text-yellow-800";
  }
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "cod":
      return "Cash on delivery";
    case "store_pickup":
      return "Store pickup";
    case "online":
      return "Online";
    default:
      return method?.replaceAll("_", " ") || "—";
  }
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      user_id,
      address_snapshot,
      subtotal,
      discount,
      tax_total,
      shipping_charge,
      grand_total,
      payment_method,
      payment_status,
      status,
      notes,
      created_at,
      updated_at,
      deleted_at,
      delete_reason,
      order_items (
        id,
        product_name,
        variant_name,
        sku,
        quantity,
        unit_price,
        discount,
        tax_rate,
        total_price
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-800">Could not load order</p>
        <p className="mt-2 text-sm text-red-700">{error.message}</p>
        <Link href="/admin/orders" className="mt-4 inline-block text-sm font-medium underline">
          Back to orders
        </Link>
      </div>
    );
  }

  if (!order) notFound();

  const [historyRes, invoiceRes] = await Promise.all([
    supabase
      .from("order_status_history")
      .select("id, status, notes, created_at, created_by")
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const history = historyRes.data || [];
  const invoice = invoiceRes.data?.[0] || null;

  const addr = normalizeAddress(order.address_snapshot);
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const placedAt = new Date(order.created_at);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/admin/orders">
            <Button variant="ghost" className="rounded-full p-2" aria-label="Back to orders">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{order.order_number}</h1>
              <span
                className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(order.status)}`}
              >
                {ORDER_STATUS_LABEL[order.status as keyof typeof ORDER_STATUS_LABEL] ||
                  order.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Placed{" "}
              {placedAt.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <OrderArchiveControls orderId={order.id} archived={Boolean(order.deleted_at)} />
          {invoice?.id ? (
            <Link href={`/admin/invoices/${invoice.id}`}>
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                View invoice {invoice.invoice_number}
              </Button>
            </Link>
          ) : (
            <Link href={`/admin/invoices/new?orderId=${order.id}`}>
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                Generate invoice
              </Button>
            </Link>
          )}
        </div>
      </div>

      {order.deleted_at ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This order is in Trash
          {order.delete_reason ? ` — ${order.delete_reason}` : ""}. Restore it to show in active
          lists again.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-gray-50/50 p-4">
              <h3 className="font-semibold">Items</h3>
            </div>
            {items.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">No line items on this order.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-white text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold sm:px-6">Product</th>
                      <th className="px-4 py-3 text-center font-semibold sm:px-6">Qty</th>
                      <th className="px-4 py-3 text-right font-semibold sm:px-6">Price</th>
                      <th className="px-4 py-3 text-right font-semibold sm:px-6">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-4 sm:px-6">
                          <div className="font-medium text-gray-900">{item.product_name}</div>
                          {item.variant_name ? (
                            <div className="mt-0.5 text-xs text-gray-500">{item.variant_name}</div>
                          ) : null}
                          <div className="mt-0.5 text-xs text-gray-400">SKU: {item.sku}</div>
                        </td>
                        <td className="px-4 py-4 text-center font-medium sm:px-6">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-4 text-right sm:px-6">{money(item.unit_price)}</td>
                        <td className="px-4 py-4 text-right font-semibold sm:px-6">
                          {money(item.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-col items-end gap-2 border-t bg-gray-50/50 p-6 text-sm">
              <div className="flex w-full max-w-xs justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{money(order.subtotal)}</span>
              </div>
              {Number(order.discount) > 0 ? (
                <div className="flex w-full max-w-xs justify-between">
                  <span className="text-gray-500">Discount</span>
                  <span className="font-medium text-green-700">−{money(order.discount)}</span>
                </div>
              ) : null}
              {Number(order.tax_total) > 0 ? (
                <div className="flex w-full max-w-xs justify-between">
                  <span className="text-gray-500">Tax</span>
                  <span className="font-medium">{money(order.tax_total)}</span>
                </div>
              ) : null}
              <div className="flex w-full max-w-xs justify-between">
                <span className="text-gray-500">Shipping</span>
                <span className="font-medium text-green-700">
                  {Number(order.shipping_charge) > 0 ? money(order.shipping_charge) : "Free"}
                </span>
              </div>
              <div className="mt-2 flex w-full max-w-xs justify-between border-t pt-2 text-lg">
                <span className="font-bold text-gray-900">Grand total</span>
                <span className="font-bold">{money(order.grand_total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold">Status history</h3>
            {!history.length ? (
              <p className="text-sm text-gray-500">No status changes recorded yet.</p>
            ) : (
              <ol className="space-y-3">
                {history.map((row) => (
                  <li key={row.id} className="border-l-2 border-gray-200 pl-3">
                    <p className="text-sm font-medium text-gray-900">
                      {ORDER_STATUS_LABEL[row.status as keyof typeof ORDER_STATUS_LABEL] ||
                        row.status}
                    </p>
                    {row.notes ? <p className="text-xs text-gray-600">{row.notes}</p> : null}
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(row.created_at).toLocaleString("en-IN")}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="mb-4 border-b pb-2 font-semibold">Customer & shipping</h3>
            <div className="space-y-4 text-sm">
              <div>
                <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Name</span>
                <span className="font-medium text-gray-900">{addr.full_name || "—"}</span>
                {order.user_id ? (
                  <div className="mt-2">
                    <Link
                      href={`/admin/customers/${order.user_id}`}
                      className="text-xs font-medium text-gray-700 underline underline-offset-2"
                    >
                      Open customer CRM
                    </Link>
                  </div>
                ) : normalizePhoneKey(addr.mobile_number) ? (
                  <div className="mt-2">
                    <Link
                      href={`/admin/customers/walk-in/${normalizePhoneKey(addr.mobile_number)}`}
                      className="text-xs font-medium text-gray-700 underline underline-offset-2"
                    >
                      Open walk-in CRM
                    </Link>
                  </div>
                ) : null}
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Contact
                </span>
                <span className="font-medium text-gray-900">{addr.mobile_number || "—"}</span>
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Shipping address
                </span>
                <span className="block leading-relaxed text-gray-900">
                  {addr.address_line || "—"}
                  <br />
                  {[addr.city, addr.state].filter(Boolean).join(", ")}
                  <br />
                  {addr.pin_code || ""}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="mb-4 border-b pb-2 font-semibold">Payment</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Method</span>
                <span className="font-medium capitalize">
                  {paymentMethodLabel(order.payment_method)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Status</span>
                <span
                  className={`rounded-md px-2.5 py-1 text-xs font-bold capitalize ${paymentBadgeClass(order.payment_status)}`}
                >
                  {order.payment_status}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold">{money(order.grand_total)}</span>
              </div>
            </div>
          </div>

          <OrderStatusPanel
            orderId={order.id}
            status={order.status}
            paymentStatus={order.payment_status}
            notes={order.notes}
          />
        </div>
      </div>
    </div>
  );
}
