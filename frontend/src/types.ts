export interface Show {
  id: string;
  movie_id: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  venue: string;
  poster_url: string | null;
  trailer_url: string | null;
  duration_minutes: number;
  genre: string;
  certificate: string;
  language: string;
  cast_members: string | null;
  director: string | null;
  release_year: number;
  status: "active" | "disabled";
}

export type SeatAvailability = "available" | "booked" | "held" | "reserved" | "disabled";

export interface Seat {
  id: string;
  section_name: string;
  row_prefix: string;
  row_index: number;
  col_index: number;
  seat_number: string;
  category_name: "Gold" | "Silver" | "Bronze";
  price: string | number;
  status: "active" | "disabled";
  is_visible: boolean;
  availability: SeatAvailability;
}

export interface AvailabilityResponse {
  show_id: string;
  seats: Seat[];
  booked_seat_layout_ids: string[];
  reserved_seat_layout_ids: string[];
}

export interface BookingSettings {
  max_seats_per_booking: number;
  seat_hold_minutes: number;
  convenience_fee_per_seat: string | number;
  gst_percentage: string | number;
  razorpay_fee_percentage: string | number;
}

export interface CheckoutSession {
  id: string;
  show_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  subtotal: string | number;
  convenience_fee: string | number;
  gst_amount: string | number;
  total_amount: string | number;
  expires_at: string;
  razorpay_order_id: string;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export interface CheckoutResponse {
  checkout_session: CheckoutSession;
  selected_seats: Seat[];
  razorpay_order: RazorpayOrder;
}

export interface BookingSeat {
  id: string;
  seat_number: string;
  category_name: string;
  price: string | number;
}

export interface Booking {
  id: string;
  booking_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  subtotal: string | number;
  convenience_fee: string | number;
  gst_amount: string | number;
  total_amount: string | number;
  status: "confirmed" | "cancelled" | "refunded";
  created_at: string;
  shows: {
    id: string;
    date: string;
    time: string;
    movies: {
      title: string;
      poster_url?: string | null;
    };
  };
  booking_seats: BookingSeat[];
}

export interface PaymentVerificationResponse {
  status: "success";
  booking_id: string;
  booking_code: string;
  booking: Booking;
}

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PollMovie {
  id: string;
  title: string;
  synopsis: string | null;
  poster_url: string | null;
  genre: string;
  language: string;
  duration_minutes: number;
  certificate: string;
}

export interface PollOption {
  id: string;
  movie_id: string;
  votes_count: number;
  percentage: number;
  movie: PollMovie;
}

export interface Poll {
  id: string;
  week_start: string;
  voting_starts_at: string;
  voting_ends_at: string;
  status: "draft" | "voting" | "closed" | "overridden";
  winning_movie_id: string | null;
  overridden_movie_id: string | null;
  winning_movie?: PollMovie | null;
}

export interface PollResponse {
  poll: Poll | null;
  options: PollOption[];
  total_votes: number;
  has_voted: boolean;
  selected_option_id: string | null;
  is_open: boolean;
}
