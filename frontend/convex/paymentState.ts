import { hashAccessToken } from "./ticketAccess";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { auditoriumDate, requireSuperAdmin } from "./lib";
import { releaseSeatHolds, seatConflict } from "./seatAvailability";

const FOUR_DAYS = 4 * 24 * 60 * 60_000;
const credentials = { sessionId: v.id("checkoutSessions"), accessToken: v.string() };
const workerArgs = { sessionId: v.id("checkoutSessions"), workerToken: v.string() };
export const paymentFields = {
  id: v.string(), orderId: v.string(), amount: v.number(), currency: v.string(),
  status: v.string(), amountRefunded: v.number(),
};
export interface PaymentSnapshot {
  id: string; orderId: string; amount: number; currency: string;
  status: string; amountRefunded: number;
}
export interface CheckoutStatus {
  status: Doc<"checkoutSessions">["status"];
  bookingCode: string | null;
  needsAttention: boolean;
  paymentStatus: string | null;
  orderId: string | null;
}
export type PaymentDecision = { operation: "none" | "capture" | "refund"; refundKey?: string; refundAmount?: number };

async function assertAccess(session: Doc<"checkoutSessions"> | null, accessToken: string): Promise<Doc<"checkoutSessions">> {
  if (!session?.accessTokenHash || session.accessTokenHash !== await hashAccessToken(accessToken)) throw new Error("Checkout link is invalid.");
  return session;
}

async function requireWorker(ctx: MutationCtx, sessionId: Id<"checkoutSessions">, token: string) {
  const session = await ctx.db.get("checkoutSessions", sessionId);
  if (!session || session.workerToken !== token || (session.workerUntil ?? 0) <= Date.now()) {
    throw new Error("Payment processing lease expired; recovery will retry.");
  }
  return session;
}

// Preserve original seat selections independently of expiring locks (including old checkouts).
export async function preserveCheckoutItems(ctx: MutationCtx, session: Doc<"checkoutSessions">) {
  const existing = await ctx.db.query("checkoutItems")
    .withIndex("by_checkoutSessionId", q => q.eq("checkoutSessionId", session._id)).take(101);
  if (existing.length) return existing;
  const held = await ctx.db.query("checkoutSessionSeats")
    .withIndex("by_checkoutSessionId", q => q.eq("checkoutSessionId", session._id)).take(101);
  if (held.length > 100) throw new Error("Checkout exceeds seat limit.");
  for (const row of held) {
    const seat = await ctx.db.get("seats", row.seatId);
    if (!seat) continue;
    await ctx.db.insert("checkoutItems", {
      checkoutSessionId: session._id, seatId: row.seatId, seatNumber: seat.seatNumber,
      categoryName: seat.categoryName, price: Math.round(session.subtotal / held.length * 100) / 100,
    });
  }
  return await ctx.db.query("checkoutItems")
    .withIndex("by_checkoutSessionId", q => q.eq("checkoutSessionId", session._id)).take(101);
}

export async function cancelBookingRecord(ctx: MutationCtx, booking: Doc<"bookings">) {
  if (booking.status === "cancelled") return;
  const seats = await ctx.db.query("bookingSeats")
    .withIndex("by_bookingId", q => q.eq("bookingId", booking._id)).take(101);
  const show = await ctx.db.get("shows", booking.showId);
  if (show) await ctx.db.patch("shows", show._id, { soldSeats: Math.max(0, (show.soldSeats ?? 0) - seats.length) });
  await ctx.db.patch("bookings", booking._id, { status: "cancelled" });
}

export const read = internalQuery({
  args: { sessionId: v.id("checkoutSessions") },
  handler: async (ctx, args) => await ctx.db.get("checkoutSessions", args.sessionId),
});

