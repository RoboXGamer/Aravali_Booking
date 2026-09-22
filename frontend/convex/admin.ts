import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { auditoriumDate, ensureSettings, getSettings, moviePosterUrl, requireAdmin, requireSuperAdmin } from "./lib";

const nullableString = v.union(v.string(), v.null());
const seatCategory = v.union(v.literal("Gold"), v.literal("Silver"));
const filmCertificate = v.union(v.literal("U"), v.literal("U/A"), v.literal("A"));
const adminRole = v.union(v.literal("operations"), v.literal("super_admin"));
const movieFields = {
  title: v.string(),
  description: v.string(),
  durationMinutes: v.number(),
  posterStorageId: v.id("_storage"),
  certificate: filmCertificate,
  language: v.string(),
};
const moviePosterTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumMoviePosterBytes = 10 * 1024 * 1024;

async function validateMoviePoster(ctx: MutationCtx, storageId: Id<"_storage">) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata) throw new Error("The uploaded poster could not be found. Upload it again.");
  if (!metadata.contentType || !moviePosterTypes.has(metadata.contentType)) {
    throw new Error("Poster must be a JPEG, PNG, or WebP image.");
  }
  if (metadata.size > maximumMoviePosterBytes) {
    throw new Error("Poster must be 10 MB or smaller.");
  }
}
const seatFields = {
  sectionName: v.string(),
  rowPrefix: v.string(),
  rowIndex: v.number(),
  colIndex: v.number(),
  seatNumber: v.string(),
  categoryName: seatCategory,
  price: v.number(),
  status: v.union(v.literal("active"), v.literal("disabled")),
  isVisible: v.boolean(),
};

const serializeMovie = async (ctx: QueryCtx, movie: Doc<"movies">) => ({
  id: movie._id,
  title: movie.title,
  description: movie.description,
  duration_minutes: movie.durationMinutes,
  certificate: movie.certificate ?? "U",
  language: movie.language ?? "Not specified",
  poster_storage_id: movie.posterStorageId ?? null,
  poster_url: await moviePosterUrl(ctx, movie) ?? "",
});

const serializeSeat = (seat: Doc<"seats">) => ({
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
});

async function showDetails(ctx: QueryCtx, show: Doc<"shows">, capacity: number) {
  const movie = await ctx.db.get("movies", show.movieId);
  if (!movie) return null;
  const soldSeats = Math.max(0, show.soldSeats ?? 0);
  return {
    id: show._id,
    movie_id: show.movieId,
    date: show.date,
    time: show.time,
    is_enabled: show.isEnabled,
    movies: await serializeMovie(ctx, movie),
    sold_seats: soldSeats,
    capacity,
    occupancy_percentage: capacity ? Math.min(100, Math.round(soldSeats / capacity * 1000) / 10) : 0,
  };
}

async function pollDetails(ctx: QueryCtx, poll: Doc<"polls">) {
  const options = await ctx.db
    .query("pollOptions")
    .withIndex("by_pollId", (q) => q.eq("pollId", poll._id))
    .take(20);
  const output = [];
  for (const option of options) {
    const movie = await ctx.db.get("movies", option.movieId);
    if (movie) {
      output.push({
        id: option._id,
        movie_id: option.movieId,
        votes_count: option.votesCount,
        movies: await serializeMovie(ctx, movie),
      });
    }
  }
  return {
    id: poll._id,
    week_start: poll.weekStart,
    voting_starts_at: new Date(poll.votingStartsAt).toISOString(),
    voting_ends_at: new Date(poll.votingEndsAt).toISOString(),
    status: poll.status,
    winning_movie_id: poll.overriddenMovieId ?? poll.winningMovieId,
    poll_options: output,
  };
}

