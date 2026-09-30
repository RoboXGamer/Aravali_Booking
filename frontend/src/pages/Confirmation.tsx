import { ArrowLeft, Download, Search } from "lucide-react";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";

import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import type { Booking } from "../types";
import "../confirmation.css";

interface ConfirmationState {
  returnTo?: string;
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBase64(base64: string, mimeType: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  triggerDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function svgToJpegUrl(svgDataUrl: string) {
  const image = new Image();
  image.src = svgDataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to render the ticket image."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = 840;
  canvas.height = 1440;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create the ticket image.");
  context.fillStyle = "#030711";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return await new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to create the ticket JPG."));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, "image/jpeg", 0.94);
  });
}

export function Confirmation() {
  const { booking_code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = (location.state || {}) as ConfirmationState;
  const storedReturnTo = booking_code ? sessionStorage.getItem(`aravalli.booking.returnTo.${booking_code}`) : null;
  const requestedReturnTo = routeState.returnTo || storedReturnTo;
  const returnTo = requestedReturnTo === "/admin/bookings/reservations"
    ? requestedReturnTo
    : "/";
  const accessToken = new URLSearchParams(location.hash.slice(1)).get("token") || "";
  const [copied, setCopied] = useState(false);
  const fetchedBooking = useQuery(
    api.bookings.getByCode,
    booking_code && accessToken ? { bookingCode: booking_code, accessToken } : "skip",
  );
  const getQr = useAction(api.tickets.getQrDataUrl);
  const getPdf = useAction(api.tickets.getPdfBase64);
  const getTicketImage = useAction(api.tickets.getTicketImageSvg);
  const booking = (fetchedBooking as Booking | null | undefined) || null;
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const automaticDownload = useRef("");


  useEffect(() => {
    if (!booking || !booking_code || !accessToken) return;
    let active = true;
    getQr({ bookingCode: booking_code, accessToken })
      .then((url) => { if (active) setQrUrl(url); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [booking?.id, booking_code, accessToken, getQr]);

  const downloadTicketFiles = useCallback(async () => {
    if (!booking_code || !accessToken) return;
    setError("");
    const [pdfBase64, ticketSvg] = await Promise.all([
      getPdf({ bookingCode: booking_code, accessToken }),
      getTicketImage({ bookingCode: booking_code, accessToken }),
    ]);
    downloadBase64(pdfBase64, "application/pdf", `Aravalli-${booking_code}.pdf`);
    const jpgUrl = await svgToJpegUrl(ticketSvg);
    triggerDownload(jpgUrl, `Aravalli-${booking_code}.jpg`);
    window.setTimeout(() => URL.revokeObjectURL(jpgUrl), 1_000);
  }, [booking_code, accessToken, getPdf, getTicketImage]);

  useEffect(() => {
    if (!booking || !booking_code || !accessToken) return;
    const downloadKey = `${booking_code}:${accessToken}`;
    if (automaticDownload.current === downloadKey) return;
    automaticDownload.current = downloadKey;
    void downloadTicketFiles().catch((reason: Error) => setError(reason.message));
  }, [booking?.id, booking_code, downloadTicketFiles, accessToken]);

  if (accessToken && fetchedBooking === undefined) return <div className="ticket-loading"><Spinner size="lg" /></div>;
  if (!booking || !booking_code || !accessToken) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <Search className="mx-auto h-8 w-8 text-[rgb(var(--booking-accent-text))]" />
        <h1 className="mt-4 text-2xl font-black text-white">Retrieve your booking</h1>
        <p className="mt-2 text-slate-400">{error || (accessToken && fetchedBooking === null
          ? "We couldn't find a confirmed ticket with those details. Open the complete private link saved after booking."
          : "Open your saved private ticket link. If you lost your ticket and link, contact auditorium staff with your payment receipt.")}</p>

        <Link to={returnTo}><Button className="mt-6">{returnTo.startsWith("/admin") ? "Return to reservations" : "Return home"}</Button></Link>
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
      await downloadTicketFiles();
    } catch (reason) {
      setError((reason as Error).message);
    }
  };

  return (
    <div className="ticket-page">
      <div className="ticket-shell">
        <header className="ticket-page-header">
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            aria-label={returnTo.startsWith("/admin") ? "Back to admin reservations" : "Back to home"}
            className="ticket-header-button ticket-back-button"
          >
            <ArrowLeft />
          </button>
          <h1>Your Ticket</h1>
          <button type="button" onClick={download} aria-label="Download ticket" className="ticket-header-button ticket-download-button">
            <Download />
          </button>
        </header>

        <p className="ticket-email-status">Booking confirmed. Save your ticket and private link. Anyone with the link can access your ticket.</p>
        <div className="mb-4 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${window.location.origin}/confirmation/${booking_code}#token=${accessToken}`);
              setCopied(true);
            } catch { setError("Unable to copy. Save the complete address from your browser instead."); }
          }}>{copied ? "Private link copied" : "Copy private ticket link"}</Button>
          <Button onClick={download}>Download ticket</Button>
        </div>
        {error && <p className="mb-4 text-center text-rose-300" role="alert">{error}</p>}

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
