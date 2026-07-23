import { ArrowLeft, Download, Search } from "lucide-react";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import type { Booking } from "../types";
import "../confirmation.css";

interface ConfirmationState {
  booking?: Booking;
  email?: string;
}

export function Confirmation() {
  const { booking_code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = (location.state || {}) as ConfirmationState;
  const storedEmail = booking_code ? sessionStorage.getItem(`aravalli.booking.email.${booking_code}`) : null;
  const email = routeState.email || storedEmail || "";
  const fetchedBooking = useQuery(
    api.bookings.getByCode,
    !routeState.booking && booking_code && email ? { bookingCode: booking_code, email } : "skip",
  );
  const getQr = useAction(api.tickets.getQrDataUrl);
  const getPdf = useAction(api.tickets.getPdfBase64);
  const booking = routeState.booking || (fetchedBooking as Booking | null | undefined) || null;
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!booking || !booking_code || !email) return;
    let active = true;
    getQr({ bookingCode: booking_code, email })
      .then((url) => { if (active) setQrUrl(url); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [booking?.id, booking_code, email, getQr]);

  if (!routeState.booking && email && fetchedBooking === undefined) return <div className="ticket-loading"><Spinner size="lg" /></div>;
  if (!booking || !booking_code || !email) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <Search className="mx-auto h-8 w-8 text-[rgb(var(--booking-accent-text))]" />
        <h1 className="mt-4 text-2xl font-black text-white">Retrieve your booking</h1>
        <p className="mt-2 text-slate-400">{error || "Use your booking code and email address to reopen this ticket."}</p>
        <Link to="/"><Button className="mt-6">Return home</Button></Link>
      </div>
    );
  }

  const seats = booking.booking_seats.map((seat) => seat.seat_number).join(", ");
  const movieTitle = booking.shows?.movies?.title || "Aravalli Screening";
  const posterUrl = booking.shows?.movies?.poster_url || "https://placehold.co/220x330/0c1522/FFFFFF?text=Movie";
  const showDate = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${booking.shows.date}T00:00:00`));
  const [hours, minutes] = booking.shows.time.slice(0, 5).split(":").map(Number);
  const showTime = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(2000, 0, 1, hours, minutes));
  const download = async () => {
    try {
      const base64 = await getPdf({ bookingCode: booking.booking_code, email });
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Aravalli-${booking.booking_code}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError((reason as Error).message);
    }
  };

  return (
    <div className="ticket-page">
      <div className="ticket-shell">
        <header className="ticket-page-header">
          <button type="button" onClick={() => navigate("/")} aria-label="Back to home" className="ticket-header-button ticket-back-button">
            <ArrowLeft />
          </button>
          <h1>Your Ticket</h1>
          <button type="button" onClick={download} aria-label="Download ticket" className="ticket-header-button ticket-download-button">
            <Download />
          </button>
        </header>

        <p className="ticket-email-status">Booking confirmed for {booking.customer_email}</p>

        <article className="ticket-card">
          <section className="ticket-details-section">
            <div className="ticket-identity-row">
              <div className="ticket-brand">
                <span className="ticket-brand-mark">A</span>
                <span><strong>ARAVALLI</strong><small>AUDITORIUM</small></span>
              </div>
              <div className="ticket-booking-id">
                <span>Booking ID</span>
                <strong>{booking.booking_code}</strong>
              </div>
            </div>

            <div className="ticket-movie-grid">
              <img src={posterUrl} alt={movieTitle} className="ticket-poster" />
              <div className="ticket-movie-details">
                <h2>{movieTitle}</h2>
                <dl>
                  <div><dt>Date</dt><dd>{showDate}</dd></div>
                  <div><dt>Time</dt><dd>{showTime}</dd></div>
                  <div><dt>Screen</dt><dd>Screen 1</dd></div>
                  <div><dt>Seats</dt><dd>{seats}</dd></div>
                </dl>
              </div>
            </div>
          </section>

          <section className="ticket-qr-section">
            <span aria-hidden="true" className="ticket-notch ticket-notch-left" />
            <span aria-hidden="true" className="ticket-notch ticket-notch-right" />
            <div className="ticket-qr-frame">
              {qrUrl ? <img src={qrUrl} alt={`Entry QR code for booking ${booking.booking_code}`} /> : <Spinner />}
            </div>
            <p>Scan this QR at the entrance</p>
            <div className="ticket-total"><span>Total paid</span><strong>₹{Number(booking.total_amount).toFixed(2)}</strong></div>
          </section>

          <footer className="ticket-footer">Thank you! Enjoy the show 🎬</footer>
        </article>
      </div>
    </div>
  );
}
import { api } from "../../convex/_generated/api";