export const getSection = query({
  args: {
    section: v.union(v.literal("overview"), v.literal("programming"), v.literal("bookings"), v.literal("setup")),
    today: v.string(),
    dayStart: v.number(),
    monthStart: v.number(),
    // Optional during rollout so an older cached frontend can still load.
    weekStart: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (admin.role === "operations" && args.section === "overview") {
      throw new Error("Financial reporting is available to Super Admins only.");
    }
    type ShowOutput = NonNullable<Awaited<ReturnType<typeof showDetails>>>;
    type BookingOutput = {
      id: Id<"bookings">;
      booking_code: string;
      customer_name: string;
      customer_email: string;
      customer_phone: string | null;
      total_amount: number;
      status: Doc<"bookings">["status"];
      created_at: string;
      is_checked_in: boolean;
      checked_in_at: string | null;
      shows: ShowOutput;
      booking_seats: Array<{ seat_number: string }>;
    };
    const result = {
      dashboard: null as {
        today_bookings: number;
        today_revenue: number;
        weekly_revenue: number;
        monthly_revenue: number;
        occupancy_percentage: number;
        upcoming_shows: ShowOutput[];
      } | null,
      movies: [] as Array<Awaited<ReturnType<typeof serializeMovie>>>,
      shows: [] as ShowOutput[],
      seats: [] as ReturnType<typeof serializeSeat>[],
      bookings: [] as BookingOutput[],
      polls: [] as Array<Awaited<ReturnType<typeof pollDetails>>>,
      settings: null as {
        id: Id<"appSettings">;
        max_seats_per_booking: number;
        seat_hold_minutes: number;
        razorpay_fee_percentage: number;
      } | null,
      adminUsers: [] as Array<{ id: Id<"adminUsers">; email: string; isAdmin: boolean; role: "operations" | "super_admin" }>,
    };

    const movieDocs = args.section === "overview" || args.section === "programming" || args.section === "bookings"
      ? await ctx.db.query("movies").order("desc").take(500)
      : [];
    const seatDocs = args.section === "overview" || args.section === "bookings" || args.section === "setup"
      ? await ctx.db.query("seats").withIndex("by_rowIndex_and_colIndex").take(1000)
      : [];
    let capacity = seatDocs.filter((seat) => seat.isVisible && seat.status === "active").length;

    if (args.section === "programming" && seatDocs.length === 0) {
      const activeSeats = await ctx.db.query("seats").withIndex("by_rowIndex_and_colIndex").take(1000);
      capacity = activeSeats.filter((seat) => seat.isVisible && seat.status === "active").length;
    }

    const showDocs = args.section === "overview" || args.section === "programming" || args.section === "bookings"
      ? await ctx.db.query("shows").withIndex("by_date_and_time").take(500)
      : [];
    const showRows = (await Promise.all(showDocs.map((show) => showDetails(ctx, show, capacity))))
      .filter((show): show is NonNullable<typeof show> => Boolean(show));
    const showMap = new Map(showRows.map((show) => [show.id, show]));

    result.movies = await Promise.all(movieDocs.map((movie) => serializeMovie(ctx, movie)));
    result.shows = showRows;
    result.seats = seatDocs.map(serializeSeat);

    if (args.section === "overview" || args.section === "bookings") {
      const bookingDocs = admin.role === "super_admin"
        ? await ctx.db.query("bookings").order("desc").take(1000)
        : [];
      for (const booking of bookingDocs) {
        const show = showMap.get(booking.showId);
        if (!show) continue;
        const bookingSeats = await ctx.db.query("bookingSeats")
          .withIndex("by_bookingId", (q) => q.eq("bookingId", booking._id))
          .take(100);
        result.bookings.push({
          id: booking._id,
          booking_code: booking.bookingCode,
          customer_name: booking.customerName,
          customer_email: booking.customerEmail,
          customer_phone: booking.customerPhone,
          total_amount: booking.totalAmount,
          status: booking.status,
          created_at: new Date(booking.createdAt).toISOString(),
          is_checked_in: booking.isCheckedIn,
          checked_in_at: booking.checkedInAt ? new Date(booking.checkedInAt).toISOString() : null,
          shows: show,
          booking_seats: bookingSeats.map((seat) => ({ seat_number: seat.seatNumber })),
        });
      }
    }

    if (args.section === "overview") {
      const confirmed = result.bookings.filter((booking) => booking.status === "confirmed");
      const todayBookings = confirmed.filter((booking) => new Date(booking.created_at).getTime() >= args.dayStart);
      const weekday = new Date(`${args.today}T00:00:00Z`).getUTCDay();
      const weekStart = args.weekStart ?? args.dayStart - ((weekday + 6) % 7) * 24 * 60 * 60 * 1000;
      const weekBookings = confirmed.filter((booking) => new Date(booking.created_at).getTime() >= weekStart);
      const monthBookings = confirmed.filter((booking) => new Date(booking.created_at).getTime() >= args.monthStart);
      const upcoming = showRows.filter((show) => show.is_enabled && show.date >= args.today);
      const occupancy = upcoming.length
        ? Math.round(upcoming.reduce((sum, show) => sum + show.occupancy_percentage, 0) / upcoming.length * 10) / 10
        : 0;
      result.dashboard = {
        today_bookings: todayBookings.length,
        today_revenue: todayBookings.reduce((sum, booking) => sum + Number(booking.total_amount), 0),
        weekly_revenue: weekBookings.reduce((sum, booking) => sum + Number(booking.total_amount), 0),
        monthly_revenue: monthBookings.reduce((sum, booking) => sum + Number(booking.total_amount), 0),
        occupancy_percentage: occupancy,
        upcoming_shows: upcoming.slice(0, 50),
      };
      result.bookings = [];
    }

    if (args.section === "programming") {
      const pollDocs = await ctx.db.query("polls").withIndex("by_weekStart").order("desc").take(100);
      result.polls = await Promise.all(pollDocs.map((poll) => pollDetails(ctx, poll)));
    }

    if (args.section === "setup" && admin.role === "super_admin") {
      const [settings, admins] = await Promise.all([
        getSettings(ctx),
        ctx.db.query("adminUsers").withIndex("by_email").take(100),
      ]);
      result.settings = settings ? {
        id: settings._id,
        max_seats_per_booking: settings.maxSeatsPerBooking,
        seat_hold_minutes: settings.seatHoldMinutes,
        razorpay_fee_percentage: settings.razorpayFeePercentage,
      } : null;
      result.adminUsers = admins.map((admin) => ({
        id: admin._id,
        email: admin.email,
        isAdmin: admin.isAdmin,
        role: admin.role ?? "super_admin",
      }));
    }

    return result;
  },
});

