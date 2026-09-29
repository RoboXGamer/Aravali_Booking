import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, httpAction, type ActionCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { PaymentDecision, PaymentSnapshot } from "./paymentState";
import { object, string, money, parsePayment, razorpayRequest, validSignature } from "./razorpay";
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
    access_token: string;
    razorpay_order_id: string;
  };
  selected_seats: PreparedCheckout["selectedSeats"];
  razorpay_order: { id: string; amount: number; currency: string };
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
    const accessToken = crypto.randomUUID() + crypto.randomUUID();
    const prepared: PreparedCheckout = await ctx.runMutation(internal.bookings.prepareCheckout, {
      ...args,
      now: Date.now(),
      accessToken,
    });
    try {
      const response = object(await razorpayRequest("/orders", {
        amount: Math.round(prepared.totalAmount * 100), currency: "INR", receipt: prepared.sessionId,
        partial_payment: false,
        notes: { checkout_session_id: prepared.sessionId, show_id: prepared.showId },
      }));
      const order = { id: string(response.id), amount: money(response.amount), currency: string(response.currency) };
      if (order.amount !== Math.round(prepared.totalAmount * 100) || order.currency !== "INR") {
        throw new Error("Razorpay order amount does not match checkout.");
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
          access_token: accessToken,
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

async function processSession(ctx: ActionCtx, sessionId: Id<"checkoutSessions">, paymentId?: string): Promise<void> {
  const workerToken = crypto.randomUUID();
  const session: Doc<"checkoutSessions"> | null = await ctx.runMutation(internal.paymentState.claim, { sessionId, workerToken });
  if (!session?.razorpayOrderId) return;
  const worker = { sessionId, workerToken };
  let failure: string | undefined;
  try {
    const response = object(await razorpayRequest(`/orders/${encodeURIComponent(session.razorpayOrderId)}/payments`));
    if (!Array.isArray(response.items)) throw new Error("Invalid Razorpay payment list.");
    const payments: PaymentSnapshot[] = response.items.map(parsePayment);
    // A just-completed payment may not yet appear in the order listing.
    if (paymentId && !payments.some(p => p.id === paymentId)) {
      payments.push(parsePayment(await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`)));
    }
    const attempts: Doc<"paymentAttempts">[] = await ctx.runQuery(internal.paymentState.attempts, { sessionId });
    for (const attempt of attempts) {
      if (!payments.some(p => p.id === attempt.paymentId)) payments.push(parsePayment(
        await razorpayRequest(`/payments/${encodeURIComponent(attempt.paymentId)}`)));
    }
    // Fulfil an already captured payment before considering another authorization.
    payments.sort((a, b) => Number(b.status === "captured") - Number(a.status === "captured"));
    for (let payment of payments) {
      let decision: PaymentDecision = await ctx.runMutation(internal.paymentState.observe, { ...worker, payment });
      if (decision.operation === "capture") {
        // A lost response remains uncertain. The durable capture lock survives until the next fetch.
        payment = parsePayment(await razorpayRequest(`/payments/${encodeURIComponent(payment.id)}/capture`, {
          amount: payment.amount, currency: payment.currency,
        }));
        decision = await ctx.runMutation(internal.paymentState.observe, { ...worker, payment });
      }
      if (decision.operation === "refund") {
        const attempt = attempts.find(p => p.paymentId === payment.id);
        if (attempt?.refundId) {
          const refund = object(await razorpayRequest(`/refunds/${encodeURIComponent(attempt.refundId)}`));
          await ctx.runMutation(internal.paymentState.recordRefund, {
            ...worker, paymentId: payment.id, refundId: string(refund.id), refundStatus: string(refund.status),
          });
          if (refund.status === "failed") continue; // requires operator review; never invent a new refund key
        } else {
          // Avoid overlapping an independently initiated dashboard refund.
          const refunds = object(await razorpayRequest(`/payments/${encodeURIComponent(payment.id)}/refunds`));
          if (!Array.isArray(refunds.items)) throw new Error("Invalid Razorpay refund list.");
          if (refunds.items.some(r => object(r).status === "pending" || object(r).status === "created")) continue;
          const refund = object(await razorpayRequest(`/payments/${encodeURIComponent(payment.id)}/refund`, {
            amount: decision.refundAmount!, speed: "normal", notes: { reason: "Booking unavailable or cancelled", checkout_session_id: sessionId },
          }, { "X-Refund-Idempotency": decision.refundKey! }));
          await ctx.runMutation(internal.paymentState.recordRefund, {
            ...worker, paymentId: payment.id, refundId: string(refund.id), refundStatus: string(refund.status),
          });
        }
        // Only the provider's current payment balance establishes completion of a full refund.
        payment = parsePayment(await razorpayRequest(`/payments/${encodeURIComponent(payment.id)}`));
        await ctx.runMutation(internal.paymentState.observe, { ...worker, payment });
      }
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : "Payment reconciliation failed.";
  } finally {
    await ctx.runMutation(internal.paymentState.finish, { ...worker, ...(failure ? { error: failure } : {}) });
  }
}

export const reconcile = internalAction({
  args: { sessionId: v.id("checkoutSessions") },
  handler: async (ctx, args): Promise<null> => { await processSession(ctx, args.sessionId); return null; },
});

export const verify = action({
  args: {
    razorpayOrderId: v.string(), razorpayPaymentId: v.string(), razorpaySignature: v.string(), checkoutSessionId: v.id("checkoutSessions"),
  },
  handler: async (ctx, args): Promise<{ status: "processing" }> => {
    const session: Doc<"checkoutSessions"> | null = await ctx.runQuery(internal.paymentState.read, { sessionId: args.checkoutSessionId });
    // Use our stored order ID for HMAC, never an order ID chosen by the browser.
    if (!session?.razorpayOrderId || session.razorpayOrderId !== args.razorpayOrderId || !await validSignature(
      `${session.razorpayOrderId}|${args.razorpayPaymentId}`, args.razorpaySignature, env.RAZORPAY_SECRET,
    )) throw new Error("Invalid Razorpay payment signature.");
    await processSession(ctx, session._id, args.razorpayPaymentId);
    return { status: "processing" };
  },
});

const webhookEvents = new Set([
  "payment.authorized", "payment.captured", "payment.failed", "order.paid",
  "refund.created", "refund.processed", "refund.failed",
]);

export const webhook = httpAction(async (ctx, request) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return new Response("Webhook not configured", { status: 503 });
  const raw = await request.text();
  if (raw.length > 256_000) return new Response("Payload too large", { status: 413 });
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const valid = await validSignature(raw, signature, env.RAZORPAY_WEBHOOK_SECRET)
    || (!!env.RAZORPAY_WEBHOOK_PREVIOUS_SECRET && await validSignature(raw, signature, env.RAZORPAY_WEBHOOK_PREVIOUS_SECRET));
  if (!valid) return new Response("Invalid signature", { status: 400 });
  try {
    const event = object(JSON.parse(raw) as unknown);
    const eventType = string(event.event);
    if (!webhookEvents.has(eventType)) return new Response("Ignored", { status: 200 });
    const eventId = request.headers.get("x-razorpay-event-id");
    if (!eventId || eventId.length > 200) return new Response("Missing event ID", { status: 400 });
    const payload = object(event.payload);
    let orderId: string;
    if (payload.payment) orderId = string(object(object(payload.payment).entity).order_id);
    else if (payload.order) orderId = string(object(object(payload.order).entity).id);
    else {
      const refund = object(object(payload.refund).entity);
      const payment = parsePayment(await razorpayRequest(`/payments/${encodeURIComponent(string(refund.payment_id))}`));
      orderId = payment.orderId;
    }
    await ctx.runMutation(internal.paymentState.receiveWebhook, { eventId, eventType, orderId });
    return new Response("Accepted", { status: 200 });
  } catch {
    // Non-2xx makes Razorpay retry; acknowledge only after durable persistence.
    return new Response("Unable to persist event", { status: 503 });
  }
});

