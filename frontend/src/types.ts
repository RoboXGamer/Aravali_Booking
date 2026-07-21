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
  category_name: "VIP" | "Gold" | "Silver" | "Bronze";
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
