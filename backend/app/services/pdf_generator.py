import io
from typing import Any, Dict

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.utils.qr_generator import generate_qr_code_bytes


def create_ticket_pdf_stream(booking: Dict[str, Any]) -> io.BytesIO:
    """Create a ticket for the current booking schema.

    The QR payload intentionally contains only the public booking code.
    """
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=42,
        leftMargin=42,
        topMargin=42,
        bottomMargin=42,
        title=f"Aravalli Ticket {booking['booking_code']}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TicketTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=23,
        textColor=colors.HexColor("#0F1115"),
        spaceAfter=7,
    )
    subtitle_style = ParagraphStyle(
        "TicketSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        textColor=colors.HexColor("#9A7B18"),
        leading=14,
    )
    body_style = ParagraphStyle(
        "TicketBody",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#334155"),
        leading=15,
    )
    label_style = ParagraphStyle(
        "TicketLabel",
        parent=body_style,
        fontName="Helvetica-Bold",
    )

    show = booking.get("shows") or {}
    movie = show.get("movies") or {}
    seats = booking.get("booking_seats") or []
    seat_numbers = ", ".join(seat.get("seat_number", "") for seat in seats) or "Not assigned"
    booking_code = booking["booking_code"]

    qr_image = Image(
        io.BytesIO(generate_qr_code_bytes(booking_code)),
        width=120,
        height=120,
    )

    details = [
        [Paragraph("Movie", label_style), Paragraph(movie.get("title", "Aravalli Screening"), body_style)],
        [Paragraph("Date &amp; time", label_style), Paragraph(f"{show.get('date', '')} at {show.get('time', '')}", body_style)],
        [Paragraph("Seats", label_style), Paragraph(seat_numbers, body_style)],
        [Paragraph("Guest", label_style), Paragraph(booking.get("customer_name", ""), body_style)],
        [Paragraph("Booking ID", label_style), Paragraph(booking_code, body_style)],
        [Paragraph("Amount paid", label_style), Paragraph(f"INR {booking.get('total_amount', 0)}", body_style)],
    ]
    detail_table = Table(details, colWidths=[105, 285])
    detail_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#D4AF37")),
            ]
        )
    )

    ticket_layout = Table([[detail_table, qr_image]], colWidths=[400, 125])
    ticket_layout.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#D4AF37")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ]
        )
    )

    story = [
        Paragraph("ARAVALLI AUDITORIUM", title_style),
        Paragraph("CONFIRMED ADMISSION TICKET", subtitle_style),
        Spacer(1, 22),
        ticket_layout,
        Spacer(1, 18),
        Paragraph("Present this QR code at the auditorium entrance. It contains only your booking ID.", body_style),
        Paragraph("A ticket can be checked in once. Keep this document private.", body_style),
    ]

    document.build(story)
    buffer.seek(0)
    return buffer
