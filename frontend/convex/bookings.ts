import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { ensureSettings, getSettings, moviePosterUrl, normalizeEmail, requireAdmin, roundMoney } from "./lib";

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
  customerName: v.string(),
  customerEmail: v.string(),
  customerPhone: v.union(v.string(), v.null()),
  seatIds: v.array(v.id("seats")),
  bookingCategory,
};

interface BookingRequest {
  showId: Id<"shows">;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
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

  const uniqueSeatIds = [...new Set(args.seatIds)];
  if (!uniqueSeatIds.length) throw new Error("Select at least one seat.");
  if (uniqueSeatIds.length !== args.seatIds.length) throw new Error("The same seat cannot be selected twice.");
  if (uniqueSeatIds.length > maximumSeats) {
    throw new Error(`You can select up to ${maximumSeats} seats.`);
  }

  const customerName = args.customerName.trim();
  if (customerName.length < 2) throw new Error("Enter the customer's full name.");
  const customerEmail = normalizeEmail(args.customerEmail);
  const selectedSeats: Doc<"seats">[] = [];
  const selectedTicketCategory = ticketCategories.find((category) => category.id === args.bookingCategory);
  if (!selectedTicketCategory) throw new Error("Select a valid ticket category.");

  for (const seatId of uniqueSeatIds) {
    const seat = await ctx.db.get("seats", seatId);
    if (!seat?.isVisible || seat.status !== "active") throw new Error("One or more selected seats are unavailable.");
    if (seat.categoryName !== selectedTicketCategory.seatCategory) {
      throw new Error(`${seat.seatNumber} is not available for ${selectedTicketCategory.id}.`);
    }

    const reservation = await ctx.db
      .query("reservations")
      .withIndex("by_showId_and_seatId", (q) => q.eq("showId", args.showId).eq("seatId", seatId))
      .unique();
    if (reservation) throw new Error(`${seat.seatNumber} is reserved.`);

    const booked = await ctx.db
      .query("bookingSeats")
      .withIndex("by_showId_and_seatId", (q) => q.eq("showId", args.showId).eq("seatId", seatId))
      .take(10);
    for (const row of booked) {
      const booking = await ctx.db.get("bookings", row.bookingId);
      if (booking?.status === "confirmed") throw new Error(`${seat.seatNumber} is already booked.`);
    }

    const holds = await ctx.db
      .query("checkoutSessionSeats")
      .withIndex("by_showId_and_seatId", (q) => q.eq("showId", args.showId).eq("seatId", seatId))
      .take(10);
    for (const hold of holds) {
      const session = await ctx.db.get("checkoutSessions", hold.checkoutSessionId);
      if (session?.status === "pending" && session.expiresAt > now) {
        throw new Error(`${seat.seatNumber} is currently held by another customer.`);
      }
    }

    selectedSeats.push(seat);
  }

  return {
    show,
    customerName,
    customerEmail,
    customerPhone: args.customerPhone?.trim() || null,
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
      razorpayFeePercentage: 2,
    };
    return {
      max_seats_per_booking: source.maxSeatsPerBooking,
      seat_hold_minutes: source.seatHoldMinutes,
      razorpay_fee_percentage: source.razorpayFeePercentage,
      ticket_categories: ticketCategories.map((category) => ({
        id: category.id,
        seat_category: category.seatCategory,
        price: category.price,
      })),
    };
  },
});

