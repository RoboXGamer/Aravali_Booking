import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Keyboard,
  Loader2,
  QrCode,
  ScanLine,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { adminBackend } from "../services/admin";

interface CheckInResult {
  status: string;
  booking_code: string;
  customer_name: string;
  checked_in_at: string;
}

interface CheckedInBooking {
  id: string;
  booking_code: string;
  customer_name: string;
  is_checked_in: boolean;
  checked_in_at: string | null;
  shows: {
    movies: { title: string };
  };
  booking_seats: Array<{ seat_number: string }>;
}

const formatCheckInTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));

export function AdminCheckIn() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanLockRef = useRef(false);
  const [bookingCode, setBookingCode] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recentBookings, setRecentBookings] = useState<CheckedInBooking[]>([]);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current !== null) window.clearInterval(scanTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current = null;
    scanTimerRef.current = null;
    setScanning(false);
  }, []);

  const loadRecentCheckIns = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const data = await adminBackend.loadSection("bookings");
      setRecentBookings(data.bookings as unknown as CheckedInBooking[]);
    } catch {
      // A failed history refresh should never prevent the scanner from being used.
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    void loadRecentCheckIns();
    return () => {
      if (scanTimerRef.current !== null) window.clearInterval(scanTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [loadRecentCheckIns]);

  const checkIn = useCallback(async (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode || scanLockRef.current) return;

    scanLockRef.current = true;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await adminBackend.bookings.checkIn(normalizedCode);
      setResult(response);
      setBookingCode("");
      setShowManualEntry(false);
      stopCamera();
      await loadRecentCheckIns();
    } catch (reason) {
      setError((reason as Error).message);
      stopCamera();
    } finally {
      scanLockRef.current = false;
      setLoading(false);
    }
  }, [loadRecentCheckIns, stopCamera]);

  const startCamera = async () => {
    setError("");
    setResult(null);
    setShowManualEntry(false);
    const Detector = window.BarcodeDetector;
    if (!Detector) {
      setError("QR scanning is not supported by this browser. Enter the booking code manually.");
      setShowManualEntry(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      setScanning(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new Detector({ formats: ["qr_code"] });
      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || scanLockRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) void checkIn(codes[0].rawValue);
        } catch {
          // Keep scanning; individual video-frame detection can occasionally fail.
        }
      }, 650);
    } catch {
      setError("Camera access failed. Allow camera permission or enter the booking code manually.");
      setShowManualEntry(true);
      stopCamera();
    }
  };

  const recentCheckIns = useMemo(
    () => recentBookings
      .filter((booking) => booking.is_checked_in && booking.checked_in_at)
      .sort((a, b) => new Date(b.checked_in_at!).getTime() - new Date(a.checked_in_at!).getTime())
      .slice(0, 5),
    [recentBookings],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070b18] px-4 py-5 sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-violet-700/10 blur-[110px]" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/10 blur-[120px]" />

      <main className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-violet-500/15 bg-[#0c1321]/95 shadow-[0_28px_90px_rgba(41,18,91,0.36)]">
        <header className="flex items-center gap-4 border-b border-slate-700/35 px-5 py-5 sm:px-7">
          <Link
            to="/admin"
            aria-label="Back to admin dashboard"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-400">Admin access</p>
            <h1 className="mt-0.5 text-base font-bold text-slate-100 sm:text-lg">Check-in Scan</h1>
          </div>
        </header>

        <div className="grid lg:grid-cols-[1fr_1.08fr]">
          <section className="border-b border-slate-700/35 p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="relative flex min-h-[430px] flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-600/70 bg-[#080e1a] px-6 py-10 text-center shadow-inner sm:min-h-[520px]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.10),transparent_48%)]" />

              {scanning ? (
                <div className="absolute inset-0">
                  <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-slate-950/25" />
                  <div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-violet-400 shadow-[0_0_45px_rgba(139,92,246,0.38)]">
                    <ScanLine className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 text-violet-400/65" />
                  </div>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-slate-950/70 text-white backdrop-blur transition hover:bg-slate-900"
                    aria-label="Stop camera"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <p className="absolute inset-x-0 bottom-8 text-sm font-medium text-white drop-shadow">Hold the ticket QR inside the frame</p>
                </div>
              ) : (
                <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="group relative grid h-32 w-32 place-items-center text-violet-500"
                    aria-label="Start QR scanner"
                  >
                    <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-[5px] border-t-[5px] border-violet-500 transition group-hover:-translate-x-1 group-hover:-translate-y-1" />
                    <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-[5px] border-t-[5px] border-violet-500 transition group-hover:translate-x-1 group-hover:-translate-y-1" />
                    <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-[5px] border-l-[5px] border-violet-500 transition group-hover:-translate-x-1 group-hover:translate-y-1" />
                    <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-[5px] border-r-[5px] border-violet-500 transition group-hover:translate-x-1 group-hover:translate-y-1" />
                    <QrCode className="h-16 w-16 drop-shadow-[0_0_14px_rgba(139,92,246,0.65)]" strokeWidth={1.5} />
                  </button>

                  <h2 className="mt-8 text-xl font-bold text-white">Scan Ticket QR Code</h2>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-slate-400">Align the QR code within the frame to verify the ticket.</p>

                  <button
                    type="button"
                    onClick={() => { setShowManualEntry((value) => !value); setError(""); setResult(null); }}
                    className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-[#0b1220] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-violet-500/70 hover:bg-violet-500/10"
                  >
                    <Keyboard className="h-4 w-4" /> Enter Booking ID Manually
                  </button>

                  {showManualEntry && (
                    <form
                      onSubmit={(event: FormEvent) => { event.preventDefault(); void checkIn(bookingCode); }}
                      className="mt-4 flex w-full gap-2"
                    >
                      <input
                        autoFocus
                        required
                        value={bookingCode}
                        onChange={(event) => setBookingCode(event.target.value.toUpperCase())}
                        placeholder="ARA2026..."
                        className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950/70 px-4 py-3 font-mono text-sm uppercase text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="grid w-12 place-items-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60"
                        aria-label="Check in booking"
                      >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                      </button>
                    </form>
                  )}

                  {error && <p role="alert" className="mt-4 w-full rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-left text-sm text-rose-300">{error}</p>}
                  {result && (
                    <div className="mt-4 flex w-full items-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-left">
                      <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                      <div><p className="text-sm font-bold text-emerald-300">Entry approved</p><p className="text-xs text-slate-400">{result.customer_name} · {result.booking_code}</p></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="p-5 sm:p-8">
            <div className="min-h-[430px] overflow-hidden rounded-xl border border-slate-700/70 bg-[#0a111e] sm:min-h-[520px]">
              <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-4">
                <h2 className="font-bold text-slate-100">Recent Check-ins</h2>
                <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-300">Live</span>
              </div>

              {loadingRecent ? (
                <div className="grid min-h-[390px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
              ) : recentCheckIns.length === 0 ? (
                <div className="flex min-h-[390px] flex-col items-center justify-center px-6 text-center">
                  <Camera className="h-9 w-9 text-slate-700" />
                  <p className="mt-4 text-sm font-semibold text-slate-400">No check-ins yet</p>
                  <p className="mt-1 text-xs text-slate-600">Verified tickets will appear here instantly.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700/60 px-5">
                  {recentCheckIns.map((booking) => (
                    <article key={booking.id} className="flex items-start justify-between gap-4 py-5">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-semibold text-slate-100">{booking.booking_code}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">{booking.shows?.movies?.title || "Movie screening"}</p>
                        <p className="mt-1 text-xs text-slate-500">{booking.booking_seats.map((seat) => seat.seat_number).join(", ") || booking.customer_name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <time className="text-xs text-slate-500">{formatCheckInTime(booking.checked_in_at!)}</time>
                        <p className="mt-2 flex items-center justify-end gap-1.5 text-xs font-medium text-emerald-400"><Check className="h-3.5 w-3.5" /> Checked in</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="border-t border-slate-700/35 py-5 text-center text-[11px] text-slate-600">
          Powered by <span className="text-violet-400">Convex</span> · <span className="text-violet-400">React</span>
        </footer>
      </main>
    </div>
  );
}
