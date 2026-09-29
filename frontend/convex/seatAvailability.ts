import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// All writers use this check in the same transaction as acquiring the seat.
// Scan the complete history: an arbitrary .take(10) can hide a newer sale.
export async function seatConflict(
  ctx: MutationCtx | QueryCtx,
  showId: Id<"shows">,
  seatId: Id<"seats">,
  now: number,
  ownSession?: Id<"checkoutSessions">,
  ownBooking?: Id<"bookings">,
): Promise<string | null> {
  const seat = await ctx.db.get("seats", seatId);
  if (!seat?.isVisible || seat.status !== "active") return "Seat is unavailable.";
  const reserved = await ctx.db.query("reservations")
    .withIndex("by_showId_and_seatId", q => q.eq("showId", showId).eq("seatId", seatId)).first();
  if (reserved) return `${seat.seatNumber} is reserved.`;
  for await (const row of ctx.db.query("bookingSeats")
    .withIndex("by_showId_and_seatId", q => q.eq("showId", showId).eq("seatId", seatId))) {
    if (row.bookingId !== ownBooking && (await ctx.db.get("bookings", row.bookingId))?.status === "confirmed") {
      return `${seat.seatNumber} is already booked.`;
    }
  }
  for await (const row of ctx.db.query("checkoutSessionSeats")
    .withIndex("by_showId_and_seatId", q => q.eq("showId", showId).eq("seatId", seatId))) {
    if (row.checkoutSessionId === ownSession) continue;
    const session = await ctx.db.get("checkoutSessions", row.checkoutSessionId);
    if (session && (session.status === "capturing" || (session.status === "pending" && session.expiresAt > now))) {
      return `${seat.seatNumber} is held by another customer.`;
    }
  }
  return null;
}

export async function releaseSeatHolds(ctx: MutationCtx, sessionId: Id<"checkoutSessions">) {
  for await (const row of ctx.db.query("checkoutSessionSeats")
    .withIndex("by_checkoutSessionId", q => q.eq("checkoutSessionId", sessionId))) {
    await ctx.db.delete("checkoutSessionSeats", row._id);
  }
}