export const getAvailability = query({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show?.isEnabled) return null;
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_rowIndex_and_colIndex")
      .take(1000);
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .take(1000);
    const reservationIds = new Set(reservations.map((row) => row.seatId));

    const bookedRows = await ctx.db
      .query("bookingSeats")
      .withIndex("by_showId_and_seatId", (q) => q.eq("showId", args.showId))
      .take(1000);
    const bookedIds = new Set<string>();
    for (const row of bookedRows) {
      const booking = await ctx.db.get("bookings", row.bookingId);
      if (booking?.status === "confirmed") bookedIds.add(row.seatId);
    }

    const heldRows = await ctx.db
      .query("checkoutSessionSeats")
      .withIndex("by_showId_and_seatId", (q) => q.eq("showId", args.showId))
      .take(1000);
    const heldIds = new Set<string>();
    for (const row of heldRows) {
      const session = await ctx.db.get("checkoutSessions", row.checkoutSessionId);
      if (session?.status === "pending") heldIds.add(row.seatId);
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
  args: { ...checkoutArgs, now: v.number() },
  handler: async (ctx, args) => {
    const settings = await ensureSettings(ctx);
    const { customerName, customerEmail, customerPhone, selectedSeats, selectedTicketCategory } =
      await validateBookingRequest(ctx, args, args.now, settings.maxSeatsPerBooking);

    const subtotal = roundMoney(selectedSeats.length * selectedTicketCategory.price);
    const paymentFee = roundMoney(subtotal * settings.razorpayFeePercentage / 100);
    const total = roundMoney(subtotal + paymentFee);
    const expiresAt = args.now + settings.seatHoldMinutes * 60_000;
    const sessionId = await ctx.db.insert("checkoutSessions", {
      showId: args.showId,
      customerName,
      customerEmail,
      customerPhone,
      subtotal,
      paymentFee,
      totalAmount: total,
      status: "pending",
      expiresAt,
    });
    for (const seat of selectedSeats) {
      await ctx.db.insert("checkoutSessionSeats", {
        checkoutSessionId: sessionId,
        showId: args.showId,
        seatId: seat._id,
      });
    }
    return {
      sessionId,
      showId: args.showId,
      customerName,
      customerEmail,
      customerPhone,
      subtotal,
      paymentFee,
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
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const settings = await ensureSettings(ctx);
    const { show, customerName, customerEmail, customerPhone, selectedSeats, selectedTicketCategory } =
      await validateBookingRequest(ctx, args, args.now, settings.maxSeatsPerBooking);
    const subtotal = roundMoney(selectedSeats.length * selectedTicketCategory.price);

    const checkoutSessionId = await ctx.db.insert("checkoutSessions", {
      showId: args.showId,
      customerName,
      customerEmail,
      customerPhone,
      subtotal,
      paymentFee: 0,
      totalAmount: subtotal,
      status: "paid",
      expiresAt: args.now,
    });
    const bookingCode = `ARA${new Date(args.now).getUTCFullYear()}${checkoutSessionId.slice(-8).toUpperCase()}`;
    const bookingId = await ctx.db.insert("bookings", {
      bookingCode,
      showId: args.showId,
      checkoutSessionId,
      customerName,
      customerEmail,
      customerPhone,
      subtotal,
      paymentFee: 0,
      totalAmount: subtotal,
      status: "confirmed",
      isCheckedIn: false,
      checkedInAt: null,
      createdAt: args.now,
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
      email: customerEmail,
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
    await ctx.db.patch("checkoutSessions", args.sessionId, { razorpayOrderId: args.orderId });
    await ctx.db.insert("payments", {
      checkoutSessionId: args.sessionId,
      providerOrderId: args.orderId,
      amount: args.amount,
      status: "created",
    });
    return null;
  },
});

export const releaseCheckout = internalMutation({
  args: { sessionId: v.id("checkoutSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get("checkoutSessions", args.sessionId);
    if (session?.status === "pending") await ctx.db.patch("checkoutSessions", args.sessionId, { status: "failed" });
    const heldSeats = await ctx.db
      .query("checkoutSessionSeats")
      .withIndex("by_checkoutSessionId", (q) => q.eq("checkoutSessionId", args.sessionId))
      .take(100);
    for (const held of heldSeats) await ctx.db.delete("checkoutSessionSeats", held._id);
    return null;
  },
});

export const finalizePaidCheckout = internalMutation({
  args: {
    orderId: v.string(),
    paymentId: v.string(),
    signature: v.string(),
    checkoutSessionId: v.id("checkoutSessions"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get("checkoutSessions", args.checkoutSessionId);
    if (!session || session.razorpayOrderId !== args.orderId) throw new Error("Payment does not match this checkout.");
    const existing = await ctx.db
      .query("bookings")
      .withIndex("by_checkoutSessionId", (q) => q.eq("checkoutSessionId", args.checkoutSessionId))
      .unique();
    if (existing) return {
      bookingId: existing._id,
      bookingCode: existing.bookingCode,
      email: existing.customerEmail,
    };
    if (session.status !== "pending") throw new Error("Checkout session is no longer active.");

    const heldSeats = await ctx.db
      .query("checkoutSessionSeats")
      .withIndex("by_checkoutSessionId", (q) => q.eq("checkoutSessionId", args.checkoutSessionId))
      .take(100);
    if (!heldSeats.length) throw new Error("No seats remain attached to this checkout.");
    const bookedSeatPrice = roundMoney(session.subtotal / heldSeats.length);
    const bookingCode = `ARA${new Date(args.now).getUTCFullYear()}${args.checkoutSessionId.slice(-8).toUpperCase()}`;
    const bookingId = await ctx.db.insert("bookings", {
      bookingCode,
      showId: session.showId,
      checkoutSessionId: session._id,
      customerName: session.customerName,
      customerEmail: session.customerEmail,
      customerPhone: session.customerPhone,
      subtotal: session.subtotal,
      paymentFee: session.paymentFee,
      totalAmount: session.totalAmount,
      status: "confirmed",
      isCheckedIn: false,
      checkedInAt: null,
      createdAt: args.now,
    });
    for (const held of heldSeats) {
      const seat = await ctx.db.get("seats", held.seatId);
      if (!seat) throw new Error("A selected seat no longer exists.");
      await ctx.db.insert("bookingSeats", {
        bookingId,
        showId: session.showId,
        seatId: seat._id,
        seatNumber: seat.seatNumber,
        categoryName: seat.categoryName,
        price: bookedSeatPrice,
      });
      await ctx.db.delete("checkoutSessionSeats", held._id);
    }
    const show = await ctx.db.get("shows", session.showId);
    if (show) {
      await ctx.db.patch("shows", show._id, {
        soldSeats: (show.soldSeats ?? 0) + heldSeats.length,
      });
    }
    await ctx.db.patch("checkoutSessions", session._id, { status: "paid" });
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_providerOrderId", (q) => q.eq("providerOrderId", args.orderId))
      .unique();
    if (payment) {
      await ctx.db.patch("payments", payment._id, {
        providerPaymentId: args.paymentId,
        providerSignature: args.signature,
        status: "paid",
      });
    }
    return { bookingId, bookingCode, email: session.customerEmail };
  },
});

export const getByCode = query({
  args: { bookingCode: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_bookingCode", (q) => q.eq("bookingCode", args.bookingCode.trim().toUpperCase()))
      .unique();
    if (!booking || booking.customerEmail !== args.email.trim().toLowerCase()) return null;
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
      customer_name: booking.customerName,
      customer_email: booking.customerEmail,
      customer_phone: booking.customerPhone,
      subtotal: booking.subtotal,
      payment_fee: booking.paymentFee,
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
  args: { bookingCode: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_bookingCode", (q) => q.eq("bookingCode", args.bookingCode.trim().toUpperCase()))
      .unique();
    if (!booking || booking.customerEmail !== args.email.trim().toLowerCase() || booking.status !== "confirmed") return null;
    const show = await ctx.db.get("shows", booking.showId);
    const movie = show ? await ctx.db.get("movies", show.movieId) : null;
    if (!show || !movie) return null;
    const seats = await ctx.db.query("bookingSeats")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking._id)).take(100);
    return {
      bookingCode: booking.bookingCode,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      totalAmount: booking.totalAmount,
      movieTitle: movie.title,
      posterUrl: await moviePosterUrl(ctx, movie),
      date: show.date,
      time: show.time,
      seats: seats.map((seat) => seat.seatNumber),
    };
  },
});
