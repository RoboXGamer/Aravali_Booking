import { Download, Search } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { api } from "../services/api";
import type { Booking } from "../types";

export function BookingLookup() {
  const [bookingCode, setBookingCode] = useState("");
  const [email, setEmail] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lookup = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setBooking(null);
    try {
      const result = await api.post<Booking>("/api/bookings/lookup", {
        booking_code: bookingCode.trim().toUpperCase(),
        customer_email: email.trim().toLowerCase(),
      });
      setBooking(result);
      sessionStorage.setItem(`aravalli.booking.email.${result.booking_code}`, result.customer_email);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <div className="text-center">
        <Search className="mx-auto h-9 w-9 text-amber-400" />
        <h1 className="mt-4 text-3xl font-black text-white">Find your booking</h1>
        <p className="mt-2 text-slate-400">Enter the booking code and email used during checkout.</p>
      </div>

      <Card className="mt-8">
        <form onSubmit={lookup} className="space-y-4">
          <Input label="Booking code" required value={bookingCode} onChange={(event) => setBookingCode(event.target.value.toUpperCase())} placeholder="ARA2026…" />
          <Input label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          {error && <p className="rounded-lg border border-rose-900 bg-rose-950/20 p-3 text-xs text-rose-300">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Searching…" : "Find booking"}</Button>
        </form>
      </Card>

      {booking && (
        <Card className="mt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">Confirmed booking</p>
              <h2 className="mt-1 text-xl font-black text-white">{booking.shows.movies.title}</h2>
              <p className="mt-2 font-mono text-sm font-bold text-amber-400">{booking.booking_code}</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">{booking.status}</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-800 pt-5 text-sm">
            <div><p className="text-slate-500">Showtime</p><p className="mt-1 text-white">{booking.shows.date} · {booking.shows.time.slice(0, 5)}</p></div>
            <div><p className="text-slate-500">Seats</p><p className="mt-1 text-white">{booking.booking_seats.map((seat) => seat.seat_number).join(", ")}</p></div>
          </div>
          <Button onClick={() => window.open(api.getDownloadUrl(booking.booking_code, booking.customer_email), "_blank", "noopener,noreferrer")} className="mt-6 w-full gap-2">
            <Download className="h-4 w-4" /> Download ticket
          </Button>
        </Card>
      )}
    </div>
  );
}
