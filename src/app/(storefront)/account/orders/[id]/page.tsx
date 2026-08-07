import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { formatINR } from "@/lib/storefront/format";

type Props = { params: Promise<{ id: string }> };

export default async function AccountOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const { user, supabase } = await requireCustomer();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, payment_method, subtotal, discount, tax_total, shipping_charge, grand_total, address_snapshot, notes, created_at, order_items(id, product_name, variant_name, quantity, unit_price, total_price)"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) notFound();

  const address = (order.address_snapshot || {}) as Record<string, unknown>;
  const items = (order.order_items || []) as Array<{
    id: string;
    product_name: string;
    variant_name: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;

  return (
    <div>
      <Link
        href="/account/orders"
        className="text-sm font-medium text-[#6e6e73] underline-offset-2 hover:text-[#1d1d1f] hover:underline"
      >
        ← All orders
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-[#1d1d1f]">{order.order_number}</h2>
      <p className="mt-1 text-sm capitalize text-[#6e6e73]">
        {String(order.status).replaceAll("_", " ")} ·{" "}
        {new Date(order.created_at).toLocaleString("en-IN")}
      </p>

      <ul className="mt-6 divide-y divide-[#17151f]/08 rounded-2xl border border-[#17151f]/10 bg-white">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div>
              <p className="font-medium text-[#1d1d1f]">{item.product_name}</p>
              {item.variant_name ? (
                <p className="text-xs text-[#6e6e73]">{item.variant_name}</p>
              ) : null}
              <p className="text-xs text-[#6e6e73]">Qty {item.quantity}</p>
            </div>
            <p className="shrink-0 font-medium">{formatINR(Number(item.total_price))}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between text-[#6e6e73]">
          <span>Subtotal</span>
          <span>{formatINR(Number(order.subtotal))}</span>
        </div>
        {Number(order.discount) > 0 ? (
          <div className="flex justify-between text-[#6e6e73]">
            <span>Discount</span>
            <span>−{formatINR(Number(order.discount))}</span>
          </div>
        ) : null}
        {Number(order.shipping_charge) > 0 ? (
          <div className="flex justify-between text-[#6e6e73]">
            <span>Shipping</span>
            <span>{formatINR(Number(order.shipping_charge))}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-[#17151f]/10 pt-2 text-base font-semibold text-[#1d1d1f]">
          <span>Total</span>
          <span>{formatINR(Number(order.grand_total))}</span>
        </div>
      </div>

      {address && Object.keys(address).length > 0 ? (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-[#1d1d1f]">Delivery / billing</h3>
          <p className="mt-2 whitespace-pre-line text-sm text-[#424245]">
            {[
              address.full_name,
              address.mobile_number || address.phone,
              address.address_line || address.line1,
              address.landmark,
              [address.city, address.state, address.pin_code || address.pincode]
                .filter(Boolean)
                .join(", "),
            ]
              .filter(Boolean)
              .join("\n")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
