import io
import os
from datetime import datetime
from typing import Any, Dict, Optional, Tuple
from urllib.request import Request, urlopen

from PIL import Image as PILImage, ImageOps
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

from app.utils.qr_generator import generate_qr_code_bytes


PAGE_WIDTH = 420
PAGE_HEIGHT = 720
PAGE_BACKGROUND = HexColor("#020711")
TICKET_BACKGROUND = HexColor("#F8F8FA")
INK = HexColor("#0F172A")
MUTED = HexColor("#64748B")
SUBTLE = HexColor("#CBD5E1")
PURPLE = HexColor("#7C2DD0")
PURPLE_DARK = HexColor("#51219D")


def _ticket_fonts() -> Tuple[str, str, str]:
    """Use a Unicode font when available so the rupee symbol renders cleanly."""
    regular_path = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", "arial.ttf")
    bold_path = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", "arialbd.ttf")
    if os.path.exists(regular_path) and os.path.exists(bold_path):
        if "TicketSans" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("TicketSans", regular_path))
            pdfmetrics.registerFont(TTFont("TicketSans-Bold", bold_path))
        return "TicketSans", "TicketSans-Bold", "₹"
    return "Helvetica", "Helvetica-Bold", "INR "


def _poster_reader(url: Optional[str], width: int = 440, height: int = 660) -> Optional[ImageReader]:
    if not url:
        return None
    try:
        request = Request(url, headers={"User-Agent": "Aravalli-Ticket/1.0"})
        with urlopen(request, timeout=5) as response:
            image = PILImage.open(io.BytesIO(response.read())).convert("RGB")
        image = ImageOps.fit(image, (width, height), method=PILImage.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format="JPEG", quality=90, optimize=True)
        output.seek(0)
        return ImageReader(output)
    except Exception:
        return None


def _draw_label_value(canvas: Canvas, x: float, y: float, label: str, value: str, regular: str, bold: str) -> None:
    canvas.setFillColor(MUTED)
    canvas.setFont(regular, 9)
    canvas.drawString(x, y, label)
    canvas.setFillColor(INK)
    canvas.setFont(bold, 11)
    canvas.drawString(x, y - 16, value)


def _draw_wrapped_title(canvas: Canvas, text: str, x: float, y: float, max_width: float, bold: str) -> float:
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or pdfmetrics.stringWidth(candidate, bold, 17) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    lines = lines[:2]
    canvas.setFillColor(INK)
    canvas.setFont(bold, 17)
    for index, line in enumerate(lines):
        canvas.drawString(x, y - (index * 20), line)
    return y - (len(lines) * 20)


def _format_show_date(value: str) -> str:
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%a, %d %b %Y")
    except (TypeError, ValueError):
        return value or "-"


def _format_show_time(value: str) -> str:
    try:
        return datetime.strptime(value[:5], "%H:%M").strftime("%I:%M %p")
    except (TypeError, ValueError):
        return value or "-"


