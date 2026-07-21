import os

print("Initializing Aravalli Auditorium Cinema Booking Platform Project Setup...")

# 1. Create complete directory structure
directories = [
    "backend",
    "backend/app",
    "backend/app/config",
    "backend/app/models",
    "backend/app/middleware",
    "backend/app/schemas",
    "backend/app/utils",
    "backend/app/services",
    "backend/app/routers",
    "frontend",
    "frontend/src",
    "frontend/src/context",
    "frontend/src/hooks",
    "frontend/src/services",
    "frontend/src/components",
    "frontend/src/components/common",
    "frontend/src/pages"
]

for directory in directories:
    os.makedirs(directory, exist_ok=True)
    print(f"Created directory: {directory}")

# 2. File Contents Dictionary
project_files = {}

# --- DATABASE SCHEMA ---
project_files["database.sql"] = """-- Upgraded database schema for Aravalli Auditorium Cinema Platform
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Linked with Supabase auth.users for Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Movies Table
CREATE TABLE IF NOT EXISTS public.movies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    synopsis TEXT,
    duration INTEGER NOT NULL,
    genre TEXT NOT NULL,
    certificate TEXT NOT NULL,
    language TEXT NOT NULL,
    cast_members TEXT,
    director TEXT,
    release_year INTEGER NOT NULL,
    poster_url TEXT,
    trailer_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Shows Table
CREATE TABLE IF NOT EXISTS public.shows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    movie_id UUID REFERENCES public.movies(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT check_show_day CHECK (EXTRACT(ISODOW FROM date) IN (3, 4, 5, 6, 7))
);

-- 4. Dynamic Seat Layout Table
CREATE TABLE IF NOT EXISTS public.seat_layouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    section_name TEXT NOT NULL,
    row_prefix TEXT NOT NULL,
    row_index INTEGER NOT NULL,
    col_index INTEGER NOT NULL,
    seat_number TEXT NOT NULL,
    category_name TEXT NOT NULL CHECK (category_name IN ('VIP', 'Gold', 'Silver', 'Bronze')),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'reserved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_section_row_col UNIQUE (section_name, row_prefix, col_index)
);

-- 5. Bookings Table (No Login Required)
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY,
    show_id UUID REFERENCES public.shows(id) ON DELETE RESTRICT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    is_checked_in BOOLEAN NOT NULL DEFAULT false,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Booking Seats Table (Prevents Double Bookings)
CREATE TABLE IF NOT EXISTS public.booking_seats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE NOT NULL,
    seat_layout_id UUID REFERENCES public.seat_layouts(id) ON DELETE RESTRICT NOT NULL,
    CONSTRAINT unique_show_seat_booking UNIQUE (show_id, seat_layout_id)
);

-- 7. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    razorpay_order_id TEXT UNIQUE NOT NULL,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'captured', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. Movie Polls Table
CREATE TABLE IF NOT EXISTS public.polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_start DATE NOT NULL UNIQUE,
    voting_ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'voting' CHECK (status IN ('voting', 'closed', 'overridden')),
    winning_movie_id UUID REFERENCES public.movies(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 9. Poll Options Table
CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
    movie_id UUID REFERENCES public.movies(id) ON DELETE CASCADE NOT NULL,
    votes_count INTEGER NOT NULL DEFAULT 0 CHECK (votes_count >= 0),
    CONSTRAINT unique_poll_movie UNIQUE (poll_id, movie_id)
);

-- 10. Poll Votes Table
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE NOT NULL,
    fingerprint TEXT NOT NULL,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_poll_voter UNIQUE (poll_option_id, fingerprint)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shows_date ON public.shows(date);
CREATE INDEX IF NOT EXISTS idx_booking_seats_show ON public.booking_seats(show_id);
CREATE INDEX IF NOT EXISTS idx_polls_week ON public.polls(week_start);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON public.bookings(customer_phone);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Apply Policy Declarations
CREATE POLICY "Allow public select on profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public read on movies" ON public.movies FOR SELECT USING (true);
CREATE POLICY "Allow public read on shows" ON public.shows FOR SELECT USING (true);
CREATE POLICY "Allow public read on seat_layouts" ON public.seat_layouts FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read bookings" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert bookings" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update bookings" ON public.bookings FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous read booking_seats" ON public.booking_seats FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert booking_seats" ON public.booking_seats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous read polls" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read poll_options" ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read poll_votes" ON public.poll_votes FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert poll_votes" ON public.poll_votes FOR INSERT WITH CHECK (true);

-- Admin rules
CREATE POLICY "Allow admins all actions" ON public.movies TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow admins all actions on shows" ON public.shows TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow admins all actions on seat_layouts" ON public.seat_layouts TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow admins all actions on polls" ON public.polls TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow admins all actions on poll_options" ON public.poll_options TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Atomic vote increment helper RPC
CREATE OR REPLACE FUNCTION public.increment_vote(option_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.poll_options
  SET votes_count = votes_count + 1
  WHERE id = option_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed default seats layout
INSERT INTO public.seat_layouts (section_name, row_prefix, row_index, col_index, seat_number, category_name, price, status)
VALUES 
('Balcony', 'A', 1, 1, 'A-1', 'VIP', 600.00, 'active'),
('Balcony', 'A', 1, 2, 'A-2', 'VIP', 600.00, 'active'),
('Balcony', 'A', 1, 3, 'A-3', 'VIP', 600.00, 'active'),
('Balcony', 'A', 1, 4, 'A-4', 'VIP', 600.00, 'active'),
('Balcony', 'A', 1, 5, 'A-5', 'VIP', 600.00, 'active'),
('Ground Left', 'B', 2, 1, 'B-1', 'Gold', 400.00, 'active'),
('Ground Left', 'B', 2, 2, 'B-2', 'Gold', 400.00, 'active'),
('Ground Left', 'B', 2, 3, 'B-3', 'Gold', 400.00, 'active'),
('Ground Right', 'B', 2, 4, 'B-4', 'Gold', 400.00, 'active'),
('Ground Right', 'B', 2, 5, 'B-5', 'Gold', 400.00, 'active'),
('Ground Left', 'C', 3, 1, 'C-1', 'Silver', 300.00, 'active'),
('Ground Left', 'C', 3, 2, 'C-2', 'Silver', 300.00, 'active'),
('Ground Left', 'C', 3, 3, 'C-3', 'Silver', 300.00, 'active'),
('Ground Right', 'C', 3, 4, 'C-4', 'Silver', 300.00, 'active'),
('Ground Right', 'C', 3, 5, 'C-5', 'Silver', 300.00, 'active')
ON CONFLICT DO NOTHING;
"""

# --- BACKEND REQUIREMENTS ---
project_files["backend/requirements.txt"] = """fastapi>=0.110.0
uvicorn>=0.28.0
pydantic>=2.6.0,<3.0.0
pydantic-settings>=2.0.0
supabase>=2.11.0,<3.0.0
razorpay>=1.4.1
reportlab>=4.1.0
qrcode>=7.4.2
pillow>=10.2.0
python-jose[cryptography]>=3.3.0
python-multipart>=0.0.9
gunicorn>=21.2.0
"""

project_files["backend/.env.example"] = """SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
RAZORPAY_KEY_ID=rzp_test_your_razorpay_key_id
RAZORPAY_SECRET=your_razorpay_secret
FRONTEND_URL=http://localhost:5173
PORT=8000
"""

project_files["backend/app/__init__.py"] = ""
project_files["backend/app/config/__init__.py"] = ""
project_files["backend/app/models/__init__.py"] = ""
project_files["backend/app/middleware/__init__.py"] = ""
project_files["backend/app/schemas/__init__.py"] = ""
project_files["backend/app/utils/__init__.py"] = ""
project_files["backend/app/services/__init__.py"] = ""
project_files["backend/app/routers/__init__.py"] = ""

# --- BACKEND SETTINGS ---
project_files["backend/app/config/settings.py"] = """import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str
    RAZORPAY_KEY_ID: str
    RAZORPAY_SECRET: str
    FRONTEND_URL: str = "http://localhost:5173"
    PORT: int = 8000

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")

settings = Settings()
"""

# --- BACKEND DATABASE CLIENT ---
project_files["backend/app/models/database.py"] = """from supabase import create_client, Client
from app.config.settings import settings

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
"""