export const saveAdminAccess = mutation({
  args: { email: v.string(), isAdmin: v.boolean(), role: adminRole },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    const existing = await ctx.db.query("adminUsers")
      .withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (existing?.isAdmin && (existing.role ?? "super_admin") === "super_admin" && (!args.isAdmin || args.role !== "super_admin")) {
      const activeAdmins = await ctx.db.query("adminUsers").take(100);
      if (!activeAdmins.some((admin) => admin._id !== existing._id && admin.isAdmin && (admin.role ?? "super_admin") === "super_admin")) {
        throw new Error("At least one active Super Admin is required.");
      }
    }
    if (existing) {
      await ctx.db.patch("adminUsers", existing._id, { isAdmin: args.isAdmin, role: args.role });
      return existing._id;
    }
    return await ctx.db.insert("adminUsers", { email, isAdmin: args.isAdmin, role: args.role });
  },
});

export const initializeSettings = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    await ensureSettings(ctx);
    return null;
  },
});

export const generateMoviePosterUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const discardMoviePoster = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const movie = await ctx.db
      .query("movies")
      .filter((q) => q.eq(q.field("posterStorageId"), args.storageId))
      .first();
    if (!movie) await ctx.storage.delete(args.storageId);
    return null;
  },
});

export const createMovie = mutation({
  args: movieFields,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!args.language.trim()) throw new Error("Enter the movie language.");
    await validateMoviePoster(ctx, args.posterStorageId);
    return await ctx.db.insert("movies", args);
  },
});

export const updateMovie = mutation({
  args: { movieId: v.id("movies"), ...movieFields },
  handler: async (ctx, { movieId, ...values }) => {
    await requireAdmin(ctx);
    if (!values.language.trim()) throw new Error("Enter the movie language.");
    const existing = await ctx.db.get("movies", movieId);
    if (!existing) throw new Error("Movie not found.");
    await validateMoviePoster(ctx, values.posterStorageId);
    await ctx.db.replace("movies", movieId, values);
    if (existing.posterStorageId && existing.posterStorageId !== values.posterStorageId) {
      await ctx.storage.delete(existing.posterStorageId);
    }
    return null;
  },
});

export const deleteMovie = mutation({
  args: { movieId: v.id("movies") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const show = await ctx.db.query("shows").withIndex("by_movieId", (q) => q.eq("movieId", args.movieId)).first();
    if (show) throw new Error("Delete this movie's shows before deleting the movie.");
    const pollOption = await ctx.db.query("pollOptions").filter((q) => q.eq(q.field("movieId"), args.movieId)).first();
    if (pollOption) throw new Error("Remove this movie from its poll before deleting it.");
    const movie = await ctx.db.get("movies", args.movieId);
    await ctx.db.delete("movies", args.movieId);
    if (movie?.posterStorageId) await ctx.storage.delete(movie.posterStorageId);
    return null;
  },
});

