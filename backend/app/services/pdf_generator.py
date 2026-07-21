import io
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from app.utils.qr_generator import generate_qr_code_bytes

def create_ticket_pdf_stream(booking: dict, event: dict, category: dict) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    story = []
    styles = getSampleStyleSheet()

    primary_bg = colors.HexColor("#0f172a")
    brand_emerald = colors.HexColor("#10b981")
    dark_gray = colors.HexColor("#334155")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=primary_bg,
        spaceAfter=10
    )

    meta_style = ParagraphStyle(
        'MetaText',
        parent=styles['Normal'],
        fontSize=10,
        textColor=dark_gray,
        leading=14
    )

    field_style = ParagraphStyle(
        'FieldLabel',
        parent=meta_style,
        fontName='Helvetica-Bold'
    )

    story.append(Paragraph("ARAVALLI AUDITORIUM", title_style))
    story.append(Paragraph("E-TICKET & ADMISSION VOUCHER", meta_style))
    story.append(Spacer(1, 20))

    qr_payload = f"Booking Ref: {booking['id']}\nHolder: {booking['customer_name']}\nSeats Count: {booking['quantity']}"
    qr_bytes = generate_qr_code_bytes(qr_payload)
    qr_image = Image(io.BytesIO(qr_bytes), width=110, height=110)

    info_rows = [
        [Paragraph("Event Title:", field_style), Paragraph(event.get('title', 'Cinema Movie'), meta_style)],
        [Paragraph("Venue Area:", field_style), Paragraph(event.get('venue', 'Aravalli Auditorium'), meta_style)],
        [Paragraph("Date & Time:", field_style), Paragraph(f"{event.get('date')} | {event.get('time')}", meta_style)],
        [Paragraph("Admit Count:", field_style), Paragraph(f"{booking['quantity']} Seats", meta_style)],
        [Paragraph("Invoice Total:", field_style), Paragraph(f"INR {booking['grand_total']}", meta_style)],
        [Paragraph("Clearance Ref:", field_style), Paragraph(booking['id'], meta_style)]
    ]

    info_table = Table(info_rows, colWidths=[130, 250])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))

    layout_table = Table([[info_table, qr_image]], colWidths=[380, 120])
    layout_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEBELOW', (0, 0), (-1, -1), 1, brand_emerald),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
    ]))

    story.append(layout_table)
    story.append(Spacer(1, 20))

    story.append(Paragraph("POLICIES & ADMISSION RULES:", field_style))
    story.append(Spacer(1, 5))
    story.append(Paragraph("1. Verification requires presentation of this original digital layout at the security desk.", meta_style))
    story.append(Paragraph("2.Snacks, liquids, baggages, and matches are strictly restricted inside the Main Hall.", meta_style))

    doc.build(story)
    buffer.seek(0)
    return buffer