# --- BACKEND AUTH MIDDLEWARE ---
project_files["backend/app/middleware/auth.py"] = """from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config.settings import settings
from app.models.database import supabase

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
        
        if alg == "HS256":
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            return payload
        else:
            user_response = supabase.auth.get_user(token)
            if not user_response or not user_response.user:
                raise HTTPException(status_code=401, detail="Invalid or expired session token.")
            
            user = user_response.user
            payload = {
                "sub": user.id,
                "email": user.email,
                "user_metadata": user.user_metadata or {}
            }
            return payload
            
    except JWTError as e:
        try:
            user_response = supabase.auth.get_user(token)
            if user_response and user_response.user:
                user = user_response.user
                return {
                    "sub": user.id,
                    "email": user.email,
                    "user_metadata": user.user_metadata or {}
                }
        except Exception:
            pass
        raise HTTPException(status_code=401, detail=f"Authentication payload decoding failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication verification failed: {str(e)}")

def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Subject UID missing from authentication claims.")
    
    response = supabase.table("profiles").select("role").eq("id", user_id).execute()
    if not response.data or response.data[0].get("role") != "admin":
         raise HTTPException(status_code=403, detail="Operator requires elevated administrator credentials.")
    return current_user
"""

# --- BACKEND SCHEMAS ---
project_files["backend/app/schemas/event.py"] = """from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, time, datetime

class TicketCategoryBase(BaseModel):
    name: str
    price: float
    total_seats: int

class TicketCategoryCreate(TicketCategoryBase):
    pass

class TicketCategoryResponse(TicketCategoryBase):
    id: str
    event_id: str
    available_seats: int

    class Config:
        from_attributes = True

class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    date: date
    time: time
    venue: str = "Aravalli Auditorium Main Hall"
    poster_url: Optional[str] = None
    status: str = "active"

class EventCreate(EventBase):
    categories: List[TicketCategoryCreate]

class EventResponse(EventBase):
    id: str
    created_at: datetime
    categories: List[TicketCategoryResponse] = []

    class Config:
        from_attributes = True
"""

project_files["backend/app/schemas/booking.py"] = """from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class BookingCreate(BaseModel):
    event_id: str
    category_id: str
    quantity: int = Field(..., gt=0, le=10)
    customer_name: str
    customer_phone: str

class BookingResponse(BaseModel):
    id: str
    user_id: Optional[str]
    event_id: str
    category_id: str
    quantity: int
    subtotal: float
    convenience_fee: float
    gst: float
    grand_total: float
    customer_name: str
    customer_phone: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
"""

# --- BACKEND UTILS & SERVICES ---
project_files["backend/app/utils/qr_generator.py"] = """import io
import qrcode

def generate_qr_code_bytes(payload: str) -> bytes:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=2
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr.getvalue()
"""

project_files["backend/app/services/pdf_generator.py"] = """import io
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

    qr_payload = f"Booking Ref: {booking['id']}\\nHolder: {booking['customer_name']}\\nSeats Count: {booking['quantity']}"
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
"""

project_files["backend/app/services/notifications.py"] = """import logging
from abc import ABC, abstractmethod
from typing import Optional, List

logger = logging.getLogger(__name__)

class BaseNotificationService(ABC):
    @abstractmethod
    def send_email(self, to_email: str, subject: str, body: str, attachment: Optional[bytes] = None, attachment_name: Optional[str] = None) -> bool:
        pass

    @abstractmethod
    def send_sms(self, phone_number: str, message: str, provider: str = "Twilio") -> bool:
        pass

    @abstractmethod
    def send_whatsapp(self, phone_number: str, template_name: str, variables: List[str]) -> bool:
        pass

class NotificationService(BaseNotificationService):
    def send_email(self, to_email: str, subject: str, body: str, attachment: Optional[bytes] = None, attachment_name: Optional[str] = None) -> bool:
        logger.info(f"[NotificationService] Email sent to {to_email} | Subject: {subject}")
        return True

    def send_sms(self, phone_number: str, message: str, provider: str = "Twilio") -> bool:
        logger.info(f"[NotificationService] SMS sent to {phone_number} via {provider} | Body: {message}")
        return True

    def send_whatsapp(self, phone_number: str, template_name: str, variables: List[str]) -> bool:
        logger.info(f"[NotificationService] WhatsApp template {template_name} sent to {phone_number}")
        return True

notification_service = NotificationService()
"""

# --- BACKEND ROUTERS ---
project_files["backend/app/routers/events.py"] = """from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.database import supabase
from app.schemas.event import EventResponse

router = APIRouter(prefix="/api/events", tags=["Cinema Showtimes API"])

@router.get("/", response_model=List[EventResponse])
def list_events():
    shows_query = supabase.table("shows").select("*, movies(*)").eq("is_enabled", True).execute()
    if not shows_query.data:
        return []

    processed_events = []
    for s in shows_query.data:
        processed_events.append({
            "id": s["id"],
            "title": s["movies"]["title"],
            "description": s["movies"]["synopsis"],
            "date": s["date"],
            "time": s["time"],
            "venue": "Aravalli Auditorium Main Hall",
            "poster_url": s["movies"]["poster_url"],
            "status": "active"
        })
    return processed_events

@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: str):
    show_query = supabase.table("shows").select("*, movies(*)").eq("id", event_id).execute()
    if not show_query.data:
        raise HTTPException(status_code=404, detail="Requested show time slot is missing.")
    
    s = show_query.data[0]
    return {
        "id": s["id"],
        "title": s["movies"]["title"],
        "description": s["movies"]["synopsis"],
        "date": s["date"],
        "time": s["time"],
        "venue": "Aravalli Auditorium Main Hall",
        "poster_url": s["movies"]["poster_url"],
        "status": "active"
    }
"""

