import base64
import logging
from html import escape
from typing import Any, Dict, Optional

import resend

from app.config.settings import settings
from app.services.pdf_generator import create_ticket_pdf_stream


logger = logging.getLogger(__name__)


class NotificationService:
    """Deliver transactional booking notifications through Resend."""

    def __init__(self) -> None:
        if settings.RESEND_API_KEY:
            resend.api_key = settings.RESEND_API_KEY

    def send_email(
        self,
        *,
        to_email: str,
        subject: str,
        html: str,
        text: str,
        attachment: Optional[bytes] = None,
        attachment_name: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> Optional[str]:
        if not settings.RESEND_API_KEY or not settings.RESEND_FROM_EMAIL:
            logger.warning(
                "Ticket email was not sent to %s because Resend is not configured.",
                to_email,
            )
            return None

        params: resend.Emails.SendParams = {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html,
            "text": text,
        }
        if settings.RESEND_REPLY_TO:
            params["reply_to"] = settings.RESEND_REPLY_TO
        if attachment is not None and attachment_name:
            params["attachments"] = [
                {
                    "filename": attachment_name,
                    "content": base64.b64encode(attachment).decode("ascii"),
                }
            ]

        options: Optional[resend.Emails.SendOptions] = None
        if idempotency_key:
            options = {"idempotency_key": idempotency_key}

        response = resend.Emails.send(params, options)
        message_id = response.get("id")
        logger.info("Resend accepted ticket email %s for %s.", message_id, to_email)
        return message_id

    def send_booking_confirmation(self, booking: Dict[str, Any]) -> Optional[str]:
        show = booking.get("shows") or {}
        movie = show.get("movies") or {}
        seats = ", ".join(
            str(seat.get("seat_number", ""))
            for seat in booking.get("booking_seats", [])
            if seat.get("seat_number")
        ) or "—"
        booking_code = str(booking["booking_code"])
        customer_name = str(booking.get("customer_name") or "Guest")
        movie_title = str(movie.get("title") or "Your show")
        show_date = str(show.get("date") or "—")
        show_time = str(show.get("time") or "—")[:5]
        total = str(booking.get("total_amount") or "0.00")

        safe_name = escape(customer_name)
        safe_movie = escape(movie_title)
        safe_code = escape(booking_code)
        safe_date = escape(show_date)
        safe_time = escape(show_time)
        safe_seats = escape(seats)
        safe_total = escape(total)

        html = f"""
        <!doctype html>
        <html lang="en">
          <body style="margin:0;background:#070b18;color:#e5e7eb;font-family:Arial,sans-serif;">
            <div style="padding:32px 16px;">
              <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #263248;border-radius:16px;background:#0c1321;">
                <div style="padding:24px 28px;background:linear-gradient(135deg,#6d28d9,#8b5cf6);color:#fff;">
                  <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.82;">Aravalli Auditorium</div>
                  <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;">Your booking is confirmed</h1>
                </div>
                <div style="padding:28px;">
                  <p style="margin:0 0 22px;color:#aab4c5;line-height:1.6;">Hi {safe_name}, your ticket is ready. Keep the attached PDF available for entry.</p>
                  <div style="padding:18px;border:1px solid #263248;border-radius:12px;background:#09101d;">
                    <div style="margin-bottom:6px;color:#8b5cf6;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;">{safe_code}</div>
                    <div style="font-size:22px;font-weight:800;color:#fff;">{safe_movie}</div>
                    <table role="presentation" style="width:100%;margin-top:20px;border-collapse:collapse;color:#aab4c5;font-size:14px;">
                      <tr><td style="padding:7px 0;">Date</td><td style="padding:7px 0;text-align:right;color:#fff;font-weight:700;">{safe_date}</td></tr>
                      <tr><td style="padding:7px 0;">Time</td><td style="padding:7px 0;text-align:right;color:#fff;font-weight:700;">{safe_time}</td></tr>
                      <tr><td style="padding:7px 0;">Seats</td><td style="padding:7px 0;text-align:right;color:#fff;font-weight:700;">{safe_seats}</td></tr>
                      <tr><td style="padding:12px 0 0;border-top:1px solid #263248;">Total paid</td><td style="padding:12px 0 0;border-top:1px solid #263248;text-align:right;color:#a78bfa;font-size:18px;font-weight:800;">INR {safe_total}</td></tr>
                    </table>
                  </div>
                  <p style="margin:22px 0 0;color:#71809a;font-size:12px;line-height:1.6;">Present the QR code in the attached ticket at the auditorium entrance.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
        """
        text = (
            f"Hi {customer_name}, your booking is confirmed.\n\n"
            f"Booking: {booking_code}\nMovie: {movie_title}\nDate: {show_date}\n"
            f"Time: {show_time}\nSeats: {seats}\nTotal paid: INR {total}\n\n"
            "Your ticket PDF is attached. Present its QR code at the entrance."
        )
        ticket_pdf = create_ticket_pdf_stream(booking).getvalue()

        return self.send_email(
            to_email=str(booking["customer_email"]),
            subject=f"Your ticket for {movie_title} — {booking_code}",
            html=html,
            text=text,
            attachment=ticket_pdf,
            attachment_name=f"Aravalli-{booking_code}.pdf",
            idempotency_key=f"booking-confirmation/{booking_code}",
        )


notification_service = NotificationService()
