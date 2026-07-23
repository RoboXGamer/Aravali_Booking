import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { env } from "./_generated/server";

interface PreparedCheckout {
  sessionId: Id<"checkoutSessions">;
  showId: Id<"shows">;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  subtotal: number;
  paymentFee: number;
  totalAmount: number;
  expiresAt: number;
  selectedSeats: Array<{
    id: Id<"seats">;
    section_name: string;
    row_prefix: string;
    row_index: number;
    col_index: number;
    seat_number: string;
    category_name: "Gold" | "Silver";
    price: number;
    status: "active" | "disabled";
    is_visible: boolean;
    availability: "held";
  }>;
}

interface CheckoutResult {
  checkout_session: {
    id: Id<"checkoutSessions">;
    show_id: Id<"shows">;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    subtotal: number;
    payment_fee: number;
    total_amount: number;
    expires_at: string;
    razorpay_order_id: string;
  };
  selected_seats: PreparedCheckout["selectedSeats"];
  razorpay_order: { id: string; amount: number; currency: string };
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isValidSignature(orderId: string, paymentId: string, signature: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.RAZORPAY_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${orderId}|${paymentId}`));
  const expected = toHex(digest);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return mismatch === 0;
}

export const createCheckout = action({
  args: {
    showId: v.id("shows"),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.union(v.string(), v.null()),
    seatIds: v.array(v.id("seats")),
    bookingCategory: v.union(
      v.literal("Gold"),
      v.literal("Silver (JCO)"),
      v.literal("Silver (OR)"),
    ),
  },
  handler: async (ctx, args): Promise<CheckoutResult> => {
    const prepared: PreparedCheckout = await ctx.runMutation(internal.bookings.prepareCheckout, {
      ...args,
      now: Date.now(),
    });
    try {
      const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_SECRET}`);
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(prepared.totalAmount * 100),
          currency: "INR",
          receipt: prepared.sessionId,
          notes: {
            checkout_session_id: prepared.sessionId,
            show_id: prepared.showId,
          },
        }),
      });
      if (!response.ok) throw new Error(`Razorpay rejected the order (${response.status}).`);
      const order = await response.json() as { id?: unknown; amount?: unknown; currency?: unknown };
      if (typeof order.id !== "string" || typeof order.amount !== "number" || typeof order.currency !== "string") {
        throw new Error("Razorpay returned an invalid order.");
      }
      await ctx.runMutation(internal.bookings.attachRazorpayOrder, {
        sessionId: prepared.sessionId,
        orderId: order.id,
        amount: prepared.totalAmount,
      });
      return {
        checkout_session: {
          id: prepared.sessionId,
          show_id: prepared.showId,
          customer_name: prepared.customerName,
          customer_email: prepared.customerEmail,
          customer_phone: prepared.customerPhone,
          subtotal: prepared.subtotal,
          payment_fee: prepared.paymentFee,
          total_amount: prepared.totalAmount,
          expires_at: new Date(prepared.expiresAt).toISOString(),
          razorpay_order_id: order.id,
        },
        selected_seats: prepared.selectedSeats,
        razorpay_order: { id: order.id, amount: order.amount, currency: order.currency },
      };
    } catch (error) {
      await ctx.runMutation(internal.bookings.releaseCheckout, { sessionId: prepared.sessionId });
      throw error;
    }
  },
});

export const verify = action({
  args: {
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.string(),
    checkoutSessionId: v.id("checkoutSessions"),
  },
  handler: async (ctx, args): Promise<{
    status: "success";
    booking_id: Id<"bookings">;
    booking_code: string;
    customer_email: string;
  }> => {
    if (!await isValidSignature(args.razorpayOrderId, args.razorpayPaymentId, args.razorpaySignature)) {
      throw new Error("Invalid Razorpay payment signature.");
    }
    const finalized: { bookingId: Id<"bookings">; bookingCode: string; email: string } = await ctx.runMutation(internal.bookings.finalizePaidCheckout, {
      orderId: args.razorpayOrderId,
      paymentId: args.razorpayPaymentId,
      signature: args.razorpaySignature,
      checkoutSessionId: args.checkoutSessionId,
      now: Date.now(),
    });
    return {
      status: "success" as const,
      booking_id: finalized.bookingId,
      booking_code: finalized.bookingCode,
      customer_email: finalized.email,
    };
  },
});
