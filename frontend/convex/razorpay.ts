import { env } from "./_generated/server";
import type { PaymentSnapshot } from "./paymentState";

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Razorpay response.");
  return value as Record<string, unknown>;
}
export function string(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Missing Razorpay identifier.");
  return value;
}
export function money(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid Razorpay amount.");
  return value;
}
export function parsePayment(value: unknown): PaymentSnapshot {
  const p = object(value);
  return { id: string(p.id), orderId: string(p.order_id), amount: money(p.amount), currency: string(p.currency),
    status: string(p.status), amountRefunded: money(p.amount_refunded ?? 0) };
}
export async function razorpayRequest(path: string, body?: Record<string, unknown>, extraHeaders: Record<string, string> = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: body ? "POST" : "GET", signal: controller.signal,
      headers: { Authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_SECRET}`)}`,
        "Content-Type": "application/json", ...extraHeaders },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`Razorpay request failed (${response.status}). Payment recovery will retry.`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

export async function validSignature(message: string, signature: string, secret: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const expected = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
  return mismatch === 0;
}
