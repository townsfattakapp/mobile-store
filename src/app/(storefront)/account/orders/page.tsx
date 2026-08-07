import Link from "next/link";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { formatINR } from "@/lib/storefront/format";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  ready_for_pickup: "Ready for pickup",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  refunded: "Refunded",
};

export default async function AccountOrdersPage() {
  const { user, supabase } = await requireCustomer();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, payment_method, grand_total, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1d1d1f]">Orders</h2>
      <p className="mt-1 mb-6 text-sm text-[#6e6e73]">
        Online and store orders linked to this account.
      </p>

      {!orders?.length ? (
        <div className="rounded-2xl border border-dashed border-[#17151f]/15 bg-white/60 px-6 py-12 text-center">
          <p className="text-sm text-[#424245]">No orders yet.</p>
          <Link
            href="/new-mobiles"
            className="mt-4 inline-block text-sm font-semibold text-[#1d1d1f] underline-offset-2 hover:underline"
          >
            Browse mobiles
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[#17151f]/08 overflow-hidden rounded-2xl border border-[#17151f]/10 bg-white">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/account/orders/${order.id}`}
                className="flex flex-col gap-1 px-4 py-4 transition-colors hover:bg-[#fbf8f3] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-[#1d1d1f]">{order.order_number}</p>
                  <p className="text-xs text-[#6e6e73]">
                    {new Date(order.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" · "}
                    {STATUS_LABEL[order.status] || order.status}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold text-[#1d1d1f]">{formatINR(Number(order.grand_total))}</p>
                  <p className="text-xs capitalize text-[#6e6e73]">
                    {String(order.payment_method).replace("_", " ")} · {order.payment_status}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