export const status = query({
  args: { sessionId: v.string(), accessToken: v.string() },
  handler: async (ctx, args): Promise<CheckoutStatus | null> => {
    if (!/^[a-f0-9-]{72}$/.test(args.accessToken)) return null;
    const sessionId = ctx.db.normalizeId("checkoutSessions", args.sessionId);
    if (!sessionId) return null;
    const session = await ctx.db.get("checkoutSessions", sessionId);
    if (!session?.accessTokenHash || session.accessTokenHash !== await hashAccessToken(args.accessToken)) return null;
    const booking = await ctx.db.query("bookings")
      .withIndex("by_checkoutSessionId", q => q.eq("checkoutSessionId", sessionId)).unique();
    const attempts = await ctx.db.query("paymentAttempts")
      .withIndex("by_checkoutSessionId", q => q.eq("checkoutSessionId", sessionId)).order("desc").take(20);
    return {
      status: session.status,
      bookingCode: booking?.status === "confirmed" && session.status === "paid" ? booking.bookingCode : null,
      needsAttention: session.needsAttention ?? false,
      paymentStatus: attempts[0]?.providerStatus ?? null,
      orderId: session.razorpayOrderId ?? null,
    };
  },
});

export const refresh = mutation({
  args: credentials,
  handler: async (ctx, args) => {
    const session = await assertAccess(await ctx.db.get("checkoutSessions", args.sessionId), args.accessToken);
    if (!session.razorpayOrderId || Date.now() - (session.lastRefreshAt ?? 0) < 15_000) return null;
    await ctx.db.patch("checkoutSessions", session._id, { lastRefreshAt: Date.now(), nextReconcileAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.payments.reconcile, { sessionId: session._id });
    return null;
  },
});

export const claim = internalMutation({
  args: workerArgs,
  handler: async (ctx, args) => {
    const session = await ctx.db.get("checkoutSessions", args.sessionId);
    if (!session?.razorpayOrderId || (session.workerUntil ?? 0) > Date.now()) return null;
    await ctx.db.patch("checkoutSessions", session._id, {
      workerToken: args.workerToken, workerUntil: Date.now() + 120_000,
      nextReconcileAt: Date.now() + 150_000,
    });
    return session;
  },
});

export const observe = internalMutation({
  args: { ...workerArgs, payment: v.object(paymentFields) },
  handler: async (ctx, args): Promise<PaymentDecision> => {
    const session = await requireWorker(ctx, args.sessionId, args.workerToken);
    await ctx.db.patch("checkoutSessions", session._id, { workerUntil: Date.now() + 120_000 });
    const p = args.payment;
    if (p.orderId !== session.razorpayOrderId) throw new Error("Payment order mismatch.");
    const now = Date.now();
    let attempt = await ctx.db.query("paymentAttempts").withIndex("by_paymentId", q => q.eq("paymentId", p.id)).unique();
    if (attempt && attempt.checkoutSessionId !== session._id) throw new Error("Payment belongs to another checkout.");
    if (!attempt) {
      const id = await ctx.db.insert("paymentAttempts", {
        checkoutSessionId: session._id, paymentId: p.id, orderId: p.orderId,
        amount: p.amount, currency: p.currency, providerStatus: p.status,
        disposition: "pending", updatedAt: now,
      });
      attempt = (await ctx.db.get("paymentAttempts", id))!;
    }
    await ctx.db.patch("paymentAttempts", attempt._id, { providerStatus: p.status, updatedAt: now });
    if (p.amount !== Math.round(session.totalAmount * 100) || p.currency !== "INR") {
      await ctx.db.patch("paymentAttempts", attempt._id, { disposition: "review" });
      await ctx.db.patch("checkoutSessions", session._id, {
        needsAttention: true, lastError: "Payment amount or currency does not match the checkout.",
      });
      return { operation: "none" };
    }
    const booking = await ctx.db.query("bookings")
      .withIndex("by_checkoutSessionId", q => q.eq("checkoutSessionId", session._id)).unique();
    // Older confirmed bookings recorded the winning payment in the payments table.
    if (booking && !session.capturePaymentId) {
      const legacyPayment = await ctx.db.query("payments")
        .withIndex("by_providerOrderId", q => q.eq("providerOrderId", p.orderId)).unique();
      if (legacyPayment?.providerPaymentId) {
        session.capturePaymentId = legacyPayment.providerPaymentId;
        await ctx.db.patch("checkoutSessions", session._id, { capturePaymentId: session.capturePaymentId });
      } else {
        await ctx.db.patch("paymentAttempts", attempt._id, { disposition: "review" });
        await ctx.db.patch("checkoutSessions", session._id, {
          status: "review", needsAttention: true, lastError: "Existing booking has no recorded payment ID. Match it in Razorpay before making financial changes.",
        });
        return { operation: "none" };
      }
    }
    if (p.status === "refunded" || p.amountRefunded >= p.amount) {
      await ctx.db.patch("paymentAttempts", attempt._id, { disposition: "refunded", refundStatus: "processed" });
      if (!session.capturePaymentId || session.capturePaymentId === p.id) {
        if (booking) await cancelBookingRecord(ctx, booking);
        await releaseSeatHolds(ctx, session._id);
        await ctx.db.patch("checkoutSessions", session._id, { status: "refunded", needsAttention: false, lastError: undefined });
      }
      return { operation: "none" };
    }
    if (p.status !== "authorized" && p.status !== "captured") {
      if (booking?.status === "confirmed" && session.capturePaymentId === p.id && p.status === "failed") {
        await cancelBookingRecord(ctx, booking);
        await releaseSeatHolds(ctx, session._id);
        await ctx.db.patch("checkoutSessions", session._id, { status: "failed" });
      }
      // Never turn a failed attempt into a failed order: later attempts may succeed.
      if (session.status === "capturing" && session.capturePaymentId === p.id && p.status === "failed") {
        await releaseSeatHolds(ctx, session._id);
        await ctx.db.patch("checkoutSessions", session._id, { status: "expired" });
      }
      return { operation: "none" };
    }
    if (booking?.status === "confirmed" && p.status === "captured" && p.amountRefunded === 0
      && (session.status === "paid" || session.status === "review") && session.capturePaymentId === p.id) {
      await ctx.db.patch("paymentAttempts", attempt._id, { disposition: "booked" });
      await ctx.db.patch("checkoutSessions", session._id, { status: "paid", capturePaymentId: p.id });
      return { operation: "none" };
    }
    if (booking?.status === "confirmed" && p.status === "authorized" && session.capturePaymentId === p.id) {
      await ctx.db.patch("paymentAttempts", attempt._id, { disposition: "review" });
      await ctx.db.patch("checkoutSessions", session._id, {
        status: "review", needsAttention: true,
        lastError: "Legacy ticket was issued before payment capture. Review in Razorpay; check-in is blocked until capture is confirmed.",
      });
      return { operation: "none" };
    }
    const items = await preserveCheckoutItems(ctx, session);
    const ownCapture = session.status === "capturing" && session.capturePaymentId === p.id;
    let eligible = !booking && p.amountRefunded === 0 && attempt.disposition !== "refund_pending"
      && attempt.disposition !== "refunded" && (ownCapture || (session.status === "pending" && session.expiresAt > now));
    const show = await ctx.db.get("shows", session.showId);
    eligible = eligible && show !== null && show.isEnabled && show.date >= auditoriumDate(now) && items.length > 0 && items.length <= 100;
    if (eligible) {
      for (const item of items) {
        if (await seatConflict(ctx, session.showId, item.seatId, now, session._id)) { eligible = false; break; }
      }
    }
    if (eligible && p.status === "authorized") {
      // The ordinary hold timer must not release these seats during an uncertain capture.
      await ctx.db.patch("checkoutSessions", session._id, { status: "capturing", capturePaymentId: p.id });
      return { operation: "capture" };
    }
    if (eligible && p.status === "captured") {
      const bookingCode = `ARA${new Date(now).getUTCFullYear()}${session._id.toUpperCase()}`;
      const bookingId = await ctx.db.insert("bookings", {
        accessTokenHash: session.accessTokenHash!,
        bookingCode, showId: session.showId, checkoutSessionId: session._id,
        subtotal: session.subtotal, totalAmount: session.totalAmount,
        status: "confirmed", isCheckedIn: false, checkedInAt: null, createdAt: now,
      });
      for (const item of items) await ctx.db.insert("bookingSeats", {
        bookingId, showId: session.showId, seatId: item.seatId, seatNumber: item.seatNumber,
        categoryName: item.categoryName, price: item.price,
      });
      await ctx.db.patch("shows", show!._id, { soldSeats: (show!.soldSeats ?? 0) + items.length });
      await releaseSeatHolds(ctx, session._id);
      await ctx.db.patch("checkoutSessions", session._id, {
        status: "paid", capturePaymentId: p.id, needsAttention: false, lastError: undefined,
      });
      await ctx.db.patch("paymentAttempts", attempt._id, { disposition: "booked" });
      const payment = await ctx.db.query("payments").withIndex("by_providerOrderId", q => q.eq("providerOrderId", p.orderId)).unique();
      if (payment) await ctx.db.patch("payments", payment._id, { providerPaymentId: p.id, status: "paid" });
      return { operation: "none" };
    }
    if (p.status === "authorized") {
      if (session.status === "pending" || ownCapture) {
        await releaseSeatHolds(ctx, session._id);
        await ctx.db.patch("checkoutSessions", session._id, { status: "expired" });
      }
      // Razorpay reverses uncaptured funds according to the merchant capture timeout.
      return { operation: "none" };
    }
    const refundKey = attempt.refundKey ?? `booking-refund-${p.id}`;
    const refundAmount = attempt.refundAmount ?? p.amount - p.amountRefunded;
    await ctx.db.patch("paymentAttempts", attempt._id, { disposition: "refund_pending", refundKey, refundAmount });
    if (!booking || !session.capturePaymentId || session.capturePaymentId === p.id) {
      if (booking) await cancelBookingRecord(ctx, booking);
      await releaseSeatHolds(ctx, session._id);
      await ctx.db.patch("checkoutSessions", session._id, { status: "refund_pending" });
    }
    return { operation: "refund", refundKey, refundAmount };
  },
});

export const recordRefund = internalMutation({
  args: { ...workerArgs, paymentId: v.string(), refundId: v.string(), refundStatus: v.string() },
  handler: async (ctx, args) => {
    await requireWorker(ctx, args.sessionId, args.workerToken);
    const attempt = await ctx.db.query("paymentAttempts").withIndex("by_paymentId", q => q.eq("paymentId", args.paymentId)).unique();
    if (!attempt || attempt.checkoutSessionId !== args.sessionId) throw new Error("Refund payment mismatch.");
    await ctx.db.patch("paymentAttempts", attempt._id, { refundId: args.refundId, refundStatus: args.refundStatus, updatedAt: Date.now() });
    if (args.refundStatus === "failed") await ctx.db.patch("checkoutSessions", args.sessionId, {
      needsAttention: true, lastError: `Refund ${args.refundId} failed. Review in Razorpay before retrying.`,
    });
    return null;
  },
});

export const attempts = internalQuery({
  args: { sessionId: v.id("checkoutSessions") },
  handler: async (ctx, args) => await ctx.db.query("paymentAttempts")
    .withIndex("by_checkoutSessionId", q => q.eq("checkoutSessionId", args.sessionId)).take(100),
});

export const finish = internalMutation({
  args: { ...workerArgs, error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const s = await ctx.db.get("checkoutSessions", args.sessionId);
    if (!s || s.workerToken !== args.workerToken) return null;
    const attempts = await ctx.db.query("paymentAttempts")
      .withIndex("by_checkoutSessionId", q => q.eq("checkoutSessionId", s._id)).take(100);
    const unresolved = s.status === "capturing" || s.status === "refund_pending"
      || attempts.some(p => p.disposition === "refund_pending" || p.providerStatus === "authorized");
    const active = unresolved || !!args.error || Date.now() < (s.reconcileUntil ?? s._creationTime + FOUR_DAYS);
    const delay = args.error ? 60_000 : s.status === "pending" || unresolved ? 30_000 : 15 * 60_000;
    const manualReview = attempts.some(p => p.disposition === "review" || p.refundStatus === "failed");
    await ctx.db.patch("checkoutSessions", s._id, {
      workerToken: undefined, workerUntil: undefined,
      nextReconcileAt: active ? Date.now() + delay : undefined,
      ...(args.error ? { lastError: args.error.slice(0, 500), needsAttention: true }
        : manualReview ? { needsAttention: true } : { needsAttention: false, lastError: undefined }),
    });
    return null;
  },
});

export const receiveWebhook = internalMutation({
  args: { eventId: v.string(), eventType: v.string(), orderId: v.string() },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db.query("paymentWebhookEvents").withIndex("by_eventId", q => q.eq("eventId", args.eventId)).unique();
    if (duplicate) return null;
    const s = await ctx.db.query("checkoutSessions").withIndex("by_razorpayOrderId", q => q.eq("razorpayOrderId", args.orderId)).unique();
    await ctx.db.insert("paymentWebhookEvents", {
      ...args, receivedAt: Date.now(), status: s ? "queued" : "received",
      ...(s ? {} : { nextAttemptAt: Date.now() + 60_000 }),
    });
    if (s) {
      await ctx.db.patch("checkoutSessions", s._id, { nextReconcileAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.payments.reconcile, { sessionId: s._id });
    }
    return null;
  },
});

export const recovery = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Adopt active/recent legacy checkouts in bounded batches. Historical cancelled
    // bookings are not automatically refunded during deployment.
    const legacy = await ctx.db.query("checkoutSessions")
      .withIndex("by_reconciliationVersion", q => q.eq("reconciliationVersion", undefined)).take(25);
    for (const s of legacy) {
      await preserveCheckoutItems(ctx, s);
      const recover = s.razorpayOrderId && s.status !== "paid" && s._creationTime > now - FOUR_DAYS;
      await ctx.db.patch("checkoutSessions", s._id, {
        reconciliationVersion: 1,
        ...(recover ? { nextReconcileAt: now, reconcileUntil: s._creationTime + FOUR_DAYS } : {}),
      });
    }
    const sessions = await ctx.db.query("checkoutSessions")
      .withIndex("by_nextReconcileAt", q => q.gt("nextReconcileAt", 0).lte("nextReconcileAt", now)).take(50);
    for (const s of sessions) {
      await ctx.db.patch("checkoutSessions", s._id, { nextReconcileAt: now + 180_000 });
      await ctx.scheduler.runAfter(0, internal.payments.reconcile, { sessionId: s._id });
    }
    const events = await ctx.db.query("paymentWebhookEvents")
      .withIndex("by_nextAttemptAt", q => q.gt("nextAttemptAt", 0).lte("nextAttemptAt", now)).take(50);
    for (const event of events) {
      const s = await ctx.db.query("checkoutSessions").withIndex("by_razorpayOrderId", q => q.eq("razorpayOrderId", event.orderId)).unique();
      if (s) {
        await ctx.scheduler.runAfter(0, internal.payments.reconcile, { sessionId: s._id });
        await ctx.db.patch("paymentWebhookEvents", event._id, { status: "queued", nextAttemptAt: undefined });
      } else await ctx.db.patch("paymentWebhookEvents", event._id, {
        status: now - event.receivedAt > FOUR_DAYS ? "unmatched" : "received",
        nextAttemptAt: now - event.receivedAt > FOUR_DAYS ? undefined : now + 15 * 60_000,
      });
    }
    return null;
  },
});

export const attention = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const sessions = await ctx.db.query("checkoutSessions").withIndex("by_needsAttention", q => q.eq("needsAttention", true)).take(100);
    const unmatched = await ctx.db.query("paymentWebhookEvents").filter(q => q.eq(q.field("status"), "unmatched")).take(25);
    return { sessions: sessions.map(s => ({ id: s._id, orderId: s.razorpayOrderId, status: s.status, error: s.lastError })),
      unmatched: unmatched.map(e => ({ id: e._id, orderId: e.orderId, eventType: e.eventType })) };
  },
});

export const retry = mutation({
  args: { sessionId: v.id("checkoutSessions") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.scheduler.runAfter(0, internal.payments.reconcile, args);
    return null;
  },
});