project_files["backend/app/routers/bookings.py"] = """import random
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel, Field
import razorpay
from app.models.database import supabase
from app.config.settings import settings
from app.services.notifications import notification_service

router = APIRouter(prefix="/api/bookings", tags=["Cinema Bookings"])

rzp_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_SECRET))

class AnonymousBookingCreate(BaseModel):
    show_id: str
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    seat_layout_ids: List[str] = Field(..., min_items=1)

class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

@router.get("/availability/{show_id}")
def get_booked_seats(show_id: str):
    seats_query = supabase.table("booking_seats").select("seat_layout_id").eq("show_id", show_id).execute()
    booked_ids = [row["seat_layout_id"] for row in (seats_query.data or [])]
    return {"booked_seat_layout_ids": booked_ids}

@router.post("/")
def init_anonymous_booking(payload: AnonymousBookingCreate):
    show_query = supabase.table("shows").select("*, movies(*)").eq("id", payload.show_id).eq("is_enabled", True).execute()
    if not show_query.data:
        raise HTTPException(status_code=404, detail="Show session is either unavailable or disabled.")
    
    show = show_query.data[0]

    seats_query = supabase.table("seat_layouts").select("*").in_("id", payload.seat_layout_ids).execute()
    seats_map = {row["id"]: row for row in (seats_query.data or [])}

    for s_id in payload.seat_layout_ids:
        if s_id not in seats_map:
            raise HTTPException(status_code=400, detail="Invalid seat selected.")
        seat = seats_map[s_id]
        if seat["status"] != "active":
            raise HTTPException(status_code=400, detail=f"Seat {seat['seat_number']} is currently unavailable.")

    conflicts_query = supabase.table("booking_seats")\\
        .select("seat_layout_id")\\
        .eq("show_id", payload.show_id)\\
        .in_("seat_layout_id", payload.seat_layout_ids)\\
        .execute()
    
    if conflicts_query.data:
        raise HTTPException(status_code=400, detail="One or more selected seats were already booked by another user.")

    subtotal = sum(float(seats_map[s_id]["price"]) for s_id in payload.seat_layout_ids)
    convenience_fee = 30.00 * len(payload.seat_layout_ids)
    gst = (subtotal + convenience_fee) * 0.18
    grand_total = subtotal + convenience_fee + gst

    year_prefix = datetime.now().year
    random_suffix = random.randint(100000, 999999)
    booking_id = f"ARA{year_prefix}{random_suffix}"

    booking_payload = {
        "id": booking_id,
        "show_id": payload.show_id,
        "customer_name": payload.customer_name,
        "customer_phone": payload.customer_phone,
        "customer_email": payload.customer_email,
        "total_amount": grand_total,
        "status": "pending"
    }

    booking_insert = supabase.table("bookings").insert(booking_payload).execute()
    if not booking_insert.data:
        raise HTTPException(status_code=500, detail="Failed to initialize reservation order state.")

    booking_seats_payload = [
        {"booking_id": booking_id, "show_id": payload.show_id, "seat_layout_id": s_id}
        for s_id in payload.seat_layout_ids
    ]
    try:
        supabase.table("booking_seats").insert(booking_seats_payload).execute()
    except Exception:
        supabase.table("bookings").delete().eq("id", booking_id).execute()
        raise HTTPException(status_code=400, detail="A seat has just been locked by another user session.")

    try:
        rzp_order = rzp_client.order.create(data={
            "amount": int(grand_total * 100),
            "currency": "INR",
            "receipt": booking_id,
            "payment_capture": 1
        })
    except Exception as e:
        supabase.table("bookings").delete().eq("id", booking_id).execute()
        raise HTTPException(status_code=500, detail=f"Payment partner handshake failed: {str(e)}")

    payment_payload = {
        "booking_id": booking_id,
        "razorpay_order_id": rzp_order["id"],
        "amount": grand_total,
        "status": "initiated"
    }
    supabase.table("payments").insert(payment_payload).execute()

    return {
        "booking": booking_insert.data[0],
        "razorpay_order": rzp_order
    }

@router.post("/verify")
def verify_cinema_payment(payload: PaymentVerify):
    try:
        signature_valid = rzp_client.utility.verify_payment_signature({
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature
        })
    except Exception:
        signature_valid = False

    if not signature_valid:
        raise HTTPException(status_code=400, detail="Invalid merchant transaction signature detected.")

    payment_query = supabase.table("payments").select("*").eq("razorpay_order_id", payload.razorpay_order_id).execute()
    if not payment_query.data:
        raise HTTPException(status_code=404, detail="Staged payment tracker not found.")

    payment_row = payment_query.data[0]
    booking_id = payment_row["booking_id"]

    supabase.table("bookings").update({"status": "confirmed"}).eq("id", booking_id).execute()

    supabase.table("payments").update({
        "razorpay_payment_id": payload.razorpay_payment_id,
        "razorpay_signature": payload.razorpay_signature,
        "status": "captured"
    }).eq("id", payment_row["id"]).execute()

    booking_query = supabase.table("bookings").select("*, shows(*, movies(*))").eq("id", booking_id).execute()
    if booking_query.data:
        b_data = booking_query.data[0]
        email_addr = b_data.get("customer_email")
        if email_addr:
            notification_service.send_email(
                to_email=email_addr,
                subject=f"Ticket Confirmed - Aravalli Auditorium: {booking_id}",
                body=f"Hello {b_data['customer_name']},\\n\\nYour seats for {b_data['shows']['movies']['title']} are successfully booked.\\n\\nBooking Reference: {booking_id}"
            )

    return {"status": "success", "booking_id": booking_id}
"""

project_files["backend/app/routers/polls.py"] = """from datetime import datetime, date
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.database import supabase

router = APIRouter(prefix="/api/polls", tags=["Movie Polls"])

class VotePayload(BaseModel):
    poll_option_id: str
    fingerprint: str

@router.get("/active")
def get_active_poll():
    poll_query = supabase.table("polls").select("*").filter("voting_ends_at", "gt", datetime.utcnow().isoformat()).eq("status", "voting").execute()
    if not poll_query.data:
        return {"poll": None, "options": []}
    
    poll = poll_query.data[0]
    options_query = supabase.table("poll_options").select("*, movies(*)").eq("poll_id", poll["id"]).execute()
    
    return {
        "poll": poll,
        "options": options_query.data or []
    }

@router.post("/vote")
def cast_poll_vote(payload: VotePayload):
    option_query = supabase.table("poll_options").select("poll_id").eq("id", payload.poll_option_id).execute()
    if not option_query.data:
        raise HTTPException(status_code=404, detail="Selected option was not found.")
    
    poll_id = option_query.data[0]["poll_id"]

    options_in_poll = supabase.table("poll_options").select("id").eq("poll_id", poll_id).execute()
    option_ids = [opt["id"] for opt in (options_in_poll.data or [])]

    voted_query = supabase.table("poll_votes").select("id").in_("poll_option_id", option_ids).eq("fingerprint", payload.fingerprint).execute()
    if voted_query.data:
        raise HTTPException(status_code=400, detail="You have already voted on this poll.")

    vote_insert = supabase.table("poll_votes").insert({
        "poll_option_id": payload.poll_option_id,
        "fingerprint": payload.fingerprint
    }).execute()

    if not vote_insert.data:
        raise HTTPException(status_code=500, detail="Failed to record vote.")

    supabase.rpc("increment_vote", {"option_uuid": payload.poll_option_id}).execute()
    return {"status": "success", "detail": "Vote recorded successfully."}
"""

project_files["backend/app/routers/admin.py"] = """from fastapi import APIRouter, HTTPException, Depends
from app.models.database import supabase
from app.middleware.auth import get_current_admin
from datetime import date, datetime

router = APIRouter(prefix="/api/admin", tags=["Admin Portal Contexts"])

@router.get("/dashboard-stats")
def get_dashboard_metrics(admin: dict = Depends(get_current_admin)):
    today_str = str(date.today())

    bookings_query = supabase.table("bookings").select("*, shows(*)").eq("status", "confirmed").execute()
    bookings_data = bookings_query.data or []

    today_rev = sum(float(b["total_amount"]) for b in bookings_data if b["created_at"][:10] == today_str)
    all_rev = sum(float(b["total_amount"]) for b in bookings_data)

    seats_query = supabase.table("booking_seats").select("id").execute()
    total_leased_seats = len(seats_query.data) if seats_query.data else 0

    reserved_seats_query = supabase.table("seat_layouts").select("id").eq("status", "reserved").execute()
    reserved_count = len(reserved_seats_query.data) if reserved_seats_query.data else 0

    return {
        "today_revenue": today_rev,
        "total_revenue": all_rev,
        "total_seats_sold": total_leased_seats,
        "total_reserved_seats": reserved_count
    }

@router.get("/seats/layout")
def get_seat_layouts():
    layouts_query = supabase.table("seat_layouts").select("*").execute()
    return layouts_query.data or []

@router.get("/bookings")
def get_all_bookings(admin: dict = Depends(get_current_admin)):
    bookings_query = supabase.table("bookings").select("*, shows(*, movies(*))").order("created_at", desc=True).execute()
    bookings_data = bookings_query.data or []

    for b in bookings_data:
        b["event_title"] = b.get("shows", {}).get("movies", {}).get("title", "Aravalli Auditorium Performance")
    
    return bookings_data

@router.post("/check-in/{booking_id}")
def verify_qr_code_checkin(booking_id: str, admin: dict = Depends(get_current_admin)):
    booking_query = supabase.table("bookings").select("*").eq("id", booking_id).execute()
    if not booking_query.data:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    booking = booking_query.data[0]

    if booking["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Ticket payment is pending or cancelled.")

    if booking["is_checked_in"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Ticket Already Used. Scanned at {booking['checked_in_at']}"
        )

    checkin_time = datetime.utcnow().isoformat()
    supabase.table("bookings").update({
        "is_checked_in": True,
        "checked_in_at": checkin_time
    }).eq("id", booking_id).execute()

    return {
        "status": "success",
        "detail": "Welcome to Aravalli Auditorium. Enjoy the show!",
        "booking_id": booking_id,
        "customer_name": booking["customer_name"]
    }

@router.post("/seats/reserve/{seat_id}")
def reserve_seat_manually(seat_id: str, admin: dict = Depends(get_current_admin)):
    supabase.table("seat_layouts").update({"status": "reserved"}).eq("id", seat_id).execute()
    return {"status": "success", "detail": "Seat marked as reserved. Closed from online sales."}

@router.post("/seats/release/{seat_id}")
def release_seat_manually(seat_id: str, admin: dict = Depends(get_current_admin)):
    supabase.table("seat_layouts").update({"status": "active"}).eq("id", seat_id).execute()
    return {"status": "success", "detail": "Seat released. Reopened for public bookings."}

@router.delete("/events/{event_id}")
def delete_event(event_id: str, admin: dict = Depends(get_current_admin)):
    response = supabase.table("shows").delete().eq("id", event_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Entity reference not resolved.")
    return {"status": "success", "detail": "Show playtime removed safely."}
"""

