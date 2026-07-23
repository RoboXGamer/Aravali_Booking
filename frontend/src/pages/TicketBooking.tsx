import { ArrowLeft, CalendarDays, ChevronRight, Clock3, MapPin, ShieldCheck, Ticket, X } from "lucide-react";
import { useAction, useQuery } from "convex/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Input } from "../components/common/Input";
import { SeatMap } from "../components/common/SeatMap";
import { Spinner } from "../components/common/Spinner";
import type { Seat } from "../types";

export function TicketBooking() {
  const { event_id } = useParams();
  const navigate = useNavigate();
  const show = useQuery(api.events.getById, event_id ? { showId: event_id as Id<"shows"> } : "skip");
  const settings = useQuery(api.bookings.getBookingSettings);
  const availability = useQuery(api.bookings.getAvailability, event_id ? { showId: event_id as Id<"shows"> } : "skip");
  const createCheckout = useAction(api.payments.createCheckout);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Seat["category_name"] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!availability) return;
    setSeats(availability.seats as Seat[]);
    const availableIds = new Set<string>(availability.seats.filter((seat) => seat.availability === "available").map((seat) => seat.id));
    setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
  }, [availability]);

  const selectedSeats = useMemo(() => seats.filter((seat) => selectedIds.includes(seat.id)), [seats, selectedIds]);
  const subtotal = selectedSeats.reduce((sum, seat) => sum + Number(seat.price), 0);
  const convenienceFee = settings ? Number(settings.convenience_fee_per_seat) * selectedSeats.length : 0;
  const razorpayFee = settings ? Math.round((subtotal * Number(settings.razorpay_fee_percentage) / 100) * 100) / 100 : 0;
  const paymentFee = convenienceFee + razorpayFee;
  const gst = settings ? Math.round(((subtotal + paymentFee) * Number(settings.gst_percentage) / 100) * 100) / 100 : 0;
  const total = subtotal + paymentFee + gst;

  const toggleSeat = (seatId: string) => {
    setError("");
    const seat = seats.find((item) => item.id === seatId);
    if (seat && !selectedCategory) setSelectedCategory(seat.category_name);
    setSelectedIds((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);
  };

  const chooseCategory = (category: Seat["category_name"] | null) => {
    setError("");
    setSelectedCategory(category);
    setSelectedIds((current) => category ? current.filter((id) => seats.find((seat) => seat.id === id)?.category_name === category) : []);
  };

  const beginCheckout = async (event: FormEvent) => {
    event.preventDefault();
    if (!show || !settings || selectedIds.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const checkout = await createCheckout({
        showId: show.id as Id<"shows">,
        customerName: name.trim(),
        customerEmail: email.trim().toLowerCase(),
        customerPhone: phone.trim() || null,
        seatIds: selectedIds as Id<"seats">[],
      });
      const checkoutState = { ...checkout, show };
      sessionStorage.setItem("aravalli.checkout", JSON.stringify(checkoutState));
      navigate("/checkout", { state: checkoutState });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (show === undefined || settings === undefined || availability === undefined) return <div className="flex min-h-screen items-center justify-center"><Spinner size="lg" /></div>;
  if (!show || !settings) return <div className="mx-auto max-w-2xl px-5 py-20 text-center text-rose-300">{error || "Booking is unavailable."}</div>;

  const formattedDate = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${show.date}T00:00:00`));

  return (
    <div className="booking-page">
      <main className="booking-panel">
        <header className="booking-header">
          <button type="button" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft /></button>
          <h1>Select Seats</h1>
          <span aria-hidden="true" />
        </header>

        <div className="booking-content">
          <div className="booking-main-column">
            <section className="booking-movie-summary">
              <img src={show.poster_url || "https://placehold.co/120x180/111827/FFFFFF?text=Movie"} alt={show.title} />
              <div>
                <h2>{show.title}</h2>
                <p><MapPin />{show.venue}</p>
                <p><CalendarDays />{formattedDate}<span>•</span><Clock3 />{show.time.slice(0, 5)}<span>•</span><Ticket />Screen 1</p>
              </div>
            </section>

            <section className="booking-map-wrap">
              <SeatMap
                seats={seats}
                selectedSeatIds={selectedIds}
                selectedCategory={selectedCategory}
                onCategorySelect={chooseCategory}
                onSeatSelect={toggleSeat}
                maxSelectable={settings.max_seats_per_booking}
              />
            </section>
            {error && !detailsOpen && <p className="booking-inline-error">{error}</p>}
          </div>

        </div>

        <footer className="booking-selection-bar">
          <div>
            <strong>{selectedSeats.length} {selectedSeats.length === 1 ? "Seat" : "Seats"} Selected</strong>
            <span>{selectedSeats.length ? selectedSeats.map((seat) => seat.seat_number).join(", ") : "Choose your seats"}</span>
          </div>
          <div className="booking-total"><strong>₹{total.toFixed(2)}</strong><span>View Details</span></div>
          <button type="button" disabled={!selectedSeats.length} onClick={() => { setError(""); setDetailsOpen(true); }}>
            Continue <ChevronRight />
          </button>
        </footer>
      </main>

      {detailsOpen && (
        <div className="booking-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsOpen(false); }}>
          <form className="booking-details-modal" onSubmit={beginCheckout}>
            <div className="booking-modal-header"><div><span>Step 3 of 4</span><h2>Your details</h2></div><button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close"><X /></button></div>
            <Input label="Full name" required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            <Input label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            <Input label="Phone (optional)" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
            <div className="booking-modal-summary"><span>{selectedSeats.map((seat) => seat.seat_number).join(", ")} · Includes fees and tax</span><strong>₹{total.toFixed(2)}</strong></div>
            {error && <p className="booking-inline-error">{error}</p>}
            <button className="booking-checkout-button" type="submit" disabled={submitting || !name.trim() || !email.trim()}>
              <ShieldCheck /> {submitting ? "Holding seats..." : "Continue to payment"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
