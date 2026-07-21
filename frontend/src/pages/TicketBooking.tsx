import { Info, RefreshCw, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
      const availableIds = new Set(
        availability.seats.filter((seat) => seat.availability === "available").map((seat) => seat.id),
      );
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
  const fee = selectedSeats.length * Number(settings?.convenience_fee_per_seat || 0);
  const gst = (subtotal + fee) * (Number(settings?.gst_percentage || 0) / 100);
  const total = subtotal + fee + gst;

  const toggleSeat = (seatId: string) => {
    setError("");
    setSelectedIds((current) =>
      current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId],
    );
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

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;
  if (!show || !settings) return <div className="mx-auto max-w-2xl px-5 py-20 text-center text-rose-300">{error || "Booking is unavailable."}</div>;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 md:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">{show.title}</p>
          <h1 className="mt-2 text-3xl font-black text-white">Choose your seats</h1>
          <p className="mt-2 text-sm text-slate-400">{show.date} at {show.time.slice(0, 5)} · Maximum {settings.max_seats_per_booking} seats</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refreshAvailability()} disabled={refreshing} className="gap-2 self-start">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh seats
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <Card><SeatMap seats={seats} selectedSeatIds={selectedIds} onSeatSelect={toggleSeat} maxSelectable={settings.max_seats_per_booking} /></Card>

        <form onSubmit={beginCheckout} className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-4">
            <h2 className="font-extrabold text-white">Your details</h2>
            <Input label="Full name" required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            <Input label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            <Input label="Phone (optional)" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
            <p className="flex gap-2 rounded-lg bg-slate-900 p-3 text-xs leading-5 text-slate-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> No account required. Your email and booking code retrieve the ticket.
            </p>
          </Card>

          <Card>
            <h2 className="font-extrabold text-white">Order summary</h2>
            <p className="mt-3 min-h-5 text-sm font-semibold text-amber-400">
              {selectedSeats.length ? selectedSeats.map((seat) => seat.seat_number).join(", ") : "No seats selected"}
            </p>
            <div className="mt-5 space-y-2 border-t border-slate-800 pt-4 text-sm text-slate-400">
              <p className="flex justify-between"><span>Seats</span><span>INR {subtotal.toFixed(2)}</span></p>
              <p className="flex justify-between"><span>Convenience fee</span><span>INR {fee.toFixed(2)}</span></p>
              <p className="flex justify-between"><span>GST</span><span>INR {gst.toFixed(2)}</span></p>
              <p className="flex justify-between border-t border-slate-800 pt-3 text-base font-black text-white"><span>Total</span><span className="text-amber-400">INR {total.toFixed(2)}</span></p>
            </div>

            {error && <p className="mt-4 rounded-lg border border-rose-900 bg-rose-950/20 p-3 text-xs text-rose-300">{error}</p>}
            <Button type="submit" className="mt-5 w-full gap-2" disabled={submitting || !name.trim() || !email.trim() || selectedIds.length === 0}>
              <ShieldCheck className="h-4 w-4" /> {submitting ? "Holding seats…" : "Hold seats & continue"}
            </Button>
          </Card>
        </form>
      </div>
    </div>
  );
}
