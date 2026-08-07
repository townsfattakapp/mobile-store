import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  createDemoPaymentOrder,
  createRazorpayClient,
  getRazorpayKeyId,
  getRazorpayMode,
  toPaise,
} from "@/lib/payments/razorpay";

export const runtime = "nodejs";

/**
 * POST { orderId: string }
 * Creates a Razorpay order (or demo order) for an unpaid online checkout.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.orderId || "").trim();
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_number, grand_total, payment_method, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.payment_method !== "online") {
      return NextResponse.json(
        { error: "Order is not an online payment order" },
        { status: 400 }
      );
    }
    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "Order already paid" }, { status: 400 });
    }

    const mode = getRazorpayMode();
    const amountInr = Number(order.grand_total);

    if (mode === "demo") {
      const rpOrder = createDemoPaymentOrder(amountInr, order.order_number);
      await supabase
        .from("orders")
        .update({
          notes: `Awaiting Razorpay (demo). rp_order=${rpOrder.id}`,
        })
        .eq("id", order.id);

      return NextResponse.json({
        mode: "demo",
        keyId: getRazorpayKeyId(),
        razorpayOrderId: rpOrder.id,
        amount: rpOrder.amount,
        currency: "INR",
        orderNumber: order.order_number,
        dbOrderId: order.id,
      });
    }

    const razorpay = createRazorpayClient();
    if (!razorpay) {
      return NextResponse.json(
        { error: "Razorpay not configured" },
        { status: 500 }
      );
    }

    const rpOrder = await razorpay.orders.create({
      amount: toPaise(amountInr),
      currency: "INR",
      receipt: order.order_number.slice(0, 40),
      notes: { order_id: order.id, order_number: order.order_number },
    });

    await supabase
      .from("orders")
      .update({
        notes: `Awaiting Razorpay. rp_order=${rpOrder.id}`,
      })
      .eq("id", order.id);

    return NextResponse.json({
      mode: "live",
      keyId: getRazorpayKeyId(),
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      orderNumber: order.order_number,
      dbOrderId: order.id,
    });
  } catch (e: any) {
    console.error("razorpay create-order", e);
    return NextResponse.json(
      { error: e?.message || "Failed to create payment" },
      { status: 500 }
    );
  }
}