export const createShow = mutation({
  args: { movieId: v.id("movies"), date: v.string(), time: v.string(), isEnabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    if (!await ctx.db.get("movies", args.movieId)) throw new Error("Movie not found.");
    return await ctx.db.insert("shows", { ...args, soldSeats: 0 });
  },
});

export const setShowEnabled = mutation({
  args: { showId: v.id("shows"), isEnabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.patch("shows", args.showId, { isEnabled: args.isEnabled });
    return null;
  },
});

export const deleteShow = mutation({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .collect();
    const confirmedBooking = bookings.find((booking) => booking.status === "confirmed");
    if (confirmedBooking) {
      throw new Error("Cancel all confirmed tickets before deleting this show.");
    }

    let bookingSeatsDeleted = 0;
    for (const booking of bookings) {
      const bookingSeats = await ctx.db
        .query("bookingSeats")
        .withIndex("by_bookingId", (q) => q.eq("bookingId", booking._id))
        .collect();
      for (const bookingSeat of bookingSeats) {
        await ctx.db.delete("bookingSeats", bookingSeat._id);
        bookingSeatsDeleted += 1;
      }
      await ctx.db.delete("bookings", booking._id);
    }

    const sessions = await ctx.db
      .query("checkoutSessions")
      .filter((q) => q.eq(q.field("showId"), args.showId))
      .collect();
    let checkoutSeatsDeleted = 0;
    let paymentsDeleted = 0;
    for (const session of sessions) {
      const held = await ctx.db
        .query("checkoutSessionSeats")
        .withIndex("by_checkoutSessionId", (q) => q.eq("checkoutSessionId", session._id))
        .collect();
      for (const row of held) {
        await ctx.db.delete("checkoutSessionSeats", row._id);
        checkoutSeatsDeleted += 1;
      }
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_checkoutSessionId", (q) => q.eq("checkoutSessionId", session._id))
        .collect();
      for (const payment of payments) {
        await ctx.db.delete("payments", payment._id);
        paymentsDeleted += 1;
      }
      await ctx.db.delete("checkoutSessions", session._id);
    }
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .collect();
    for (const reservation of reservations) await ctx.db.delete("reservations", reservation._id);
    await ctx.db.delete("shows", args.showId);
    return {
      cancelledBookingsDeleted: bookings.length,
      bookingSeatsDeleted,
      checkoutSessionsDeleted: sessions.length,
      checkoutSeatsDeleted,
      paymentsDeleted,
      reservationsDeleted: reservations.length,
    };
  },
});

export const createSeat = mutation({
  args: seatFields,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("seats").withIndex("by_seatNumber", (q) => q.eq("seatNumber", args.seatNumber)).unique();
    if (existing) throw new Error("Seat number already exists.");
    return await ctx.db.insert("seats", args);
  },
});

export const updateSeat = mutation({
  args: { seatId: v.id("seats"), ...seatFields },
  handler: async (ctx, { seatId, ...values }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("seats").withIndex("by_seatNumber", (q) => q.eq("seatNumber", values.seatNumber)).unique();
    if (existing && existing._id !== seatId) throw new Error("Seat number already exists.");
    await ctx.db.replace("seats", seatId, values);
    return null;
  },
});

export const deleteSeat = mutation({
  args: { seatId: v.id("seats") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const used = await ctx.db.query("bookingSeats").filter((q) => q.eq(q.field("seatId"), args.seatId)).first();
    if (used) throw new Error("A seat used by a booking cannot be deleted; disable it instead.");
    const reservations = await ctx.db.query("reservations").filter((q) => q.eq(q.field("seatId"), args.seatId)).take(100);
    for (const row of reservations) await ctx.db.delete("reservations", row._id);
    await ctx.db.delete("seats", args.seatId);
    return null;
  },
});

export const reserveSeat = mutation({
  args: { showId: v.id("shows"), seatId: v.id("seats"), reason: nullableString },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db.query("reservations")
      .withIndex("by_showId_and_seatId", (q) => q.eq("showId", args.showId).eq("seatId", args.seatId)).unique();
    if (existing) throw new Error("Seat is already reserved for this show.");
    const bookingSeats = await ctx.db.query("bookingSeats")
      .withIndex("by_showId_and_seatId", (q) => q.eq("showId", args.showId).eq("seatId", args.seatId)).take(10);
    for (const row of bookingSeats) {
      if ((await ctx.db.get("bookings", row.bookingId))?.status === "confirmed") throw new Error("Seat is already booked.");
    }
    return await ctx.db.insert("reservations", { ...args, createdBy: admin.email });
  },
});

