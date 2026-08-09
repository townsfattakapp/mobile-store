import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  getRazorpayMode,
  signDemoPayment,
  verifyRazorpaySignature,
} from "@/lib/payments/razorpay";
import { notifyOwnerOfOrderById } from "@/lib/notify/notifyOwner";

export const runtime = "nodejs";

/**
 * POST {
 *   dbOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature
 * }
 * Or demo: { dbOrderId, razorpayOrderId, demo: true }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dbOrderId = String(body.dbOrderId || "").trim();
    const razorpayOrderId = String(body.razorpayOrderId || "").trim();
    let paymentId = String(body.razorpayPaymentId || "").trim();
    let signature = String(body.razorpaySignature || "").trim();
    const isDemo = Boolean(body.demo) || getRazorpayMode() === "demo";

    if (!dbOrderId || !razorpayOrderId) {
      return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });
    }

    if (isDemo && (!paymentId || !signature)) {
      paymentId = `pay_demo_${Date.now().toString(36)}`;
      signature = signDemoPayment(razorpayOrderId, paymentId);
    }

    if (!verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId,
      signature,
    })) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_number, payment_status, payment_method")
      .eq("id", dbOrderId)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        orderNumber: order.order_number,
        alreadyPaid: true,
      });
    }

    const { error: upErr } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "confirmed",
        notes: `Paid via Razorpay${isDemo ? " (demo)" : ""}. payment_id=${paymentId}`,
      })
      .eq("id", dbOrderId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Second owner ping when online payment succeeds
    await notifyOwnerOfOrderById(dbOrderId, "payment_confirmed");

    return NextResponse.json({
      success: true,
      orderNumber: order.order_number,
      paymentId,
      mode: isDemo ? "demo" : "live",
    });
  } catch (e: any) {
    console.error("razorpay verify", e);
    return NextResponse.json(
      { error: e?.message || "Verification failed" },
      { status: 500 }
    );
  }
}
