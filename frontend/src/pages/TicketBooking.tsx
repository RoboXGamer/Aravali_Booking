import { ArrowLeft, CalendarDays, ChevronRight, CircleAlert, Clock3, MapPin, ShieldCheck, Ticket, X } from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Input } from "../components/common/Input";
import { SeatControls, SeatMap } from "../components/common/SeatMap";
import { Spinner } from "../components/common/Spinner";
import { auditoriumToday } from "../lib/auditoriumDate";
import type { BookingCategory, Seat } from "../types";

export function TicketBooking({ adminMode = false }: { adminMode?: boolean }) {
  const { event_id } = useParams();
  const navigate = useNavigate();
  const today = auditoriumToday();
  const show = useQuery(api.events.getById, event_id ? { showId: event_id as Id<"shows">, today } : "skip");
  const settings = useQuery(api.bookings.getBookingSettings);
  const availability = useQuery(api.bookings.getAvailability, event_id ? { showId: event_id as Id<"shows">, today } : "skip");
  const createCheckout = useAction(api.payments.createCheckout);
  const createAdminBooking = useMutation(api.bookings.createAdminBooking);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<BookingCategory | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!availability) return;
    setSeats(availability.seats as Seat[]);
    const availableIds = new Set<string>(availability.seats.filter((seat) => seat.availability === "available").map((seat) => seat.id));
    setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
  }, [availability]);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  const selectedSeats = useMemo(() => seats.filter((seat) => selectedIds.includes(seat.id)), [seats, selectedIds]);
  const selectedTicketCategory = settings?.ticket_categories.find((category) => category.id === selectedCategory) ?? null;
  const subtotal = selectedSeats.length * (selectedTicketCategory?.price ?? 0);
  const paymentFee = !adminMode && settings ? Math.round((subtotal * Number(settings.razorpay_fee_percentage) / 100) * 100) / 100 : 0;
  const total = subtotal + paymentFee;

  const toggleSeat = (seatId: string) => {
    setError("");
    setSelectedIds((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);
  };

  const chooseCategory = (category: BookingCategory | null) => {
    setError("");
    setSelectedCategory(category);
    const physicalCategory = settings?.ticket_categories.find((option) => option.id === category)?.seat_category;
    setSelectedIds((current) => physicalCategory
      ? current.filter((id) => seats.find((seat) => seat.id === id)?.category_name === physicalCategory)
      : []);
  };

  const showCategoryGuidance = (seat: Seat) => {
    const message = selectedCategory
      ? `This seat is in the ${seat.category_name} section. Choose a matching category to unlock it.`
      : "Choose a ticket category first, then select your seats.";
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 3500);

    window.requestAnimationFrame(() => {
      const selectors = Array.from(
        document.querySelectorAll<HTMLElement>("[data-category-selector]"),
      );
      const selector = selectors.find((element) => element.getClientRects().length > 0);
      if (!selector) return;
      selector.scrollIntoView({ behavior: "smooth", block: "center" });
      selector.classList.remove("is-attention");
      void selector.offsetWidth;
      selector.classList.add("is-attention");
      window.setTimeout(() => selector.classList.remove("is-attention"), 1400);
      window.setTimeout(() => selector.querySelector<HTMLButtonElement>("button")?.focus(), 450);
    });
  };

  const beginCheckout = async (event: FormEvent) => {
    event.preventDefault();
    if (!show || !settings || !selectedCategory || selectedIds.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      if (adminMode) {
        const booking = await createAdminBooking({
          showId: show.id as Id<"shows">,
          customerName: name.trim(),
          customerEmail: email.trim().toLowerCase(),
          customerPhone: phone.trim() || null,
          seatIds: selectedIds as Id<"seats">[],
          bookingCategory: selectedCategory!,
          now: Date.now(),
        });
        sessionStorage.setItem(`aravalli.booking.email.${booking.bookingCode}`, booking.email);
        const returnTo = "/admin/bookings/reservations";
        sessionStorage.setItem(`aravalli.booking.returnTo.${booking.bookingCode}`, returnTo);
        navigate(`/confirmation/${booking.bookingCode}`, {
          state: { email: booking.email, returnTo },
        });
        return;
      }

      const checkout = await createCheckout({
        showId: show.id as Id<"shows">,
        customerName: name.trim(),
        customerEmail: email.trim().toLowerCase(),
        customerPhone: phone.trim() || null,
        seatIds: selectedIds as Id<"seats">[],
        bookingCategory: selectedCategory!,
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
                categories={settings.ticket_categories}
                selectedCategory={selectedCategory}
                onCategorySelect={chooseCategory}
                onSeatSelect={toggleSeat}
                onCategoryRequired={showCategoryGuidance}
                maxSelectable={settings.max_seats_per_booking}
              />
            </section>
            {error && !detailsOpen && <p className="booking-inline-error">{error}</p>}
          </div>

          <SeatControls
            className="booking-desktop-sidebar"
            categories={settings.ticket_categories}
            selectedCategory={selectedCategory}
            onCategorySelect={chooseCategory}
            footer={(
              <div className="booking-desktop-summary">
                <div>
                  <strong>{selectedSeats.length} {selectedSeats.length === 1 ? "Seat" : "Seats"} Selected</strong>
                  {selectedSeats.length > 0 && <span>{selectedSeats.map((seat) => seat.seat_number).join(", ")}</span>}
                </div>
                <div className="booking-desktop-total">
                  <strong>₹{total.toFixed(2)}</strong>
                </div>
                <button type="button" disabled={!selectedSeats.length || !selectedCategory} onClick={() => { setError(""); setDetailsOpen(true); }}>
                  Continue <ChevronRight />
                </button>
              </div>
            )}
          />
        </div>

        <footer className="booking-selection-bar">
          <div>
            <strong>{selectedSeats.length} {selectedSeats.length === 1 ? "Seat" : "Seats"} Selected</strong>
            <span>{selectedSeats.length ? selectedSeats.map((seat) => seat.seat_number).join(", ") : "Choose your seats"}</span>
          </div>
          <div className="booking-total"><strong>₹{total.toFixed(2)}</strong></div>
          <button type="button" disabled={!selectedSeats.length || !selectedCategory} onClick={() => { setError(""); setDetailsOpen(true); }}>
            Continue <ChevronRight />
          </button>
        </footer>
      </main>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-4 z-[80] flex w-[calc(100%-32px)] max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border border-violet-400/35 bg-slate-950/95 px-4 py-3 text-sm font-semibold text-slate-100 shadow-2xl shadow-black/50 backdrop-blur"
        >
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast("")} aria-label="Dismiss message" className="ml-auto text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {detailsOpen && (
        <div className="booking-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsOpen(false); }}>
          <form className="booking-details-modal" onSubmit={beginCheckout}>
            <div className="booking-modal-header"><div><span>{adminMode ? "Final step" : "Step 3 of 4"}</span><h2>Your details</h2></div><button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close"><X /></button></div>
            <Input label="Full name" required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            <Input label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            <Input label="Phone (optional)" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
            <div className="booking-modal-summary"><span>{selectedSeats.map((seat) => seat.seat_number).join(", ")} · {selectedCategory} · {adminMode ? "No online payment required" : "Includes payment fee"}</span><strong>₹{total.toFixed(2)}</strong></div>
            {error && <p className="booking-inline-error">{error}</p>}
            <button className="booking-checkout-button" type="submit" disabled={submitting || !name.trim() || !email.trim()}>
              <ShieldCheck /> {submitting ? (adminMode ? "Confirming booking..." : "Holding seats...") : (adminMode ? "Confirm booking" : "Continue to payment")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