export const releaseReservation = mutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete("reservations", args.reservationId);
    return null;
  },
});

export const setBookingStatus = mutation({
  args: { bookingId: v.id("bookings"), status: v.union(v.literal("confirmed"), v.literal("cancelled")) },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking) throw new Error("Booking not found.");
    if (args.status === "confirmed" && booking.status === "cancelled") {
      const seats = await ctx.db.query("bookingSeats").withIndex("by_bookingId", (q) => q.eq("bookingId", booking._id)).take(100);
      for (const seat of seats) {
        const reservations = await ctx.db.query("reservations")
          .withIndex("by_showId_and_seatId", (q) => q.eq("showId", booking.showId).eq("seatId", seat.seatId)).unique();
        if (reservations) throw new Error(`${seat.seatNumber} is reserved and this booking cannot be restored.`);
        const rows = await ctx.db.query("bookingSeats")
          .withIndex("by_showId_and_seatId", (q) => q.eq("showId", booking.showId).eq("seatId", seat.seatId)).take(10);
        for (const row of rows) {
          if (row.bookingId === booking._id) continue;
          if ((await ctx.db.get("bookings", row.bookingId))?.status === "confirmed") {
            throw new Error(`${seat.seatNumber} has been sold again and this booking cannot be restored.`);
          }
        }
      }
    }
    if (args.status !== booking.status) {
      const seatCount = (await ctx.db.query("bookingSeats")
        .withIndex("by_bookingId", (q) => q.eq("bookingId", booking._id)).take(100)).length;
      const show = await ctx.db.get("shows", booking.showId);
      if (show) {
        const currentSold = show.soldSeats ?? 0;
        await ctx.db.patch("shows", show._id, {
          soldSeats: args.status === "confirmed"
            ? currentSold + seatCount
            : Math.max(0, currentSold - seatCount),
        });
      }
    }
    await ctx.db.patch("bookings", booking._id, { status: args.status });
    return null;
  },
});

export const updateSettings = mutation({
  args: {
    maxSeatsPerBooking: v.number(),
    seatHoldMinutes: v.number(),
    razorpayFeePercentage: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    if (args.maxSeatsPerBooking < 1 || args.maxSeatsPerBooking > 20) throw new Error("Booking limit must be between 1 and 20.");
    if (args.seatHoldMinutes < 1 || args.seatHoldMinutes > 30) throw new Error("Seat hold must be between 1 and 30 minutes.");
    if (args.razorpayFeePercentage < 0) throw new Error("Payment fee cannot be negative.");
    const current = await ensureSettings(ctx);
    await ctx.db.patch("appSettings", current._id, args);
    return null;
  },
});

export const savePoll = mutation({
  args: {
    pollId: v.union(v.id("polls"), v.null()),
    weekStart: v.string(),
    votingStartsAt: v.number(),
    votingEndsAt: v.number(),
    status: v.union(v.literal("draft"), v.literal("voting")),
    movieIds: v.array(v.id("movies")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.votingStartsAt >= args.votingEndsAt) throw new Error("Voting must end after it starts.");
    const monday = new Date(`${args.weekStart}T00:00:00Z`);
    if (monday.getUTCDay() !== 1) throw new Error("Movie week must start on a Monday.");
    const movieIds = [...new Set(args.movieIds)];
    if (movieIds.length < 2) throw new Error("Choose at least two movies.");
    if (movieIds.length > 10) throw new Error("Choose no more than ten movies.");
    let pollId: Id<"polls">;
    if (args.pollId) {
      const poll = await ctx.db.get("polls", args.pollId);
      if (!poll) throw new Error("Poll not found.");
      if (poll.status === "closed" || poll.status === "overridden") throw new Error("Completed polls cannot be edited.");
      const options = await ctx.db.query("pollOptions").withIndex("by_pollId", (q) => q.eq("pollId", poll._id)).take(20);
      const changed = options.length !== movieIds.length || options.some((option) => !movieIds.includes(option.movieId));
      if (changed && options.some((option) => option.votesCount > 0)) throw new Error("Poll options cannot change after votes are recorded.");
      if (changed) {
        for (const option of options) await ctx.db.delete("pollOptions", option._id);
        for (const movieId of movieIds) await ctx.db.insert("pollOptions", { pollId: poll._id, movieId, votesCount: 0 });
      }
      await ctx.db.patch("polls", poll._id, {
        weekStart: args.weekStart,
        votingStartsAt: args.votingStartsAt,
        votingEndsAt: args.votingEndsAt,
        status: args.status,
      });
      pollId = poll._id;
    } else {
      const existing = await ctx.db.query("polls").withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart)).unique();
      if (existing) throw new Error("A poll already exists for this week.");
      pollId = await ctx.db.insert("polls", {
        weekStart: args.weekStart,
        votingStartsAt: args.votingStartsAt,
        votingEndsAt: args.votingEndsAt,
        status: args.status,
        winningMovieId: null,
        overriddenMovieId: null,
      });
      for (const movieId of movieIds) await ctx.db.insert("pollOptions", { pollId, movieId, votesCount: 0 });
    }
    return pollId;
  },
});

