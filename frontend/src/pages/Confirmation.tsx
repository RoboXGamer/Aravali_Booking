import { CheckCircle2, Download, Printer, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import { api } from "../services/api";
import type { Booking } from "../types";

interface ConfirmationState {
  booking?: Booking;
  email?: string;
}

export function Confirmation() {
  const { booking_code } = useParams();
  const location = useLocation();
  const routeState = (location.state || {}) as ConfirmationState;
  const storedEmail = booking_code ? sessionStorage.getItem(`aravalli.booking.email.${booking_code}`) : null;
  const email = routeState.email || storedEmail || "";
  const [booking, setBooking] = useState<Booking | null>(routeState.booking || null);
  const [loading, setLoading] = useState(!routeState.booking && Boolean(email));
  const [error, setError] = useState("");

  useEffect(() => {
    if (booking || !booking_code || !email) return;
    api.get<Booking>(`/api/bookings/${encodeURIComponent(booking_code)}?email=${encodeURIComponent(email)}`)
      .then(setBooking)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [booking, booking_code, email]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;
  if (!booking || !booking_code || !email) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <Search className="mx-auto h-8 w-8 text-amber-400" />
        <h1 className="mt-4 text-2xl font-black text-white">Retrieve your booking</h1>
        <p className="mt-2 text-slate-400">{error || "Use your booking code and email address to reopen this ticket."}</p>
        <Link to="/find-booking"><Button className="mt-6">Find booking</Button></Link>
      </div>
    );
  }

  const seats = booking.booking_seats.map((seat) => seat.seat_number).join(", ");
  const movieTitle = booking.shows?.movies?.title || "Aravalli Screening";
  const download = () => window.open(api.getDownloadUrl(booking.booking_code, email), "_blank", "noopener,noreferrer");

  return (
    <div className="mx-auto max-w-2xl px-5 py-14 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" />
      <h1 className="mt-5 text-3xl font-black text-white">Booking confirmed</h1>
      <p className="mt-2 text-slate-400">Your seats are confirmed and your ticket is ready.</p>

      <Card className="mt-8 text-left">
        <div className="flex flex-col justify-between gap-5 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
          <div><p className="text-xs text-slate-500">Movie</p><p className="mt-1 text-xl font-black text-white">{movieTitle}</p></div>
          <div className="sm:text-right"><p className="text-xs text-slate-500">Booking code</p><p className="mt-1 font-mono font-black text-amber-400">{booking.booking_code}</p></div>
        </div>
        <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
          <div><p className="text-slate-500">Date and time</p><p className="mt-1 font-semibold text-white">{booking.shows.date} · {booking.shows.time.slice(0, 5)}</p></div>
          <div><p className="text-slate-500">Seats</p><p className="mt-1 font-semibold text-white">{seats}</p></div>
          <div><p className="text-slate-500">Email</p><p className="mt-1 font-semibold text-white">{booking.customer_email}</p></div>
          <div><p className="text-slate-500">Amount paid</p><p className="mt-1 font-semibold text-white">INR {Number(booking.total_amount).toFixed(2)}</p></div>
        </div>
      </Card>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button onClick={download} className="gap-2"><Download className="h-4 w-4" /> Download ticket</Button>
        <Button onClick={() => window.print()} variant="secondary" className="gap-2"><Printer className="h-4 w-4" /> Print page</Button>
      </div>
    </div>
  );
}
