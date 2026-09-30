import { hashAccessToken } from "./ticketAccess";
import { v } from "convex/values";
import { seatConflict, releaseSeatHolds } from "./seatAvailability";
import { internal } from "./_generated/api";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { auditoriumDate, ensureSettings, getSettings, moviePosterUrl, requireAdmin, roundMoney } from "./lib";

const bookingCategory = v.union(
  v.literal("Gold"),
  v.literal("Silver (JCO)"),
  v.literal("Silver (OR)"),
);
type BookingCategory = "Gold" | "Silver (JCO)" | "Silver (OR)";
const ticketCategories = [
  { id: "Gold", seatCategory: "Gold", price: 120 },
  { id: "Silver (JCO)", seatCategory: "Silver", price: 100 },
  { id: "Silver (OR)", seatCategory: "Silver", price: 80 },
] as const satisfies ReadonlyArray<{
  id: BookingCategory;
  seatCategory: Doc<"seats">["categoryName"];
  price: number;
}>;

const checkoutArgs = {
  showId: v.id("shows"),
  seatIds: v.array(v.id("seats")),
  bookingCategory,
};

interface BookingRequest {
  showId: Id<"shows">;
  seatIds: Id<"seats">[];
  bookingCategory: BookingCategory;
}

async function validateBookingRequest(
  ctx: MutationCtx,
  args: BookingRequest,
  now: number,
  maximumSeats: number,
) {
  const show = await ctx.db.get("shows", args.showId);
  if (!show?.isEnabled) throw new Error("Show not found or no longer enabled.");
  if (show.date < auditoriumDate(now)) {
    throw new Error("Booking has closed because the show date has ended.");
  }

  const uniqueSeatIds = [...new Set(args.seatIds)];
  if (!uniqueSeatIds.length) throw new Error("Select at least one seat.");
  if (uniqueSeatIds.length !== args.seatIds.length) throw new Error("The same seat cannot be selected twice.");
  if (uniqueSeatIds.length > Math.min(maximumSeats, 100)) {
    throw new Error(`You can select up to ${maximumSeats} seats.`);
  }

  const selectedSeats: Doc<"seats">[] = [];
  const selectedTicketCategory = ticketCategories.find((category) => category.id === args.bookingCategory);
  if (!selectedTicketCategory) throw new Error("Select a valid ticket category.");

  for (const seatId of uniqueSeatIds) {
    const seat = await ctx.db.get("seats", seatId);
    if (!seat?.isVisible || seat.status !== "active") throw new Error("One or more selected seats are unavailable.");
    if (seat.categoryName !== selectedTicketCategory.seatCategory) {
      throw new Error(`${seat.seatNumber} is not available for ${selectedTicketCategory.id}.`);
    }

    const conflict = await seatConflict(ctx, args.showId, seatId, now);
    if (conflict) throw new Error(conflict);

    selectedSeats.push(seat);
  }

  return {
    show,
    selectedSeats,
    selectedTicketCategory,
  };
}

export const getBookingSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await getSettings(ctx);
    const source = settings ?? {
      maxSeatsPerBooking: 6,
      seatHoldMinutes: 10,
    };
    return {
      max_seats_per_booking: source.maxSeatsPerBooking,
      seat_hold_minutes: source.seatHoldMinutes,
      ticket_categories: ticketCategories.map((category) => ({
        id: category.id,
        seat_category: category.seatCategory,
        price: category.price,
      })),
    };
  },
});

