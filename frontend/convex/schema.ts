import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const nullableString = v.union(v.string(), v.null());
const seatCategory = v.union(v.literal("Gold"), v.literal("Silver"));
const filmCertificate = v.union(v.literal("U"), v.literal("U/A"), v.literal("A"));
const adminRole = v.union(v.literal("operations"), v.literal("super_admin"));

export default defineSchema({
  adminUsers: defineTable({
    email: v.string(),
    isAdmin: v.boolean(),
    role: v.optional(adminRole),
  }).index("by_email", ["email"]),

  movies: defineTable({
    title: v.string(),
    description: v.string(),
    durationMinutes: v.number(),
    posterStorageId: v.optional(v.id("_storage")),
    certificate: v.optional(filmCertificate),
    language: v.optional(v.string()),
  }),

  shows: defineTable({
    movieId: v.id("movies"),
    date: v.string(),
    time: v.string(),
    isEnabled: v.boolean(),
    soldSeats: v.optional(v.number()),
  })
    .index("by_date_and_time", ["date", "time"])
    .index("by_movieId", ["movieId"]),

  seats: defineTable({
    sectionName: v.string(),
    rowPrefix: v.string(),
    rowIndex: v.number(),
    colIndex: v.number(),
    seatNumber: v.string(),
    categoryName: seatCategory,
    price: v.number(),
    status: v.union(v.literal("active"), v.literal("disabled")),
    isVisible: v.boolean(),
  })
    .index("by_seatNumber", ["seatNumber"])
    .index("by_rowIndex_and_colIndex", ["rowIndex", "colIndex"]),

  reservations: defineTable({
    showId: v.id("shows"),
    seatId: v.id("seats"),
    reason: nullableString,
    createdBy: v.string(),
  })
    .index("by_showId", ["showId"])
    .index("by_showId_and_seatId", ["showId", "seatId"]),

  checkoutSessions: defineTable({
    showId: v.id("shows"),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: nullableString,
    subtotal: v.number(),
    paymentFee: v.number(),
    totalAmount: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("expired"),
      v.literal("failed"),
      v.literal("capturing"),
      v.literal("refund_pending"),
      v.literal("refunded"),
      v.literal("review"),
    ),
    expiresAt: v.number(),
    razorpayOrderId: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    capturePaymentId: v.optional(v.string()),
    nextReconcileAt: v.optional(v.number()),
    reconcileUntil: v.optional(v.number()),
    workerToken: v.optional(v.string()),
    workerUntil: v.optional(v.number()),
    lastRefreshAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    needsAttention: v.optional(v.boolean()),
    reconciliationVersion: v.optional(v.number()),
  })
    .index("by_status_and_expiresAt", ["status", "expiresAt"])
    .index("by_razorpayOrderId", ["razorpayOrderId"])
    .index("by_nextReconcileAt", ["nextReconcileAt"])
    .index("by_showId", ["showId"])
    .index("by_needsAttention", ["needsAttention"])
    .index("by_reconciliationVersion", ["reconciliationVersion"]),

  checkoutItems: defineTable({
    checkoutSessionId: v.id("checkoutSessions"),
    seatId: v.id("seats"),
    seatNumber: v.string(),
    categoryName: seatCategory,
    price: v.number(),
  }).index("by_checkoutSessionId", ["checkoutSessionId"]),

  paymentAttempts: defineTable({
    checkoutSessionId: v.id("checkoutSessions"),
    paymentId: v.string(),
    orderId: v.string(),
    amount: v.number(),
    currency: v.string(),
    providerStatus: v.string(),
    disposition: v.union(v.literal("pending"), v.literal("booked"), v.literal("refund_pending"), v.literal("refunded"), v.literal("review")),
    refundKey: v.optional(v.string()),
    refundAmount: v.optional(v.number()),
    refundId: v.optional(v.string()),
    refundStatus: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_paymentId", ["paymentId"])
    .index("by_checkoutSessionId", ["checkoutSessionId"]),

  paymentWebhookEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    orderId: v.string(),
    receivedAt: v.number(),
    status: v.union(v.literal("received"), v.literal("queued"), v.literal("unmatched")),
    nextAttemptAt: v.optional(v.number()),
  }).index("by_eventId", ["eventId"])
    .index("by_nextAttemptAt", ["nextAttemptAt"]),

  checkoutSessionSeats: defineTable({
    checkoutSessionId: v.id("checkoutSessions"),
    showId: v.id("shows"),
    seatId: v.id("seats"),
  })
    .index("by_checkoutSessionId", ["checkoutSessionId"])
    .index("by_showId_and_seatId", ["showId", "seatId"]),

  bookings: defineTable({
    bookingCode: v.string(),
    showId: v.id("shows"),
    checkoutSessionId: v.id("checkoutSessions"),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: nullableString,
    subtotal: v.number(),
    paymentFee: v.number(),
    totalAmount: v.number(),
    status: v.union(v.literal("confirmed"), v.literal("cancelled")),
    isCheckedIn: v.boolean(),
    checkedInAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
  })
    .index("by_bookingCode", ["bookingCode"])
    .index("by_checkoutSessionId", ["checkoutSessionId"])
    .index("by_showId", ["showId"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

  bookingSeats: defineTable({
    bookingId: v.id("bookings"),
    showId: v.id("shows"),
    seatId: v.id("seats"),
    seatNumber: v.string(),
    categoryName: seatCategory,
    price: v.number(),
  })
    .index("by_bookingId", ["bookingId"])
    .index("by_showId_and_seatId", ["showId", "seatId"]),

  payments: defineTable({
    checkoutSessionId: v.id("checkoutSessions"),
    providerOrderId: v.string(),
    providerPaymentId: v.optional(v.string()),
    providerSignature: v.optional(v.string()),
    amount: v.number(),
    status: v.union(v.literal("created"), v.literal("paid"), v.literal("failed")),
  })
    .index("by_checkoutSessionId", ["checkoutSessionId"])
    .index("by_providerOrderId", ["providerOrderId"]),

  appSettings: defineTable({
    key: v.string(),
    maxSeatsPerBooking: v.number(),
    seatHoldMinutes: v.number(),
    razorpayFeePercentage: v.number(),
  }).index("by_key", ["key"]),

  polls: defineTable({
    weekStart: v.string(),
    votingStartsAt: v.number(),
    votingEndsAt: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("voting"),
      v.literal("closed"),
      v.literal("overridden"),
    ),
    winningMovieId: v.union(v.id("movies"), v.null()),
    overriddenMovieId: v.union(v.id("movies"), v.null()),
  })
    .index("by_weekStart", ["weekStart"])
    .index("by_status_and_votingEndsAt", ["status", "votingEndsAt"]),

  pollOptions: defineTable({
    pollId: v.id("polls"),
    movieId: v.id("movies"),
    votesCount: v.number(),
  })
    .index("by_pollId", ["pollId"])
    .index("by_pollId_and_movieId", ["pollId", "movieId"]),

  pollVotes: defineTable({
    pollId: v.id("polls"),
    optionId: v.id("pollOptions"),
    visitorHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_pollId", ["pollId"])
    .index("by_pollId_and_visitorHash", ["pollId", "visitorHash"]),
});