export const setPollStatus = mutation({
  args: { pollId: v.id("polls"), status: v.union(v.literal("draft"), v.literal("voting"), v.literal("closed")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const poll = await ctx.db.get("polls", args.pollId);
    if (!poll) throw new Error("Poll not found.");
    if (poll.status === "closed" || poll.status === "overridden") throw new Error("A completed poll cannot be reopened.");
    let winner: Id<"movies"> | null = null;
    if (args.status === "closed") {
      const options = await ctx.db.query("pollOptions").withIndex("by_pollId", (q) => q.eq("pollId", poll._id)).take(20);
      options.sort((a, b) => b.votesCount - a.votesCount || a._creationTime - b._creationTime);
      winner = options[0]?.movieId ?? null;
    }
    await ctx.db.patch("polls", poll._id, { status: args.status, winningMovieId: winner });
    return null;
  },
});

export const overridePollWinner = mutation({
  args: { pollId: v.id("polls"), movieId: v.id("movies") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const option = await ctx.db.query("pollOptions")
      .withIndex("by_pollId_and_movieId", (q) => q.eq("pollId", args.pollId).eq("movieId", args.movieId)).unique();
    if (!option) throw new Error("Winner must be one of the poll options.");
    await ctx.db.patch("polls", args.pollId, {
      status: "overridden",
      overriddenMovieId: args.movieId,
      winningMovieId: args.movieId,
    });
    return null;
  },
});

export const deletePoll = mutation({
  args: { pollId: v.id("polls") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const votes = await ctx.db.query("pollVotes").withIndex("by_pollId", (q) => q.eq("pollId", args.pollId)).take(1000);
    for (const vote of votes) await ctx.db.delete("pollVotes", vote._id);
    const options = await ctx.db.query("pollOptions").withIndex("by_pollId", (q) => q.eq("pollId", args.pollId)).take(100);
    for (const option of options) await ctx.db.delete("pollOptions", option._id);
    await ctx.db.delete("polls", args.pollId);
    return null;
  },
});

export const checkIn = mutation({
  args: { bookingCode: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const bookingCode = args.bookingCode.trim().toUpperCase();
    const booking = await ctx.db.query("bookings")
      .withIndex("by_bookingCode", (q) => q.eq("bookingCode", bookingCode)).unique();
    if (!booking) {
      return {
        status: "not_found" as const,
        booking_code: bookingCode,
      };
    }
    if (booking.status === "cancelled") {
      return {
        status: "cancelled" as const,
        booking_code: booking.bookingCode,
        customer_name: booking.customerName,
      };
    }
    const show = await ctx.db.get("shows", booking.showId);
    if (!show || show.date < auditoriumDate(args.now)) {
      return {
        status: "show_ended" as const,
        booking_code: booking.bookingCode,
        customer_name: booking.customerName,
      };
    }
    if (booking.isCheckedIn) {
      return {
        status: "already_checked_in" as const,
        booking_code: booking.bookingCode,
        customer_name: booking.customerName,
        checked_in_at: booking.checkedInAt
          ? new Date(booking.checkedInAt).toISOString()
          : null,
      };
    }
    await ctx.db.patch("bookings", booking._id, { isCheckedIn: true, checkedInAt: args.now });
    return {
      status: "success" as const,
      booking_code: booking.bookingCode,
      customer_name: booking.customerName,
      checked_in_at: new Date(args.now).toISOString(),
    };
  },
});
