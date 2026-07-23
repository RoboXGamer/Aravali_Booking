import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { convex } from "../lib/convex";

export interface MovieInput {
  title: string;
  description: string;
  duration_minutes: number;
  poster_url: string;
}

export interface SeatInput {
  section_name: string;
  row_prefix: string;
  row_index: number;
  col_index: number;
  seat_number: string;
  category_name: string;
  price: number;
  status: string;
  is_visible: boolean;
}

const movieValues = (input: MovieInput) => ({
  title: input.title,
  description: input.description,
  durationMinutes: input.duration_minutes,
  posterUrl: input.poster_url,
});

const seatValues = (input: SeatInput) => ({
  sectionName: input.section_name,
  rowPrefix: input.row_prefix,
  rowIndex: input.row_index,
  colIndex: input.col_index,
  seatNumber: input.seat_number,
  categoryName: input.category_name,
  price: input.price,
  status: input.status as "active" | "disabled",
  isVisible: input.is_visible,
});

export const adminBackend = {
  loadAll() {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return convex.query(api.admin.getAll, {
      today: now.toISOString().slice(0, 10),
      dayStart,
      monthStart,
    });
  },
  initializeSettings: () => convex.mutation(api.admin.initializeSettings),
  movies: {
    create: (input: MovieInput) => convex.mutation(api.admin.createMovie, movieValues(input)),
    update: (id: string, input: MovieInput) => convex.mutation(api.admin.updateMovie, { movieId: id as Id<"movies">, ...movieValues(input) }),
    delete: (id: string) => convex.mutation(api.admin.deleteMovie, { movieId: id as Id<"movies"> }),
  },
  shows: {
    create: (input: { movie_id: string; date: string; time: string; is_enabled: boolean }) =>
      convex.mutation(api.admin.createShow, { movieId: input.movie_id as Id<"movies">, date: input.date, time: input.time, isEnabled: input.is_enabled }),
    setEnabled: (id: string, isEnabled: boolean) => convex.mutation(api.admin.setShowEnabled, { showId: id as Id<"shows">, isEnabled }),
    delete: (id: string) => convex.mutation(api.admin.deleteShow, { showId: id as Id<"shows"> }),
  },
  seats: {
    create: (input: SeatInput) => convex.mutation(api.admin.createSeat, seatValues(input)),
    update: (id: string, input: SeatInput) => convex.mutation(api.admin.updateSeat, { seatId: id as Id<"seats">, ...seatValues(input) }),
    delete: (id: string) => convex.mutation(api.admin.deleteSeat, { seatId: id as Id<"seats"> }),
  },
  reservations: {
    create: (input: { show_id: string; seat_layout_id: string; reason: string }) =>
      convex.mutation(api.admin.reserveSeat, {
        showId: input.show_id as Id<"shows">,
        seatId: input.seat_layout_id as Id<"seats">,
        reason: input.reason.trim() || null,
      }),
    delete: (id: string) => convex.mutation(api.admin.releaseReservation, { reservationId: id as Id<"reservations"> }),
  },
  bookings: {
    setStatus: (id: string, status: "confirmed" | "cancelled") =>
      convex.mutation(api.admin.setBookingStatus, { bookingId: id as Id<"bookings">, status }),
    checkIn: (bookingCode: string) => convex.mutation(api.admin.checkIn, { bookingCode, now: Date.now() }),
  },
  settings: {
    update: (input: {
      max_seats_per_booking: number;
      seat_hold_minutes: number;
      convenience_fee_per_seat: number;
      gst_percentage: number;
      razorpay_fee_percentage: number;
    }) => convex.mutation(api.admin.updateSettings, {
      maxSeatsPerBooking: input.max_seats_per_booking,
      seatHoldMinutes: input.seat_hold_minutes,
      convenienceFeePerSeat: input.convenience_fee_per_seat,
      gstPercentage: input.gst_percentage,
      razorpayFeePercentage: input.razorpay_fee_percentage,
    }),
  },
  admins: {
    setAccess: (email: string, isAdmin: boolean) =>
      convex.mutation(api.admin.saveAdminAccess, { email, isAdmin }),
  },
  polls: {
    save: (pollId: string | null, input: {
      week_start: string;
      voting_starts_at: string;
      voting_ends_at: string;
      status: "draft" | "voting";
      movie_ids: string[];
    }) => convex.mutation(api.admin.savePoll, {
      pollId: pollId as Id<"polls"> | null,
      weekStart: input.week_start,
      votingStartsAt: new Date(input.voting_starts_at).getTime(),
      votingEndsAt: new Date(input.voting_ends_at).getTime(),
      status: input.status,
      movieIds: input.movie_ids as Id<"movies">[],
    }),
    setStatus: (pollId: string, status: "draft" | "voting" | "closed") =>
      convex.mutation(api.admin.setPollStatus, { pollId: pollId as Id<"polls">, status }),
    override: (pollId: string, movieId: string) =>
      convex.mutation(api.admin.overridePollWinner, { pollId: pollId as Id<"polls">, movieId: movieId as Id<"movies"> }),
    delete: (pollId: string) => convex.mutation(api.admin.deletePoll, { pollId: pollId as Id<"polls"> }),
  },
};
