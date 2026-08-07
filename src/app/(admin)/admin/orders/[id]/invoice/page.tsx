"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

/** Legacy route — redirect to GST invoice system */
export default function LegacyOrderInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: orderId } = use(params);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("invoices")
        .select("id")
        .eq("order_id", orderId)
        .neq("status", "cancelled")
        .maybeSingle();

      if (data?.id) {
        router.replace(`/admin/invoices/${data.id}`);
      } else {
        router.replace(`/admin/invoices/new?orderId=${orderId}`);
      }
    })();
  }, [orderId, router]);

  return <div className="p-8 text-center text-[#6e6e73]">Opening invoice...</div>;
}
