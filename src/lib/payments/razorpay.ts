import crypto from "crypto";
import Razorpay from "razorpay";

export type RazorpayMode = "live" | "demo";

export function getRazorpayMode(): RazorpayMode {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (keyId && secret) return "live";
  return "demo";
}

export function getRazorpayKeyId(): string {
  if (getRazorpayMode() === "live") {
    return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
  }
  return "rzp_test_demo_mobistore";
}

function getSecret(): string {
  if (getRazorpayMode() === "live") {
    return process.env.RAZORPAY_KEY_SECRET || "";
  }
  return process.env.RAZORPAY_DEMO_SECRET || "mobistore_demo_secret";
}

export function createRazorpayClient(): Razorpay | null {
  if (getRazorpayMode() !== "live") return null;
  return new Razorpay({
    key_id: getRazorpayKeyId(),
    key_secret: getSecret(),
  });
}

/** Amount in paise for Razorpay */
export function toPaise(inr: number): number {
  return Math.round(Number(inr) * 100);
}

export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const body = `${params.orderId}|${params.paymentId}`;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(params.signature)
    );
  } catch {
    return false;
  }
}

/** Demo-mode order id + signature (no network). */
export function createDemoPaymentOrder(amountInr: number, receipt: string) {
  const orderId = `order_demo_${receipt.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}_${Date.now().toString(36)}`;
  return {
    id: orderId,
    amount: toPaise(amountInr),
    currency: "INR",
    receipt,
    status: "created" as const,
  };
}

export function signDemoPayment(orderId: string, paymentId: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}
