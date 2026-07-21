import { Armchair, ArrowLeft, CalendarDays, ChevronDown, ChevronRight, Clock3, MapPin, RefreshCw, ShieldCheck, Ticket, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Input } from "../components/common/Input";
import { SeatMap } from "../components/common/SeatMap";
import { Spinner } from "../components/common/Spinner";
import { api } from "../services/api";
import type { AvailabilityResponse, BookingSettings, CheckoutResponse, Seat, Show } from "../types";

export function TicketBooking() {
  const { event_id } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState<Show | null>(null);
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Seat["category_name"] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const refreshAvailability = async (quiet = false) => {
    if (!event_id) return;
    if (!quiet) setRefreshing(true);
    try {
      const availability = await api.get<AvailabilityResponse>(`/api/bookings/availability/${event_id}`);
      setSeats(availability.seats);
      const availableIds = new Set(availability.seats.filter((seat) => seat.availability === "available").map((seat) => seat.id));
      setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
    } catch (reason) {
      if (!quiet) setError((reason as Error).message);
    } finally {
      if (!quiet) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!event_id) return;
    Promise.all([
      api.get<Show>(`/api/events/${event_id}`),
      api.get<BookingSettings>("/api/bookings/settings"),
      api.get<AvailabilityResponse>(`/api/bookings/availability/${event_id}`),
    ])
      .then(([showData, settingData, availability]) => {
        setShow(showData);
        setSettings(settingData);
        setSeats(availability.seats);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));

    const refreshTimer = window.setInterval(() => void refreshAvailability(true), 5000);
    return () => window.clearInterval(refreshTimer);
  }, [event_id]);

  const selectedSeats = useMemo(() => seats.filter((seat) => selectedIds.includes(seat.id)), [seats, selectedIds]);
  const subtotal = selectedSeats.reduce((sum, seat) => sum + Number(seat.price), 0);
  const razorpayFee = settings ? Math.round((subtotal * Number(settings.razorpay_fee_percentage) / 100) * 100) / 100 : 0;
  const total = subtotal + razorpayFee;

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
      const checkout = await api.post<CheckoutResponse>("/api/bookings/checkout-sessions", {
        show_id: show.id,
        customer_name: name.trim(),
        customer_email: email.trim().toLowerCase(),
        customer_phone: phone.trim() || null,
        seat_layout_ids: selectedIds,
      });
      const checkoutState = { ...checkout, show };
      sessionStorage.setItem("aravalli.checkout", JSON.stringify(checkoutState));
      navigate("/checkout", { state: checkoutState });
    } catch (reason) {
      setError((reason as Error).message);
      await refreshAvailability(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner size="lg" /></div>;
  if (!show || !settings) return <div className="mx-auto max-w-2xl px-5 py-20 text-center text-rose-300">{error || "Booking is unavailable."}</div>;

  const formattedDate = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${show.date}T00:00:00`));

  return (
    <div className="booking-page">
      <main className="booking-panel">
        <header className="booking-header">
          <button type="button" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft /></button>
          <h1>Select Seats</h1>
          <button type="button" onClick={() => void refreshAvailability()} disabled={refreshing} aria-label="Refresh seats"><RefreshCw className={refreshing ? "animate-spin" : ""} /></button>
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

          <aside className="booking-sidebar">
            <div className="booking-sidebar-summary">
              <div><strong>Your Selection</strong><span>{selectedSeats.length} Seats</span></div>
              <div><strong>Total</strong><strong>₹{total.toFixed(2)}</strong></div>
              <button type="button">View Details <ChevronDown /></button>
            </div>
            <div className="booking-benefits">
              <div><i><Ticket /></i><p><strong>Select your seats</strong><span>Tap on any available seat</span></p></div>
              <div><i><Armchair /></i><p><strong>{selectedCategory ? `${selectedCategory} Category` : "Choose Category"}</strong><span>{selectedCategory ? "Comfortable & great view" : "Gold, Silver or Bronze"}</span></p></div>
              <div><i><ShieldCheck /></i><p><strong>Secure Booking</strong><span>Your seats are reserved during checkout</span></p></div>
            </div>
          </aside>
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
            <div className="booking-modal-summary"><span>{selectedSeats.map((seat) => seat.seat_number).join(", ")} · Includes {Number(settings.razorpay_fee_percentage)}% payment fee</span><strong>₹{total.toFixed(2)}</strong></div>
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