export const getAvailability = query({
  args: { showId: v.id("shows"), today: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show?.isEnabled || (args.today && show.date < args.today)) return null;
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_rowIndex_and_colIndex")
      .take(1000);
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .take(1000);
    const reservationIds = new Set(reservations.map((row) => row.seatId));

    const bookedRows = ctx.db
      .query("bookingSeats")
      .withIndex("by_showId_and_seatId", (q) => q.eq("showId", args.showId));
    const bookedIds = new Set<string>();
    for await (const row of bookedRows) {
      const booking = await ctx.db.get("bookings", row.bookingId);
      if (booking?.status === "confirmed") bookedIds.add(row.seatId);
    }

    const heldRows = ctx.db
      .query("checkoutSessionSeats")
      .withIndex("by_showId_and_seatId", (q) => q.eq("showId", args.showId));
    const heldIds = new Set<string>();
    for await (const row of heldRows) {
      const session = await ctx.db.get("checkoutSessions", row.checkoutSessionId);
      if (session?.status === "pending" || session?.status === "capturing") heldIds.add(row.seatId);
    }

    const visibleSeats = seats.filter((seat) => seat.isVisible).map((seat) => ({
      id: seat._id,
      section_name: seat.sectionName,
      row_prefix: seat.rowPrefix,
      row_index: seat.rowIndex,
      col_index: seat.colIndex,
      seat_number: seat.seatNumber,
      category_name: seat.categoryName,
      price: seat.price,
      status: seat.status,
      is_visible: seat.isVisible,
      availability: seat.status === "disabled"
        ? "disabled" as const
        : bookedIds.has(seat._id)
          ? "booked" as const
          : reservationIds.has(seat._id)
            ? "reserved" as const
            : heldIds.has(seat._id)
              ? "held" as const
              : "available" as const,
    }));

    return {
      show_id: args.showId,
      seats: visibleSeats,
      booked_seat_layout_ids: [...bookedIds, ...heldIds],
      reserved_seat_layout_ids: [...reservationIds],
    };
  },
});

export const prepareCheckout = internalMutation({
  args: { ...checkoutArgs, now: v.number(), accessToken: v.string() },
  handler: async (ctx, args) => {
    const settings = await ensureSettings(ctx);
    const { selectedSeats, selectedTicketCategory } =
      await validateBookingRequest(ctx, args, args.now, settings.maxSeatsPerBooking);

    const subtotal = roundMoney(selectedSeats.length * selectedTicketCategory.price);
    const total = subtotal;
    const expiresAt = args.now + settings.seatHoldMinutes * 60_000;
    if (!Number.isSafeInteger(Math.round(total * 100)) || total <= 0 || !Number.isFinite(expiresAt) || expiresAt <= args.now) {
      throw new Error("Booking settings are invalid. Please contact the auditorium.");
    }
    const sessionId = await ctx.db.insert("checkoutSessions", {
      showId: args.showId,
      subtotal,
      totalAmount: total,
      status: "pending",
      expiresAt,
      accessTokenHash: await hashAccessToken(args.accessToken),
      reconciliationVersion: 1,
    });
    for (const seat of selectedSeats) {
      await ctx.db.insert("checkoutItems", {
        checkoutSessionId: sessionId,
        seatId: seat._id,
        seatNumber: seat.seatNumber,
        categoryName: seat.categoryName,
        price: selectedTicketCategory.price,
      });
      await ctx.db.insert("checkoutSessionSeats", {
        checkoutSessionId: sessionId,
        showId: args.showId,
        seatId: seat._id,
      });
    }
    return {
      sessionId,
      showId: args.showId,
      subtotal,
      totalAmount: total,
      expiresAt,
      selectedSeats: selectedSeats.map((seat) => ({
        id: seat._id,
        section_name: seat.sectionName,
        row_prefix: seat.rowPrefix,
        row_index: seat.rowIndex,
        col_index: seat.colIndex,
        seat_number: seat.seatNumber,
        category_name: seat.categoryName,
        price: selectedTicketCategory.price,
        status: seat.status,
        is_visible: seat.isVisible,
        availability: "held" as const,
      })),
    };
  },
});

export const createAdminBooking = mutation({
  args: {
    ...checkoutArgs,
    accessToken: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const settings = await ensureSettings(ctx);
    const { show, selectedSeats, selectedTicketCategory } =
      await validateBookingRequest(ctx, args, now, settings.maxSeatsPerBooking);
    const subtotal = roundMoney(selectedSeats.length * selectedTicketCategory.price);

    const checkoutSessionId = await ctx.db.insert("checkoutSessions", {
      showId: args.showId,
      subtotal,
      totalAmount: subtotal,
      accessTokenHash: await hashAccessToken(args.accessToken),
      status: "paid",
      expiresAt: now,
      reconciliationVersion: 1,
    });
    const bookingCode = `ARA${new Date(now).getUTCFullYear()}${checkoutSessionId.toUpperCase()}`;
    const bookingId = await ctx.db.insert("bookings", {
      bookingCode,
      accessTokenHash: await hashAccessToken(args.accessToken),
      showId: args.showId,
      checkoutSessionId,
      subtotal,
      totalAmount: subtotal,
      status: "confirmed",
      isCheckedIn: false,
      checkedInAt: null,
      createdAt: now,
    });

    for (const seat of selectedSeats) {
      await ctx.db.insert("bookingSeats", {
        bookingId,
        showId: args.showId,
        seatId: seat._id,
        seatNumber: seat.seatNumber,
        categoryName: seat.categoryName,
        price: selectedTicketCategory.price,
      });
    }
    await ctx.db.patch("shows", show._id, {
      soldSeats: (show.soldSeats ?? 0) + selectedSeats.length,
    });

    return {
      bookingCode,
    };
  },
});

