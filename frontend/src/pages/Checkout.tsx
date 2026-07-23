import { ArrowLeft, Clock3, CreditCard, ShieldCheck } from "lucide-react";
import { useAction } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import { useRazorpay } from "../hooks/useRazorpay";
import type { CheckoutResponse, RazorpaySuccessResponse, Show } from "../types";

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

function getSecondsRemaining(checkout: CheckoutState | null) {
  if (!checkout) return 0;
  return Math.max(0, Math.ceil((new Date(checkout.checkout_session.expires_at).getTime() - Date.now()) / 1000));
}

export function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const razorpayLoaded = useRazorpay();
  const verifyPayment = useAction(api.payments.verify);
  const checkout = useMemo(() => loadCheckoutState(location.state), [location.state]);
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsRemaining(checkout));
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!checkout) return;
    const updateCountdown = () => setSecondsLeft(getSecondsRemaining(checkout));
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [checkout]);

  if (!checkout) {
    return (
      <div className="grid min-h-screen place-items-center bg-[rgb(var(--booking-background))] px-5 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-black text-white">Checkout session not found</h1>
          <p className="mt-3 text-slate-400">Choose your seats again to start a new checkout.</p>
          <Button className="mt-6" onClick={() => navigate("/")}>Return home</Button>
        </div>
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
      theme: { color: "#8B5CF6" },
      modal: { ondismiss: () => setError("Payment window closed. Your seats remain held until the timer expires.") },
      handler: async (response: RazorpaySuccessResponse) => {
        setVerifying(true);
        try {
          const verified = await verifyPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            checkoutSessionId: session.id as Id<"checkoutSessions">,
          });
          sessionStorage.removeItem("aravalli.checkout");
          sessionStorage.setItem(`aravalli.booking.email.${verified.booking_code}`, session.customer_email);
          navigate(`/confirmation/${verified.booking_code}`, {
            replace: true,
            state: { email: session.customer_email },
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[rgb(var(--booking-background))] px-5 text-center">
        <Spinner size="lg" />
        <h1 className="text-xl font-bold text-white">Confirming your booking</h1>
        <p className="text-sm text-slate-400">Do not close or refresh this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgb(var(--booking-selected-start)/0.13),transparent_38%),rgb(var(--booking-background))]">
      <header className="grid min-h-12 grid-cols-[36px_1fr_36px] items-center border-b border-[rgb(var(--booking-border)/0.13)] bg-[rgb(var(--booking-panel)/0.88)] px-4 backdrop-blur md:min-h-14 md:grid-cols-[40px_1fr_40px] md:px-8">
        <button
          type="button"
          onClick={() => navigate(`/book/${show.id}`)}
          aria-label="Change seats"
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 transition hover:bg-[rgb(var(--booking-surface))] hover:text-white md:h-10 md:w-10"
        >
          <ArrowLeft className="h-[18px] w-[18px] md:h-5 md:w-5" />
        </button>
        <h1 className="text-center text-sm font-extrabold text-white">Checkout</h1>
        <span aria-hidden="true" />
      </header>

      <main className="mx-auto grid max-w-6xl items-start gap-4 px-4 py-4 md:gap-6 md:px-8 md:py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 px-1 md:py-2">
          <div className="flex items-stretch gap-4 md:gap-6">
            <img
              src={show.poster_url || "https://placehold.co/180x270/0c1522/FFFFFF?text=Movie"}
              alt={show.title}
              className="h-auto w-24 flex-none self-stretch rounded-lg border border-[rgb(var(--color-brand)/0.38)] object-cover shadow-lg md:w-[116px]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">Movie</p>
              <h2 className="mt-1 text-xl font-extrabold text-white md:text-2xl">{show.title}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">{show.venue}</p>

              <dl className="mt-3 grid gap-3 sm:grid-cols-2 md:mt-4">
                <div>
                  <dt className="text-xs text-slate-500">Showtime</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-200">{show.date} · {show.time.slice(0, 5)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Seats</dt>
                  <dd className="mt-1 text-sm font-bold text-[rgb(var(--booking-accent-text))]">{seats.map((seat) => seat.seat_number).join(", ")}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-4 border-t border-[rgb(var(--booking-border)/0.13)] pt-3">
            <p className="text-xs font-semibold text-slate-500">Ticket delivery</p>
            <p className="mt-1 break-all text-sm text-slate-100">{session.customer_email}</p>
          </div>
        </section>

        <Card className="self-start p-4 md:p-5">
          <h2 className="text-base font-extrabold text-white">Payment summary</h2>
          <div className={`mt-3 flex items-center justify-between rounded-xl border p-3 ${expired ? "border-rose-500/25 bg-rose-500/10 text-rose-300" : "border-[rgb(var(--booking-selected-end)/0.27)] bg-[rgb(var(--booking-accent-start)/0.17)] text-[rgb(var(--booking-accent-text))]"}`}>
            <span className="flex items-center gap-2 text-xs font-bold"><Clock3 className="h-4 w-4" /> Seat hold</span>
            <span className="font-mono text-lg font-black">{expired ? "Expired" : `${minutes}:${seconds}`}</span>
          </div>

          <dl className="mt-4 space-y-2.5 text-sm text-slate-400">
            <div className="flex justify-between gap-4"><dt>Tickets</dt><dd>INR {Number(session.subtotal).toFixed(2)}</dd></div>
            <div className="flex justify-between gap-4"><dt>Payment fee</dt><dd>INR {Number(session.convenience_fee).toFixed(2)}</dd></div>
            <div className="flex justify-between gap-4 border-t border-[rgb(var(--booking-border)/0.13)] pt-4 text-lg font-black text-white">
              <dt>Total</dt><dd className="text-[rgb(var(--booking-accent-text))]">INR {Number(session.total_amount).toFixed(2)}</dd>
            </div>
          </dl>

          {error && <p className="mt-4 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs leading-5 text-rose-300">{error}</p>}
          <Button onClick={openPayment} disabled={!razorpayLoaded || expired} className="mt-5 w-full gap-2 py-3">
            <CreditCard className="h-4 w-4" /> {razorpayLoaded ? "Pay with Razorpay" : "Loading payment…"}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-500"><ShieldCheck className="h-3 w-3" /> Payment verified securely</p>
        </Card>
      </main>
    </div>
  );
}
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
