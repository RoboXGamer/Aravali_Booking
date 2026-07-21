import { ArrowLeft, Clock3, CreditCard, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import { useRazorpay } from "../hooks/useRazorpay";
import { api } from "../services/api";
import type { CheckoutResponse, PaymentVerificationResponse, RazorpaySuccessResponse, Show } from "../types";

interface CheckoutState extends CheckoutResponse {
  show: Show;
}

function loadCheckoutState(locationState: unknown): CheckoutState | null {
  if (locationState) return locationState as CheckoutState;
  const saved = sessionStorage.getItem("aravalli.checkout");
  if (!saved) return null;
  try {
    return JSON.parse(saved) as CheckoutState;
  } catch {
    return null;
  }
}

export function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const razorpayLoaded = useRazorpay();
  const checkout = useMemo(() => loadCheckoutState(location.state), [location.state]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!checkout) return;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((new Date(checkout.checkout_session.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [checkout]);

  if (!checkout) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <h1 className="text-2xl font-black text-white">Checkout session not found</h1>
        <p className="mt-3 text-slate-400">Choose your seats again to start a new checkout.</p>
        <Button className="mt-6" onClick={() => navigate("/shows")}>View showtimes</Button>
      </div>
    );
  }

  const { checkout_session: session, razorpay_order: order, selected_seats: seats, show } = checkout;
  const expired = secondsLeft === 0;
  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  const openPayment = () => {
    if (!razorpayLoaded || expired) return;
    setError("");

    const razorpay = new window.Razorpay({
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
      amount: order.amount,
      currency: order.currency,
      name: "Aravalli Auditorium",
      description: `${show.title} · ${seats.map((seat) => seat.seat_number).join(", ")}`,
      order_id: order.id,
      prefill: {
        name: session.customer_name,
        email: session.customer_email,
        contact: session.customer_phone || "",
      },
      theme: { color: "#D4AF37" },
      modal: { ondismiss: () => setError("Payment window closed. Your seats remain held until the timer expires.") },
      handler: async (response: RazorpaySuccessResponse) => {
        setVerifying(true);
        try {
          const verified = await api.post<PaymentVerificationResponse>("/api/bookings/verify", {
            ...response,
            checkout_session_id: session.id,
          });
          sessionStorage.removeItem("aravalli.checkout");
          sessionStorage.setItem(`aravalli.booking.email.${verified.booking_code}`, session.customer_email);
          navigate(`/confirmation/${verified.booking_code}`, {
            replace: true,
            state: { booking: verified.booking, email: session.customer_email },
          });
        } catch (reason) {
          setError((reason as Error).message);
          setVerifying(false);
        }
      },
    });
    razorpay.open();
  };

  if (verifying) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-5 text-center">
        <Spinner size="lg" />
        <h1 className="text-xl font-bold text-white">Confirming your booking</h1>
        <p className="text-sm text-slate-400">Do not close or refresh this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <button onClick={() => navigate(`/book/${show.id}`)} className="mb-7 flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Change seats
      </button>

      <div className="grid gap-7 md:grid-cols-[1fr_340px]">
        <Card>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Secure checkout</p>
          <h1 className="mt-2 text-3xl font-black text-white">Review and pay</h1>

          <div className="mt-7 space-y-5 border-t border-slate-800 pt-6">
            <div><p className="text-xs text-slate-500">Movie</p><p className="mt-1 font-bold text-white">{show.title}</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-500">Showtime</p><p className="mt-1 text-sm text-slate-200">{show.date} · {show.time.slice(0, 5)}</p></div>
              <div><p className="text-xs text-slate-500">Seats</p><p className="mt-1 text-sm font-bold text-amber-400">{seats.map((seat) => seat.seat_number).join(", ")}</p></div>
            </div>
            <div><p className="text-xs text-slate-500">Ticket email</p><p className="mt-1 text-sm text-slate-200">{session.customer_email}</p></div>
          </div>
        </Card>

        <Card className="self-start">
          <div className={`flex items-center justify-between rounded-xl p-3 ${expired ? "bg-rose-950/40 text-rose-300" : "bg-amber-500/10 text-amber-300"}`}>
            <span className="flex items-center gap-2 text-xs font-bold"><Clock3 className="h-4 w-4" /> Seat hold</span>
            <span className="font-mono text-lg font-black">{expired ? "Expired" : `${minutes}:${seconds}`}</span>
          </div>

          <div className="mt-6 space-y-2 text-sm text-slate-400">
            <p className="flex justify-between"><span>Tickets</span><span>INR {Number(session.subtotal).toFixed(2)}</span></p>
            <p className="flex justify-between"><span>Payment fee</span><span>INR {Number(session.convenience_fee).toFixed(2)}</span></p>
            <p className="flex justify-between text-lg font-black text-white"><span>Total</span><span className="text-amber-400">INR {Number(session.total_amount).toFixed(2)}</span></p>
          </div>

          {error && <p className="mt-4 rounded-lg border border-rose-900 bg-rose-950/20 p-3 text-xs leading-5 text-rose-300">{error}</p>}
          <Button onClick={openPayment} disabled={!razorpayLoaded || expired} className="mt-6 w-full gap-2 py-3">
            <CreditCard className="h-4 w-4" /> {razorpayLoaded ? "Pay with Razorpay" : "Loading payment…"}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-500"><ShieldCheck className="h-3 w-3" /> Payment verified securely</p>
        </Card>
      </div>
    </div>
  );
}