export const attachRazorpayOrder = internalMutation({
  args: {
    sessionId: v.id("checkoutSessions"),
    orderId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get("checkoutSessions", args.sessionId);
    if (!session || session.status !== "pending") throw new Error("Checkout session is no longer active.");
    if (session.razorpayOrderId) {
      if (session.razorpayOrderId !== args.orderId) throw new Error("Checkout already has an order.");
      return null;
    }
    await ctx.db.patch("checkoutSessions", args.sessionId, {
      razorpayOrderId: args.orderId,
      nextReconcileAt: Date.now() + 30_000,
      reconcileUntil: Date.now() + 4 * 24 * 60 * 60_000,
    });
    await ctx.db.insert("payments", {
      checkoutSessionId: args.sessionId,
      providerOrderId: args.orderId,
      amount: args.amount,
      status: "created",
    });
    await ctx.scheduler.runAfter(30_000, internal.payments.reconcile, { sessionId: args.sessionId });
    return null;
  },
});

export const releaseCheckout = internalMutation({
  args: { sessionId: v.id("checkoutSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get("checkoutSessions", args.sessionId);
    if (session?.status === "pending") {
      await ctx.db.patch("checkoutSessions", args.sessionId, { status: "failed" });
      await releaseSeatHolds(ctx, args.sessionId);
    }
    return null;
  },
});

export const getByCode = query({
  args: { bookingCode: v.string(), accessToken: v.string() },
  handler: async (ctx, args) => {
    if (!/^[a-f0-9-]{72}$/.test(args.accessToken)) return null;
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_bookingCode", (q) => q.eq("bookingCode", args.bookingCode.trim().toUpperCase()))
      .unique();
    if (!booking || booking.status !== "confirmed" || booking.accessTokenHash !== await hashAccessToken(args.accessToken)) return null;
    const show = await ctx.db.get("shows", booking.showId);
    const movie = show ? await ctx.db.get("movies", show.movieId) : null;
    if (!show || !movie) return null;
    const bookingSeats = await ctx.db
      .query("bookingSeats")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking._id))
      .take(100);
    return {
      id: booking._id,
      booking_code: booking.bookingCode,
      subtotal: booking.subtotal,
      total_amount: booking.totalAmount,
      status: booking.status,
      created_at: new Date(booking.createdAt).toISOString(),
      shows: {
        id: show._id,
        date: show.date,
        time: show.time,
        movies: { title: movie.title, poster_url: await moviePosterUrl(ctx, movie) },
      },
      booking_seats: bookingSeats.map((seat) => ({
        id: seat._id,
        seat_number: seat.seatNumber,
        category_name: seat.categoryName,
        price: seat.price,
      })),
    };
  },
});

export const getTicketData = internalQuery({
  args: { bookingCode: v.string(), accessToken: v.string() },
  handler: async (ctx, args) => {
    if (!/^[a-f0-9-]{72}$/.test(args.accessToken)) return null;
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_bookingCode", (q) => q.eq("bookingCode", args.bookingCode.trim().toUpperCase()))
      .unique();
    if (!booking || booking.accessTokenHash !== await hashAccessToken(args.accessToken) || booking.status !== "confirmed") return null;
    const show = await ctx.db.get("shows", booking.showId);
    const movie = show ? await ctx.db.get("movies", show.movieId) : null;
    if (!show || !movie) return null;
    const seats = await ctx.db.query("bookingSeats")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking._id)).take(100);
    return {
      bookingCode: booking.bookingCode,
      totalAmount: booking.totalAmount,
      movieTitle: movie.title,
      posterUrl: await moviePosterUrl(ctx, movie),
      date: show.date,
      time: show.time,
      seats: seats.map((seat) => seat.seatNumber),
    };
  },
});