def create_ticket_pdf_stream(booking: Dict[str, Any]) -> io.BytesIO:
    """Create a single-page vertical ticket matching the confirmation UI."""
    buffer = io.BytesIO()
    canvas = Canvas(buffer, pagesize=(PAGE_WIDTH, PAGE_HEIGHT), pageCompression=1)
    regular, bold, currency_symbol = _ticket_fonts()

    show = booking.get("shows") or {}
    movie = show.get("movies") or {}
    seats = booking.get("booking_seats") or []
    seat_numbers = ", ".join(seat.get("seat_number", "") for seat in seats) or "Not assigned"
    booking_code = str(booking["booking_code"]).upper()
    movie_title = movie.get("title") or "Aravalli Screening"

    canvas.setTitle(f"Aravalli Ticket {booking_code}")
    canvas.setFillColor(PAGE_BACKGROUND)
    canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)

    ticket_x, ticket_y, ticket_width, ticket_height = 18, 18, 384, 684
    ticket_top = ticket_y + ticket_height
    canvas.setFillColor(TICKET_BACKGROUND)
    canvas.roundRect(ticket_x, ticket_y, ticket_width, ticket_height, 14, stroke=0, fill=1)

    # Brand and booking identity.
    brand_x, brand_y = 42, ticket_top - 62
    canvas.setFillColor(PURPLE_DARK)
    canvas.roundRect(brand_x, brand_y, 40, 40, 8, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont(bold, 20)
    canvas.drawCentredString(brand_x + 20, brand_y + 12, "A")
    canvas.setFillColor(INK)
    canvas.setFont(bold, 15)
    canvas.drawString(94, brand_y + 23, "ARAVALLI")
    canvas.setFillColor(MUTED)
    canvas.setFont(bold, 8)
    canvas.drawString(94, brand_y + 9, "AUDITORIUM")

    canvas.setFillColor(MUTED)
    canvas.setFont(bold, 8)
    canvas.drawRightString(378, brand_y + 28, "BOOKING ID")
    canvas.setFillColor(INK)
    canvas.setFont(bold, 9)
    canvas.drawRightString(378, brand_y + 12, booking_code)

    # Poster and show details.
    poster_x, poster_y, poster_width, poster_height = 42, 430, 108, 166
    poster = _poster_reader(movie.get("poster_url"))
    if poster:
        canvas.drawImage(poster, poster_x, poster_y, poster_width, poster_height, mask="auto")
    else:
        canvas.setFillColor(HexColor("#0C1522"))
        canvas.roundRect(poster_x, poster_y, poster_width, poster_height, 5, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        canvas.setFont(bold, 11)
        canvas.drawCentredString(poster_x + poster_width / 2, poster_y + poster_height / 2, "MOVIE")

    details_x = 172
    title_bottom = _draw_wrapped_title(canvas, movie_title, details_x, 586, 200, bold)
    details_top = min(533, title_bottom - 12)
    _draw_label_value(canvas, details_x, details_top, "Date", _format_show_date(show.get("date", "")), regular, bold)
    _draw_label_value(canvas, 286, details_top, "Time", _format_show_time(show.get("time", "")), regular, bold)
    _draw_label_value(canvas, details_x, details_top - 56, "Screen", "Screen 1", regular, bold)
    _draw_label_value(canvas, 286, details_top - 56, "Seats", seat_numbers, regular, bold)

    # Perforation and side notches.
    perforation_y = 398
    canvas.setStrokeColor(SUBTLE)
    canvas.setLineWidth(1)
    canvas.setDash(5, 4)
    canvas.line(ticket_x + 14, perforation_y, ticket_x + ticket_width - 14, perforation_y)
    canvas.setDash()
    canvas.setFillColor(PAGE_BACKGROUND)
    canvas.circle(ticket_x, perforation_y, 15, stroke=0, fill=1)
    canvas.circle(ticket_x + ticket_width, perforation_y, 15, stroke=0, fill=1)

    # QR and admission guidance.
    qr_size = 146
    qr_x = (PAGE_WIDTH - qr_size) / 2
    qr_y = 207
    canvas.setFillColor(colors.white)
    canvas.setStrokeColor(SUBTLE)
    canvas.roundRect(qr_x - 7, qr_y - 7, qr_size + 14, qr_size + 14, 7, stroke=1, fill=1)
    canvas.drawImage(ImageReader(io.BytesIO(generate_qr_code_bytes(booking_code))), qr_x, qr_y, qr_size, qr_size, mask="auto")
    canvas.setFillColor(MUTED)
    canvas.setFont(regular, 9)
    canvas.drawCentredString(PAGE_WIDTH / 2, 185, "Scan this QR at the entrance")

    canvas.setFont(regular, 9)
    canvas.drawString(42, 140, "Total paid")
    amount = f"{currency_symbol}{float(booking.get('total_amount') or 0):.2f}"
    canvas.setFillColor(INK)
    canvas.setFont(bold, 16)
    canvas.drawRightString(378, 137, amount)

    canvas.setStrokeColor(HexColor("#E2E8F0"))
    canvas.line(ticket_x, 94, ticket_x + ticket_width, 94)
    canvas.setFillColor(MUTED)
    canvas.setFont(bold, 11)
    canvas.drawCentredString(PAGE_WIDTH / 2, 60, "Thank you! Enjoy the show")

    canvas.showPage()
    canvas.save()
    buffer.seek(0)
    return buffer