project_files["backend/app/main.py"] = """import sys
from pathlib import Path

# Dynamically add the project root to sys.path so 'app' imports resolve correctly on Windows
sys.path.append(str(Path(__file__).resolve().parent.parent))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings
from app.routers import events, bookings, admin, polls

app = FastAPI(
    title="Aravalli Auditorium Ticketing System",
    description="Custom microservice handling secure routing, signatures mapping, and pdf streams compilation.",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(bookings.router)
app.include_router(admin.router)
app.include_router(polls.router)

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Aravalli Core API"}

if __name__ == "__main__":
    # Use 'app.main:app' as the import string so uvicorn resolves paths cleanly from the root directory
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
"""

# --- FRONTEND BUILD SPECS ---
project_files["frontend/package.json"] = """{
  "name": "aravalli-auditorium-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.40.0",
    "framer-motion": "^11.0.12",
    "lucide-react": "^0.354.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.3"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.6"
  }
}
"""

project_files["frontend/tsconfig.json"] = """{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
"""

project_files["frontend/vite.config.ts"] = """import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
});
"""

project_files["frontend/tailwind.config.js"] = """/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0F1115',
        surface: {
          light: '#2E353F',
          DEFAULT: '#20252C',
        },
        brand: {
          light: '#E5C05B',
          DEFAULT: '#D4AF37',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
"""

project_files["frontend/postcss.config.js"] = """export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
"""

project_files["frontend/index.html"] = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎭</text></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aravalli Auditorium - Premium Arts Desk</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"""

project_files["frontend/.env.example"] = """VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_RAZORPAY_KEY_ID=rzp_test_your_key_id
VITE_BACKEND_URL=http://localhost:8000
"""

project_files["frontend/src/vite-env.d.ts"] = """/// <reference types="vite/client" />
interface Window {
  Razorpay: any;
}
"""

project_files["frontend/src/index.css"] = """@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    background-color: #0F1115;
    color: #F3F4F6;
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
}

::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background-color: #0F1115;
}
::-webkit-scrollbar-thumb {
  background-color: #20252C;
  border-radius: 8px;
}
::-webkit-scrollbar-thumb:hover {
  background-color: #D4AF37;
}

.bg-gold-gradient {
  background: linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%);
}

.text-gold {
  color: #D4AF37;
}

.border-gold {
  border-color: #D4AF37;
}

.bg-cinema-card {
  background-color: #20252C;
  border: 1px solid rgba(212, 175, 55, 0.15);
}

.seat-map-scrollbar::-webkit-scrollbar {
  height: 8px;
}
.seat-map-scrollbar::-webkit-scrollbar-track {
  background: #0F1115;
}
.seat-map-scrollbar::-webkit-scrollbar-thumb {
  background: #20252C;
  border-radius: 4px;
}
.seat-map-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #D4AF37;
}
"""

project_files["frontend/src/main.tsx"] = """import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
"""

# --- FRONTEND ROUTING APP ---
project_files["frontend/src/App.tsx"] = """import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';

import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { EventsPage } from './pages/EventsPage';
import { EventDetails } from './pages/EventDetails';
import { TicketBooking } from './pages/TicketBooking';
import { Checkout } from './pages/Checkout';
import { Confirmation } from './pages/Confirmation';
import { MyBookings } from './pages/MyBookings';
import { AdminDashboard } from './pages/AdminDashboard';
import { CheckInScanner } from './pages/CheckInScanner';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="flex flex-col min-h-screen bg-background">
            <Navbar />
            <main className="flex-grow">
              <Routes>
                {/* Public Elements */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/events/:event_id" element={<EventDetails />} />

                {/* Booking elements */}
                <Route path="/book/:event_id" element={<TicketBooking />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/confirmation/:booking_id" element={<Confirmation />} />
                <Route path="/bookings" element={<MyBookings />} />

                {/* Operator Level */}
                <Route path="/admin" element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/admin/check-in" element={
                  <ProtectedRoute requireAdmin>
                    <CheckInScanner />
                  </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
"""

# --- FRONTEND API CLIENTS ---
project_files["frontend/src/services/supabaseClient.ts"] = """import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
"""

project_files["frontend/src/services/api.ts"] = """const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

async function getHeaders() {
  const token = localStorage.getItem('supabase.auth.token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

export const api = {
  async get(endpoint: string) {
    const headers = await getHeaders();
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async post(endpoint: string, body: any) {
    const headers = await getHeaders();
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async delete(endpoint: string) {
    const headers = await getHeaders();
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getDownloadUrl(bookingId: string): string {
    const token = localStorage.getItem('supabase.auth.token') || '';
    return `${BASE_URL}/api/bookings/ticket/${bookingId}/download?token=${token}`;
  }
};
"""

project_files["frontend/src/context/AuthContext.tsx"] = """import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        localStorage.setItem('supabase.auth.token', session.access_token);
        setIsAdmin(session.user?.user_metadata?.role === 'admin');
      } else {
        localStorage.removeItem('supabase.auth.token');
        setIsAdmin(false);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        localStorage.setItem('supabase.auth.token', session.access_token);
        setIsAdmin(session.user?.user_metadata?.role === 'admin');
      } else {
        localStorage.removeItem('supabase.auth.token');
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('supabase.auth.token');
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be wrapped in AuthProvider');
  return context;
};
"""

project_files["frontend/src/hooks/useRazorpay.ts"] = """import { useState, useEffect } from 'react';

export const useRazorpay = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => setIsLoaded(false);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return isLoaded;
};
"""

# --- REUSABLE COMPONENTS ---
project_files["frontend/src/components/ProtectedRoute.tsx"] = """import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './common/Spinner';

export const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean }> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
"""

project_files["frontend/src/components/ErrorBoundary.tsx"] = """import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './common/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an exception: ", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
          <div className="text-center max-w-md bg-slate-905 p-8 rounded-2xl border border-slate-800">
            <h1 className="text-3xl font-bold text-slate-100 mb-3">Something went wrong.</h1>
            <p className="text-slate-400 text-sm mb-6">An unexpected UI error has occurred. Try hard refreshing your page state.</p>
            <Button onClick={() => window.location.reload()} variant="primary">
              Reload Interface
            </Button>
          </div>
        </div>
      );
    }

    return this.children;
  }
}
"""

project_files["frontend/src/components/common/Button.tsx"] = """import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseStyle = "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-gold-gradient text-slate-950 font-bold focus:ring-offset-slate-900 shadow-md hover:shadow-brand/20",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700 focus:ring-slate-500",
    danger: "bg-rose-500 hover:bg-rose-600 text-white focus:ring-rose-400",
    ghost: "bg-transparent hover:bg-slate-800/80 text-slate-300"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base"
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
"""

project_files["frontend/src/components/common/Input.tsx"] = """import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-bold">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`bg-slate-900/80 border ${error ? 'border-rose-500/80' : 'border-slate-800 focus:border-brand'} rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand transition-all duration-200 ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-rose-500/90 font-medium mt-0.5">{error}</span>}
    </div>
  );
};
"""

project_files["frontend/src/components/common/Card.tsx"] = """import React from 'react';

export const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`bg-cinema-card rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 ${className}`}>
      {children}
    </div>
  );
};
"""

project_files["frontend/src/components/common/Modal.tsx"] = """import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative z-10 p-6"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-100">{title}</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
"""

project_files["frontend/src/components/common/Spinner.tsx"] = """import React from 'react';

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = {
    sm: "w-5 h-5",
    md: "w-10 h-10",
    lg: "w-16 h-16"
  };
  return (
    <div className="flex items-center justify-center">
      <div className={`${sizes[size]} border-4 border-slate-800 border-t-brand rounded-full animate-spin`} />
    </div>
  );
};
"""

project_files["frontend/src/components/common/Toast.tsx"] = """import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { motion } from 'framer-motion';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  text: string;
}

