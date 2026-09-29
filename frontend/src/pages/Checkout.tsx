import { ArrowLeft, Clock3, CreditCard, ShieldCheck } from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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
  const refreshPayment = useMutation(api.paymentState.refresh);
  const checkout = useMemo(() => {
    const candidate = loadCheckoutState(location.state);
    const requested = new URLSearchParams(location.hash.slice(1)).get("session");
    return requested && candidate?.checkout_session.id !== requested ? null : candidate;
  }, [location.state, location.hash]);
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsRemaining(checkout));
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const opening = useRef(false);
  const hash = useMemo(() => new URLSearchParams(location.hash.slice(1)), [location.hash]);
  const sessionId = hash.get("session") || checkout?.checkout_session.id;
  const accessToken = hash.get("token") || checkout?.checkout_session.access_token;
  const credentials = sessionId && accessToken ? { sessionId: sessionId as Id<"checkoutSessions">, accessToken } : null;
  const paymentState = useQuery(api.paymentState.status, credentials ?? "skip");

  useEffect(() => {
    if (checkout?.checkout_session.access_token && !hash.get("session")) {
      const params = new URLSearchParams({ session: checkout.checkout_session.id, token: checkout.checkout_session.access_token });
      navigate({ pathname: "/checkout", hash: params.toString() }, { replace: true, state: location.state });
    }
  }, [checkout, hash, location.state, navigate]);

  useEffect(() => {
    if (!sessionId || !accessToken) return;
    const refresh = () => { void refreshPayment({ sessionId: sessionId as Id<"checkoutSessions">, accessToken }).catch(() => {}); };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [sessionId, accessToken, refreshPayment]);

  useEffect(() => {
    if (!paymentState?.bookingCode) return;
    sessionStorage.removeItem("aravalli.checkout");
    sessionStorage.setItem(`aravalli.booking.email.${paymentState.bookingCode}`, paymentState.customerEmail);
    navigate(`/confirmation/${paymentState.bookingCode}`, { replace: true, state: { email: paymentState.customerEmail } });
  }, [paymentState, navigate]);

  const statusMessage = paymentState === null
    ? "This payment status link is invalid. Please contact the auditorium."
    : paymentState?.status === "refunded"
    ? "Your payment was refunded. Your bank may take additional time to show the credit."
    : paymentState?.status === "review" || paymentState?.needsAttention
        ? "Your payment needs review. Please contact the auditorium."
      : paymentState?.status === "refund_pending"
        ? "Your refund is being processed."
        : paymentState?.status === "expired" || paymentState?.status === "failed"
            ? "The seat hold expired. Any captured payment without a ticket will be refunded."
          : paymentState?.status === "capturing" || verifying
            ? "Confirming your payment…"
            : "Your payment is processing…";

  const paymentMessage = <p className="mt-4 text-center text-sm text-slate-400" role="status">{statusMessage}</p>;

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
          <h1 className="text-2xl font-black text-white">{credentials ? "Payment status" : "Checkout session not found"}</h1>
          {credentials ? paymentMessage : <p className="mt-3 text-slate-400">Choose your seats again to start a new checkout.</p>}
          {error && <p className="mt-3 text-rose-300">{error}</p>}
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
    if (!razorpayLoaded || expired || opening.current || !credentials || paymentState?.status !== "pending") return;
    opening.current = true;
    setPaymentOpen(true);
    setError("");

    try {
      const razorpay = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
        amount: order.amount,
        currency: order.currency,
        name: "Aravalli Auditorium",
        description: `${show.title} · ${seats.map((seat) => seat.seat_number).join(", ")}`,
        order_id: order.id,
        timeout: getSecondsRemaining(checkout),
        retry: { enabled: false },
        prefill: {
          name: session.customer_name,
          email: session.customer_email,
          contact: session.customer_phone || "",
        },
        theme: { color: "#8B5CF6" },
        modal: { ondismiss: () => {
          opening.current = false;
          setPaymentOpen(false);
          setError("Payment window closed. Any payment already started is still being checked.");
          void refreshPayment(credentials).catch(() => {});
        } },
        handler: async (response: RazorpaySuccessResponse) => {
          setVerifying(true);
          try {
            await verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              checkoutSessionId: session.id as Id<"checkoutSessions">,
            });
          } catch (reason) {
            setError((reason as Error).message);
          } finally {
            opening.current = false;
            setPaymentOpen(false);
            void refreshPayment(credentials).catch(() => {});
          }
        },
      });
      razorpay.on("payment.failed", () => {
        setError("The payment attempt did not complete. Its final status is still being checked.");
        setVerifying(true);
        void refreshPayment(credentials).catch(() => {});
      });
      razorpay.open();
    }
    catch { opening.current = false; setPaymentOpen(false); setError("Unable to open payment. Please try again."); }
  };

  if (verifying || (paymentState && paymentState.status !== "pending")) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[rgb(var(--booking-background))] px-5 text-center">
        {(paymentState?.status === "pending" || paymentState?.status === "capturing") && <Spinner size="lg" />}
        <h1 className="text-xl font-bold text-white">Payment status</h1>
        <div className="w-full max-w-lg">{paymentMessage}</div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <Button variant="secondary" onClick={() => navigate("/")}>Return home</Button>
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
            <p className="text-xs font-semibold text-slate-500">Booking email</p>
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
            <div className="flex justify-between gap-4"><dt>Payment fee</dt><dd>INR {Number(session.payment_fee).toFixed(2)}</dd></div>
            <div className="flex justify-between gap-4 border-t border-[rgb(var(--booking-border)/0.13)] pt-4 text-lg font-black text-white">
              <dt>Total</dt><dd className="text-[rgb(var(--booking-accent-text))]">INR {Number(session.total_amount).toFixed(2)}</dd>
            </div>
          </dl>

          {error && <p className="mt-4 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs leading-5 text-rose-300">{error}</p>}
          {!credentials && <p className="mt-3 text-rose-300">This checkout was created before the payment update. Start a new booking; contact the auditorium if you already paid.</p>}
          <Button onClick={openPayment} disabled={!razorpayLoaded || expired || paymentOpen || !credentials || paymentState?.status !== "pending"} className="mt-5 w-full gap-2 py-3">
            <CreditCard className="h-4 w-4" /> {razorpayLoaded ? "Pay with Razorpay" : "Loading payment…"}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-500"><ShieldCheck className="h-3 w-3" /> Payment verified securely</p>
        </Card>
      </main>
    </div>
  );
}