export const Toast: React.FC<{ message: ToastMessage, onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-2xl ${
        message.type === 'success' 
          ? 'bg-slate-900 border-emerald-500/30 text-emerald-400' 
          : 'bg-slate-900 border-rose-500/30 text-rose-400'
      }`}
    >
      {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium text-slate-200">{message.text}</span>
      <button onClick={onClose} className="hover:text-white transition ml-4">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
"""

project_files["frontend/src/components/common/Navbar.tsx"] = """import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Compass, LogOut, LayoutDashboard, Ticket } from 'lucide-react';
import { Button } from './Button';

export const Navbar: React.FC = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-slate-900 py-4 px-6 md:px-12 flex justify-between items-center">
      <Link to="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center font-bold text-slate-955 tracking-wider">A</div>
        <span className="font-bold text-lg tracking-wider text-slate-100">ARAVALLI</span>
      </Link>
      
      <div className="flex items-center gap-6">
        <Link to="/events" className="text-sm font-semibold text-slate-300 hover:text-brand transition flex items-center gap-2">
          <Compass className="w-4 h-4 text-brand" />
          Events
        </Link>
        
        {user ? (
          <>
            <Link to="/bookings" className="text-sm font-semibold text-slate-300 hover:text-brand transition flex items-center gap-2">
              <Ticket className="w-4 h-4 text-brand" />
              My Tickets
            </Link>
            {isAdmin && (
              <>
                <Link to="/admin" className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Admin
                </Link>
                <Link to="/admin/check-in" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition flex items-center gap-2">
                  Check-In
                </Link>
              </>
            )}
            <div className="h-4 w-px bg-slate-800" />
            <button 
              onClick={() => signOut().then(() => navigate('/'))} 
              className="text-slate-400 hover:text-rose-400 transition"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </>
        ) : (
          <Button onClick={() => navigate('/login')} variant="primary" size="sm">
            Sign In
          </Button>
        )}
      </div>
    </nav>
  );
};
"""

project_files["frontend/src/components/common/Footer.tsx"] = """import React from 'react';
import { ShieldCheck, MapPin, Mail, Phone } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-900/60 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center font-bold text-slate-955">A</div>
            <span className="font-bold text-lg text-slate-100">ARAVALLI</span>
          </div>
          <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
            Experience premium performances, classical recitals, and modern theatre at the state-of-the-art Aravalli Auditorium.
          </p>
        </div>
        
        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Venue Info</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <span>Aravalli Complex, Sector 2, New Delhi, India</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-brand shrink-0" />
              <span>desk@aravalliauditorium.com</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-brand shrink-0" />
              <span>+91 11 2611 9000</span>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Security & Systems</h4>
          <p className="text-sm text-slate-400 leading-relaxed">
            Merchant clearance executes on active high security Razorpay protocols. Admission occurs strictly via original dynamic PDF barcoded tickets.
          </p>
          <div className="flex items-center gap-2 text-xs text-brand font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Razorpay Secured Gateway</span>
          </div>
        </div>
      </div>
      
      <div className="border-t border-slate-900/40 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Aravalli Auditorium Inc. Developed for internal administrative purposes.
      </div>
    </footer>
  );
};
"""

project_files["frontend/src/components/common/SeatMap.tsx"] = """import React from 'react';

interface Seat {
  id: string;
  section_name: string;
  row_prefix: string;
  col_index: number;
  seat_number: string;
  category_name: 'VIP' | 'Gold' | 'Silver' | 'Bronze';
  price: string;
  status: 'active' | 'disabled' | 'reserved';
}

interface SeatMapProps {
  seats: Seat[];
  bookedSeatIds: string[];
  selectedSeatIds: string[];
  onSeatSelect: (seatId: string) => void;
  maxSelectable?: number;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  seats,
  bookedSeatIds,
  selectedSeatIds,
  onSeatSelect,
  maxSelectable = 6
}) => {
  const sections = React.useMemo(() => {
    const map: Record<string, Record<string, Seat[]>> = {};
    seats.forEach(seat => {
      if (!map[seat.section_name]) map[seat.section_name] = {};
      if (!map[seat.section_name][seat.row_prefix]) map[seat.section_name][seat.row_prefix] = [];
      map[seat.section_name][seat.row_prefix].push(seat);
    });

    Object.keys(map).forEach(secName => {
      Object.keys(map[secName]).forEach(rowPrefix => {
        map[secName][rowPrefix].sort((a, b) => a.col_index - b.col_index);
      });
    });

    return map;
  }, [seats]);

  const getSeatColor = (seat: Seat) => {
    const isSelected = selectedSeatIds.includes(seat.id);
    const isBooked = bookedSeatIds.includes(seat.id);

    if (isSelected) return 'bg-blue-600 hover:bg-blue-500 border border-blue-400';
    if (isBooked) return 'bg-red-650 cursor-not-allowed opacity-90 text-slate-400';
    if (seat.status === 'disabled') return 'bg-gray-700 cursor-not-allowed opacity-30';
    if (seat.status === 'reserved') return 'bg-yellow-600 border border-yellow-500 cursor-not-allowed';
    if (seat.category_name === 'VIP') return 'bg-purple-600 hover:bg-purple-500 border border-purple-400';
    
    return 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/20';
  };

  const handleSeatClick = (seat: Seat) => {
    if (bookedSeatIds.includes(seat.id) || seat.status !== 'active') return;
    if (!selectedSeatIds.includes(seat.id) && selectedSeatIds.length >= maxSelectable) {
      alert(`You can select a maximum of ${maxSelectable} seats.`);
      return;
    }
    onSeatSelect(seat.id);
  };

  return (
    <div className="space-y-12 select-none">
      <div className="relative w-full flex flex-col items-center">
        <div className="w-4/5 h-2 bg-gradient-to-r from-transparent via-amber-500 to-transparent rounded-full shadow-lg shadow-amber-500/10" />
        <span className="text-[10px] text-amber-500 uppercase tracking-widest font-bold mt-2">Projection Screen Direction</span>
      </div>

      <div className="overflow-x-auto seat-map-scrollbar pb-6 flex flex-col gap-10">
        {Object.entries(sections).map(([sectionName, rows]) => (
          <div key={sectionName} className="min-w-[600px] flex flex-col items-center gap-3">
            <h4 className="text-xs uppercase tracking-widest font-bold text-amber-500 border-b border-amber-500/20 pb-1 mb-2">
              {sectionName} Section
            </h4>

            {Object.entries(rows).map(([row_prefix, rowSeats]) => (
              <div key={row_prefix} className="flex items-center gap-4">
                <span className="w-6 text-sm font-bold text-slate-500">{row_prefix}</span>
                <div className="flex gap-2">
                  {rowSeats.map(seat => (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => handleSeatClick(seat)}
                      className={`w-10 h-10 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${getSeatColor(seat)}`}
                      title={`${seat.seat_number} - ${seat.category_name} (INR ${seat.price})`}
                    >
                      {seat.col_index}
                    </button>
                  ))}
                </div>
                <span className="w-6 text-sm font-bold text-slate-500">{row_prefix}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-400 pt-6 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-600 border border-emerald-500/20" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-600 border border-purple-400" />
          <span>VIP Seats</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-600 border border-blue-400" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-650" />
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-600 border border-yellow-500" />
          <span>Reserved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-700 opacity-30" />
          <span>Disabled</span>
        </div>
      </div>
    </div>
  );
};
"""

# --- FRONTEND PAGES ---
project_files["frontend/src/pages/LandingPage.tsx"] = """import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Compass, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { api } from '../services/api';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/events')
      .then(setEvents)
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen">
      <section className="relative h-[80vh] flex items-center justify-center px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-background to-background z-0" />
        
        <div className="relative z-10 text-center max-w-4xl mx-auto space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs text-brand"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Delhi's Premier Cinema Experience
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400"
          >
            Experience Cinema in Majesty
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Curated movie showtimes, weekly public polls, and luxury seat maps for the ultimate weekend screening.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex gap-4 justify-center pt-4"
          >
            <Button onClick={() => navigate('/events')} variant="primary" size="lg" className="gap-2">
              Explore Showtimes <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Curated Playbills</h2>
            <p className="text-slate-400 text-sm mt-1">Select from our weekly verified screenings list.</p>
          </div>
          <Button onClick={() => navigate('/events')} variant="ghost" className="text-brand hover:text-brand-light gap-2 font-bold">
            View All Showtimes <Compass className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {events.slice(0, 3).map((event) => (
            <motion.div 
              key={event.id}
              whileHover={{ y: -5 }}
              className="group cursor-pointer"
              onClick={() => navigate(`/events/${event.id}`)}
            >
              <Card className="h-full flex flex-col p-0 bg-cinema-card">
                <div className="h-48 overflow-hidden relative">
                  <img 
                    src={event.poster_url || "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&q=80&w=600"} 
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-800/60 px-3 py-1 rounded-md text-xs text-brand font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {event.date}
                  </div>
                </div>
                
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-200 group-hover:text-brand transition duration-200">{event.title}</h3>
                    <p className="text-sm text-slate-400 line-clamp-2 mt-2 leading-relaxed">{event.description}</p>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-slate-900">
                    <span className="text-xs text-slate-500 font-semibold font-bold">Premium Seating Tiers</span>
                    <span className="text-xs font-semibold text-brand flex items-center gap-1 font-bold">
                      Details <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};
"""

project_files["frontend/src/pages/Login.tsx"] = """import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { LogIn } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full p-8 bg-cinema-card">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-brand/10 text-brand items-center justify-center mb-4">
            <LogIn className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Portal Authentication</h2>
          <p className="text-sm text-slate-400 mt-1.5">Sign in to manage and download booking passes.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <Input 
            label="Email Address" 
            type="email" 
            placeholder="yourname@gmail.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input 
            label="Password" 
            type="password" 
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-xs text-rose-500 bg-rose-950/20 border border-rose-950/40 p-3 rounded-lg">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Need an account? <Link to="/signup" className="text-brand hover:underline font-medium">Create one</Link>
        </p>
      </Card>
    </div>
  );
};
"""

project_files["frontend/src/pages/Signup.tsx"] = """import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { UserPlus } from 'lucide-react';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'admin'
        }
      }
    });

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full p-8 bg-cinema-card">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-brand/10 text-brand items-center justify-center mb-4">
            <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Create Profile</h2>
          <p className="text-sm text-slate-400 mt-1.5">Create your account to start reserving seats.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          <Input 
            label="Full Name" 
            type="text" 
            placeholder="Aravalli Operator"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
          />
          <Input 
            label="Email Address" 
            type="email" 
            placeholder="attendee@gmail.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input 
            label="Password" 
            type="password" 
            placeholder="Min 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-xs text-rose-500 bg-rose-950/20 border border-rose-950/40 p-3 rounded-lg">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Register Profile'}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Registered already? <Link to="/login" className="text-brand hover:underline font-medium">Sign In</Link>
        </p>
      </Card>
    </div>
  );
};
"""

project_files["frontend/src/pages/EventsPage.tsx"] = """import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { Calendar, Search, MapPin } from 'lucide-react';

export const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/events')
      .then(res => {
        setEvents(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filtered = events.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-900 pb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 font-bold">Weekly Scheduled Cinema Showtimes</h1>
          <p className="text-slate-400 mt-1">Select from our scheduling and book dynamic placement seats easily.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
          <input 
            type="text"
            placeholder="Search movies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-3 pl-11 pr-4 text-sm text-slate-100 focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {filtered.map(event => (
          <Card key={event.id} className="p-0 flex flex-col group h-full bg-cinema-card">
            <div className="h-48 overflow-hidden relative">
              <img 
                src={event.poster_url || "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&q=80&w=600"} 
                alt={event.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
              />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
              <div className="space-y-2">
                <h3 className="text-lg font-bold group-hover:text-brand transition">{event.title}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-brand" />
                  <span>{event.date} at {event.time}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-brand" />
                  <span>{event.venue}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-900/60">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold font-bold">Dynamic Tiers Pricing</span>
                  <span className="text-sm font-bold text-slate-200">Seated Pass</span>
                </div>
                <Button onClick={() => navigate(`/events/${event.id}`)} variant="primary" size="sm">
                  View Timing Details
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
"""

project_files["frontend/src/pages/EventDetails.tsx"] = """import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { Calendar, MapPin, Clock, ArrowLeft } from 'lucide-react';

export const EventDetails: React.FC = () => {
  const { event_id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (event_id) {
      api.get(`/api/events/${event_id}`)
        .then(res => {
          setEvent(res);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [event_id]);

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!event) return <div className="text-center py-20 text-slate-400">Show details not located.</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to listings
      </button>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
        <div className="md:col-span-5 h-[400px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
          <img 
            src={event.poster_url || "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&q=80&w=600"} 
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="md:col-span-7 flex flex-col justify-between space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-extrabold text-slate-100">{event.title}</h1>
            <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">{event.description}</p>
          </div>

          <Card className="grid grid-cols-2 gap-6 bg-cinema-card border-slate-900/60">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500 font-bold">Scheduled Date</span>
                <p className="text-sm font-semibold text-slate-300 mt-0.5">{event.date}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500 font-bold">Session Bell</span>
                <p className="text-sm font-semibold text-slate-300 mt-0.5">{event.time}</p>
              </div>
            </div>
            <div className="col-span-2 flex items-start gap-3 border-t border-slate-900 pt-4">
              <MapPin className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500 font-bold">Venue Location</span>
                <p className="text-sm font-semibold text-slate-300 mt-0.5">{event.venue}</p>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between border-t border-slate-900/60 pt-6">
            <div>
              <span className="text-xs text-slate-500 font-medium font-bold">Aravalli Seating Layouts</span>
              <p className="text-xl font-extrabold text-slate-200">Interactive Map</p>
            </div>
            <Button onClick={() => navigate(`/book/${event.id}`)} variant="primary" size="lg">
              Book Dynamic Seat Ticket
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
"""

project_files["frontend/src/pages/TicketBooking.tsx"] = """import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Spinner } from '../components/common/Spinner';
import { SeatMap } from '../components/common/SeatMap';
import { api } from '../services/api';
import { ShieldCheck, Info } from 'lucide-react';

export const TicketBooking: React.FC = () => {
  const { event_id } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState<any>(null);
  const [seats, setSeats] = useState<any[]>([]);
  const [bookedSeatIds, setBookedSeatIds] = useState<string[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const showData = await api.get(`/api/events/${event_id}`);
      setShow(showData);

      const [allSeats, availability] = await Promise.all([
        api.get('/api/admin/seats/layout'),
        api.get(`/api/bookings/availability/${event_id}`)
      ]);

      setSeats(allSeats);
      setBookedSeatIds(availability.booked_seat_layout_ids || []);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch show configurations.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (event_id) {
      loadData();
    }
  }, [event_id]);

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;
  if (error || !show) return <div className="text-center py-20 text-red-500">{error || 'Session details missing.'}</div>;

  const selectedSeats = seats.filter(s => selectedSeatIds.includes(s.id));
  const subtotal = selectedSeats.reduce((sum, s) => sum + parseFloat(s.price), 0);
  const convenienceFee = 30.00 * selectedSeatIds.length;
  const gst = (subtotal + convenienceFee) * 0.18;
  const total = subtotal + convenienceFee + gst;

  const handleSeatSelect = (seatId: string) => {
    setSelectedSeatIds(prev =>
      prev.includes(seatId) ? prev.filter(id => id !== seatId) : [...prev, seatId]
    );
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeatIds.length === 0) {
      setError('Please select at least one seat from the auditorium map.');
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone details are required.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const checkoutData = await api.post('/api/bookings/', {
        show_id: show.id,
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        seat_layout_ids: selectedSeatIds
      });

      navigate('/checkout', { state: { ...checkoutData } });
    } catch (err: any) {
      setError(err.message || "Failed to secure ticket seat booking lock.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start gap-12">
        <div className="w-full md:w-3/5 space-y-8">
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-3xl font-extrabold text-slate-100 font-bold">Select Seating Placement</h1>
            <p className="text-slate-400 mt-1">Select seat placements inside the auditorium. Max 6 seats per transaction.</p>
          </div>

          <Card className="bg-cinema-card p-8">
            <SeatMap
              seats={seats}
              bookedSeatIds={bookedSeatIds}
              selectedSeatIds={selectedSeatIds}
              onSeatSelect={handleSeatSelect}
              maxSelectable={6}
            />
          </Card>
        </div>

        <div className="w-full md:w-2/5 space-y-6">
          <form onSubmit={handleCheckout} className="space-y-6">
            <Card className="bg-cinema-card p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-500 mb-2 font-bold font-bold">1. Admission Pass Holder</h3>
              
              <Input label="Full Name" required value={name} onChange={e => setName(e.target.value)} />
              <Input label="Phone Number" required value={phone} onChange={e => setPhone(e.target.value)} />
              <Input label="Email (Optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} />

              <div className="flex gap-2 text-[11px] text-slate-400 p-3 bg-slate-900 rounded-lg">
                <Info className="w-4 h-4 text-amber-500 shrink-0" />
                <span>No login required. We will use these details to dispatch your QR code ticket.</span>
              </div>
            </Card>

            <Card className="bg-cinema-card p-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-500 mb-6 font-bold font-bold">2. Order Overview</h3>
              
              <div className="space-y-4 text-sm text-slate-400">
                <div className="flex justify-between">
                  <span>Showtime Selected</span>
                  <span className="text-slate-100 font-semibold">{show.date} at {show.time}</span>
                </div>
                <div className="flex justify-between">
                  <span>Selected Seats</span>
                  <span className="text-amber-500 font-bold">
                    {selectedSeats.length > 0 ? selectedSeats.map(s => s.seat_number).join(', ') : 'None'}
                  </span>
                </div>

                <div className="h-px bg-slate-800 my-4" />

                <div className="flex justify-between text-xs">
                  <span>Seats Subtotal</span>
                  <span>INR {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Convenience Booking Fee</span>
                  <span>INR {convenienceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Calculated GST (18%)</span>
                  <span>INR {gst.toFixed(2)}</span>
                </div>

                <div className="h-px bg-slate-800 my-4" />

                <div className="flex justify-between items-end text-slate-100 font-bold">
                  <span className="text-sm font-semibold">Grand Total</span>
                  <span className="text-2xl text-amber-500">INR {total.toFixed(2)}</span>
                </div>
              </div>

              {error && <p className="text-xs text-red-500 bg-red-950/20 border border-red-900/50 p-3 rounded-lg mt-4">{error}</p>}

              <Button
                type="submit"
                className="w-full mt-6 bg-gold-gradient text-slate-950 font-bold gap-2"
                disabled={submitting || selectedSeatIds.length === 0 || !name || !phone}
              >
                <ShieldCheck className="w-5 h-5" /> Lock Seats & Checkout
              </Button>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
};
"""

project_files["frontend/src/pages/Checkout.tsx"] = """import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRazorpay } from '../hooks/useRazorpay';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { CreditCard, ArrowRight, ShieldCheck } from 'lucide-react';

export const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isScriptLoaded = useRazorpay();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const { booking, razorpay_order } = location.state || {};

  useEffect(() => {
    if (!booking || !razorpay_order) {
      navigate('/events');
    }
  }, [booking, razorpay_order, navigate]);

  const handlePayment = () => {
    if (!isScriptLoaded) {
      setError("Razorpay integration script could not be loaded.");
      return;
    }

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
      amount: razorpay_order.amount,
      currency: razorpay_order.currency,
      name: "Aravalli Auditorium",
      description: `Cinema Ticketing pass for Booking ID \${booking.id}`,
      order_id: razorpay_order.id,
      handler: async (response: any) => {
        setVerifying(true);
        setError('');
        try {
          const verification = await api.post('/api/bookings/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          if (verification.status === 'success') {
            navigate(`/confirmation/\${verification.booking_id}`);
          } else {
            setError("Signature processing verification mismatch.");
          }
        } catch (err: any) {
          console.error("Verification error: ", err);
          setError("Gateway interface handshake error occurred.");
        } finally {
          setVerifying(false);
        }
      },
      prefill: {
        name: booking.customer_name,
        contact: booking.customer_phone,
      },
      theme: {
        color: "#D4AF37",
      },
      modal: {
        ondismiss: () => {
          setError("Payment check-out dismissed by customer.");
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  if (verifying) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
        <Spinner size="lg" />
        <h3 className="text-lg font-semibold text-slate-200 font-bold font-bold">Verifying Booking Payments Signature...</h3>
        <p className="text-sm text-slate-500">Please do not reload your browser interface.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <Card className="bg-cinema-card p-8 text-center space-y-6">
        <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto">
          <CreditCard className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-bold font-bold">Secure Cinema Gate Clearance</h2>
          <p className="text-sm text-slate-400 mt-2">Ready to trigger payment gateway interfaces.</p>
        </div>

        <div className="bg-slate-900 rounded-xl p-4 text-left space-y-2 border border-slate-800">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Invoice Ref</span>
            <span className="text-slate-200 font-mono text-[10px]">{booking?.id}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Passes Volume</span>
            <span className="text-slate-200">{booking?.quantity} Seat(s)</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Clearance Value</span>
            <span className="text-brand font-bold text-gold">INR {booking?.total_amount}</span>
          </div>
        </div>

        {error && <p className="text-xs text-rose-500 bg-rose-950/20 border border-rose-950/40 p-3 rounded-lg text-left">{error}</p>}

        <Button onClick={handlePayment} className="w-full gap-2 py-4 text-sm font-bold bg-gold-gradient text-slate-950" disabled={!isScriptLoaded}>
          Launch Merchant Frame <ArrowRight className="w-4 h-4" />
        </Button>

        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5" /> Secured by 256-bit encryption pipelines.
        </div>
      </Card>
    </div>
  );
};
"""

project_files["frontend/src/pages/Confirmation.tsx"] = """import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { CheckCircle, Download, Compass } from 'lucide-react';

export const Confirmation: React.FC = () => {
  const { booking_id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookingDetails = async () => {
      try {
        const bookingsList = await api.get('/api/bookings');
        const match = bookingsList.find((b: any) => b.id === booking_id);
        setBooking(match);
      } catch (err) {
        console.error("Failed to retrieve booking confirmation details: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookingDetails();
  }, [booking_id]);

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!booking) return <div className="text-center py-20 text-slate-400">Booking configuration mismatch.</div>;

  const handleDownload = () => {
    const url = api.getDownloadUrl(booking.id);
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-12 text-center">
      <Card className="bg-cinema-card p-8 space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-brand flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-black font-bold text-gold">Admission Pass Locked Successfully</h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            Your dynamic verification pass is ready. Please download your original PDF copy for security check desks.
          </p>
        </div>

        <div className="border border-dashed border-slate-800 bg-slate-900 rounded-2xl p-6 text-left space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Pass Clearance Reference</span>
            <span className="font-mono text-slate-200 text-[11px] font-bold">{booking.id}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Total Value Cleared</span>
            <span className="text-brand font-extrabold text-sm text-gold">INR {booking.total_amount}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button onClick={handleDownload} variant="primary" className="gap-2 justify-center py-3 text-xs uppercase tracking-wider font-bold">
            <Download className="w-4 h-4" /> Download Ticket
          </Button>
          <Button onClick={() => navigate('/events')} variant="secondary" className="gap-2 justify-center py-3 text-xs uppercase tracking-wider">
            <Compass className="w-4 h-4" /> Discover Movies
          </Button>
        </div>
      </Card>
    </div>
  );
};
"""

project_files["frontend/src/pages/MyBookings.tsx"] = """import React, { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { Calendar, Download, Ticket } from 'lucide-react';

export const MyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/bookings')
      .then(res => {
        setBookings(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleDownload = (bookingId: string) => {
    window.open(api.getDownloadUrl(bookingId), '_blank');
  };

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-100 font-bold">My Cinema Passes</h1>
        <p className="text-slate-400 mt-1">Manage and access your original seat ticket credentials.</p>
      </div>

      {bookings.length === 0 ? (
        <Card className="text-center py-16 bg-cinema-card space-y-4">
          <Ticket className="w-12 h-12 text-slate-655 mx-auto" />
          <h3 className="text-slate-300 font-bold text-lg">No active tickets located</h3>
          <p className="text-sm text-slate-500">Select an event playbill from the schedule grid and complete checkout.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {bookings.map(booking => (
            <Card key={booking.id} className="bg-cinema-card flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-slate-900 gap-6">
              <div className="space-y-2">
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest \${
                  booking.status === 'confirmed' ? 'bg-brand/10 text-brand border border-brand/20 text-gold font-bold' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {booking.status}
                </span>
                <h3 className="text-lg font-bold text-slate-100">{booking.event_title || 'Aravalli Auditorium Performance'}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Reserved on {new Date(booking.created_at).toLocaleDateString()}</span>
                </div>
                <div className="text-xs text-slate-500">
                  Value: <strong className="text-slate-300">INR {booking.total_amount}</strong>
                </div>
              </div>
              
              {booking.status === 'confirmed' && (
                <Button onClick={() => handleDownload(booking.id)} variant="secondary" size="sm" className="gap-2 shrink-0">
                  <Download className="w-4 h-4" /> Download PDF Pass
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
"""

project_files["frontend/src/pages/AdminDashboard.tsx"] = """import React, { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Spinner } from '../components/common/Spinner';
import { Modal } from '../components/common/Modal';
import { api } from '../services/api';
import { BarChart3, Database, FileText, Plus, Trash2 } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [genre, setGenre] = useState('');
  const [certificate, setCertificate] = useState('');
  const [language, setLanguage] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/admin/dashboard-stats'),
      api.get('/api/admin/bookings'),
      api.get('/api/events')
    ]).then(([statsRes, bookingsRes, eventsRes]) => {
      setStats(statsRes);
      setBookings(bookingsRes);
      setEvents(eventsRes);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportCSV = () => {
    const headers = ['Booking ID', 'Movie Title', 'Customer Name', 'Customer Phone', 'Amount Paid', 'Status', 'Timestamp'];
    const rows = bookings.map(b => [
      b.id,
      b.event_title,
      b.customer_name,
      b.customer_phone,
      b.total_amount,
      b.status,
      b.created_at
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\\\\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "aravalli_movie_bookings.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setCreating(true);

    if (!title || !date || !time) {
      setFormError('Title, Date and Time are mandatory parameters.');
      setCreating(false);
      return;
    }

    try {
      const movieRes = await api.post('/api/events/', {
        title,
        description,
        date,
        time,
        venue: "Aravalli Auditorium Main Hall",
        poster_url: "",
        status: "active",
        categories: [
          { name: "Gold", price: 1200, total_seats: 50 },
          { name: "Silver", price: 800, total_seats: 100 },
          { name: "Bronze", price: 450, total_seats: 150 }
        ]
      });

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to establish movie database session.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (window.confirm("Confirm deletion of this showtime program?")) {
      try {
        await api.delete(`/api/admin/events/\${eventId}`);
        loadData();
      } catch (err) {
        alert("Failed to remove target event playbill record.");
      }
    }
  };

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 font-bold">Auditorium Administration Panel</h1>
          <p className="text-slate-400 mt-1 font-medium">Verify daily check-ins, occupancy counts, revenue metrics, and seating layouts.</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => setIsModalOpen(true)} variant="primary" className="gap-2 bg-gold-gradient text-slate-950 font-bold">
            <Plus className="w-4 h-4" /> Add Showtime Playbill
          </Button>
          <Button onClick={handleExportCSV} variant="secondary">
            Export Report CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-cinema-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold font-bold">Weekly Seated Revenue</span>
            <p className="text-3xl font-extrabold text-slate-100 mt-2 text-gold">INR {stats?.total_revenue?.toLocaleString() || '0'}</p>
          </div>
          <BarChart3 className="w-10 h-10 text-brand opacity-80 text-gold" />
        </Card>
        <Card className="bg-cinema-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold font-bold">Cinema Occupancy Count</span>
            <p className="text-3xl font-extrabold text-slate-100 mt-2">{stats?.total_seats_sold || '0'}</p>
          </div>
          <Database className="w-10 h-10 text-brand opacity-80 text-gold" />
        </Card>
        <Card className="bg-cinema-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold font-bold">Reserved Seats (Admin Lock)</span>
            <p className="text-3xl font-extrabold text-slate-100 mt-2">{stats?.total_reserved_seats || '0'}</p>
          </div>
          <FileText className="w-10 h-10 text-brand opacity-80 text-gold" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-lg font-bold">Manage Event List</h3>
          <div className="space-y-4">
            {events.map(event => (
              <Card key={event.id} className="p-4 bg-cinema-card flex items-center justify-between border-slate-900">
                <div>
                  <h4 className="font-bold text-slate-200">{event.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{event.date} at {event.time}</p>
                </div>
                <button 
                  onClick={() => handleDeleteEvent(event.id)}
                  className="text-slate-500 hover:text-rose-500 p-2 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Card>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <h3 className="text-lg font-bold">Live Cinema Reservations Ledgers</h3>
          <div className="bg-cinema-card rounded-2xl border border-slate-900 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="text-xs uppercase bg-slate-900/60 text-slate-400 font-bold border-b border-slate-850">
                <tr>
                  <th className="px-6 py-4">Booking Ref</th>
                  <th className="px-6 py-4">Movie Showtime</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Value</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-900/10 transition">
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{booking.id}</td>
                    <td className="px-6 py-4 text-slate-200 font-semibold">{booking.event_title}</td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300 font-medium">{booking.customer_name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{booking.customer_phone}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-100 font-semibold">INR {booking.total_amount}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest \${
                        booking.status === 'confirmed' ? 'bg-brand/10 text-brand border border-brand/20 text-gold font-bold' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Film Scheduled Showtime">
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <Input label="Movie Title" required value={title} onChange={e => setTitle(e.target.value)} />
          <Input label="Synopsis" value={description} onChange={e => setDescription(e.target.value)} />
          
          <div className="flex gap-4">
            <Input label="Scheduled Screening Date" type="date" required value={date} onChange={e => setDate(e.target.value)} />
            <Input label="Session Showtime" type="time" required value={time} onChange={e => setTime(e.target.value)} />
          </div>

          {formError && <p className="text-xs text-rose-500">{formError}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={creating}>{creating ? 'Saving...' : 'Add Showtime'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
"""

project_files["frontend/src/pages/CheckInScanner.tsx"] = """import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Spinner } from '../components/common/Spinner';
import { api } from '../services/api';
import { Scan, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const CheckInScanner: React.FC = () => {
  const [bookingId, setBookingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await api.post(`/api/admin/check-in/\${bookingId.trim()}`, {});
      setResult(response);
    } catch (err: any) {
      setError(err.message || "Checking ticket state failed.");
    } finally {
      setLoading(false);
    }
  };

  const clearScanner = () => {
    setBookingId('');
    setResult(null);
    setError('');
  };

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <Card className="bg-cinema-card p-8 border border-amber-500/20 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 items-center justify-center">
            <Scan className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-100 font-bold font-bold">Auditorium Check-In Scanner</h2>
          <p className="text-sm text-slate-400">Scan or enter the Booking ID of the ticket pass.</p>
        </div>

        {!result && !error ? (
          <form onSubmit={handleScanSubmit} className="space-y-4">
            <Input
              label="Enter Ticket ID"
              placeholder="e.g. ARA2026102345"
              value={bookingId}
              onChange={e => setBookingId(e.target.value)}
              required
            />
            <Button
              type="submit"
              className="w-full bg-gold-gradient text-slate-950 font-bold"
              disabled={loading || !bookingId.trim()}
            >
              {loading ? <Spinner size="sm" /> : 'Validate & Check In'}
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            {error ? (
              <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-xl text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
                <div>
                  <h4 className="font-bold text-red-500">Ticket Validation Failed</h4>
                  <p className="text-sm text-slate-300 mt-1">{error}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-xl text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <div>
                  <h4 className="font-bold text-emerald-500 font-bold">Access Granted Successfully</h4>
                  <p className="text-sm text-slate-300 mt-1">Booking {result.booking_id} checked in successfully.</p>
                  <p className="text-xs text-slate-400 mt-2">Pass Holder: {result.customer_name}</p>
                </div>
              </div>
            )}

            <Button onClick={clearScanner} className="w-full" variant="secondary">
              Scan Next Ticket
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
"""

# 3. Write All Files (Safely Handling Unicode Characters on Windows)
for filepath, content in project_files.items():
    parent_dir = os.path.dirname(filepath)
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Written file successfully: {filepath}")

print("\\n" + "="*50)
print("PROJECT SETUP COMPLETE!")
print("="*50)
print("You can now do the following:")
print("1. Update your .env files in backend/ and frontend/ with your actual API keys.")
print("2. Run your Supabase database.sql updates.")
print("3. Install packages and run your servers.")
print("="*50 + "\\n")
