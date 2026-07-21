-- Aravalli Auditorium - clean database installation
-- WARNING: This script deletes all existing application data.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Remove current and legacy application objects.
DROP TABLE IF EXISTS public.notification_deliveries CASCADE;
DROP TABLE IF EXISTS public.poll_votes CASCADE;
DROP TABLE IF EXISTS public.poll_options CASCADE;
DROP TABLE IF EXISTS public.polls CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.booking_seats CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.checkout_session_seats CASCADE;
DROP TABLE IF EXISTS public.checkout_sessions CASCADE;
DROP TABLE IF EXISTS public.seat_holds CASCADE;
DROP TABLE IF EXISTS public.show_seat_reservations CASCADE;
DROP TABLE IF EXISTS public.seat_layouts CASCADE;
DROP TABLE IF EXISTS public.shows CASCADE;
DROP TABLE IF EXISTS public.movies CASCADE;
DROP TABLE IF EXISTS public.app_settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.ticket_categories CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;

DROP FUNCTION IF EXISTS public.increment_vote(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.enforce_one_movie_per_week() CASCADE;
DROP FUNCTION IF EXISTS public.generate_booking_code() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;

-- Shared trigger for updated_at columns.
CREATE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Runtime settings kept in the database instead of hardcoded in the UI.
CREATE TABLE public.app_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    max_seats_per_booking INTEGER NOT NULL DEFAULT 6
        CHECK (max_seats_per_booking BETWEEN 1 AND 20),
    seat_hold_minutes INTEGER NOT NULL DEFAULT 10
        CHECK (seat_hold_minutes BETWEEN 1 AND 30),
    convenience_fee_per_seat NUMERIC(10, 2) NOT NULL DEFAULT 0.00
        CHECK (convenience_fee_per_seat >= 0),
    gst_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00
        CHECK (gst_percentage BETWEEN 0 AND 100),
    razorpay_fee_percentage NUMERIC(5, 2) NOT NULL DEFAULT 2.00
        CHECK (razorpay_fee_percentage BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_settings (id) VALUES (1);

CREATE TRIGGER app_settings_set_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin identities. Customers never need accounts.
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    synopsis TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    genre TEXT NOT NULL,
    certificate TEXT NOT NULL,
    language TEXT NOT NULL,
    cast_members TEXT,
    director TEXT,
    release_year INTEGER NOT NULL CHECK (release_year BETWEEN 1888 AND 2200),
    poster_url TEXT,
    trailer_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movies_active ON public.movies(is_active);
CREATE INDEX idx_movies_title ON public.movies(title);

CREATE TRIGGER movies_set_updated_at
BEFORE UPDATE ON public.movies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A show is permitted only at the auditorium's official screening times.
CREATE TABLE public.shows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES public.movies(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    time TIME NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_show_slot UNIQUE (date, time),
    CONSTRAINT valid_show_schedule CHECK (
        (EXTRACT(ISODOW FROM date) IN (3, 4, 5) AND time = TIME '19:00')
        OR
        (EXTRACT(ISODOW FROM date) IN (6, 7) AND time IN (TIME '14:00', TIME '19:00'))
    )
);

CREATE INDEX idx_shows_upcoming ON public.shows(date, time) WHERE is_enabled = TRUE;
CREATE INDEX idx_shows_movie ON public.shows(movie_id);

CREATE TRIGGER shows_set_updated_at
BEFORE UPDATE ON public.shows
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prevent different movies from being scheduled during the same ISO week.
CREATE FUNCTION public.enforce_one_movie_per_week()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.shows existing_show
        WHERE DATE_TRUNC('week', existing_show.date::timestamp)
              = DATE_TRUNC('week', NEW.date::timestamp)
          AND existing_show.movie_id <> NEW.movie_id
          AND existing_show.id <> NEW.id
    ) THEN
        RAISE EXCEPTION 'Only one movie can be scheduled per week';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER shows_one_movie_per_week
BEFORE INSERT OR UPDATE OF movie_id, date ON public.shows
FOR EACH ROW EXECUTE FUNCTION public.enforce_one_movie_per_week();

-- Physical auditorium layout. Booking state is stored per show, not here.
CREATE TABLE public.seat_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_name TEXT NOT NULL,
    row_prefix TEXT NOT NULL,
    row_index INTEGER NOT NULL CHECK (row_index > 0),
    col_index INTEGER NOT NULL CHECK (col_index > 0),
    seat_number TEXT NOT NULL,
    category_name TEXT NOT NULL
        CHECK (category_name IN ('Gold', 'Silver', 'Bronze')),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled')),
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_seat_number UNIQUE (seat_number),
    CONSTRAINT unique_seat_position UNIQUE (section_name, row_prefix, col_index)
);

CREATE INDEX idx_seat_layout_display
    ON public.seat_layouts(section_name, row_index, col_index);

CREATE TRIGGER seat_layouts_set_updated_at
BEFORE UPDATE ON public.seat_layouts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin reservations are show-specific.
CREATE TABLE public.show_seat_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
    seat_layout_id UUID NOT NULL REFERENCES public.seat_layouts(id) ON DELETE RESTRICT,
    reason TEXT,
    reserved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_show_reserved_seat UNIQUE (show_id, seat_layout_id)
);

CREATE INDEX idx_show_reservations_show
    ON public.show_seat_reservations(show_id);

-- Checkout sessions temporarily own seats while Razorpay is open.
CREATE TABLE public.checkout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    convenience_fee NUMERIC(10, 2) NOT NULL CHECK (convenience_fee >= 0),
    gst_amount NUMERIC(10, 2) NOT NULL CHECK (gst_amount >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    razorpay_order_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'failed')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checkout_sessions_expiry
    ON public.checkout_sessions(status, expires_at);
CREATE INDEX idx_checkout_sessions_email
    ON public.checkout_sessions(LOWER(customer_email));

CREATE TRIGGER checkout_sessions_set_updated_at
BEFORE UPDATE ON public.checkout_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.checkout_session_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkout_session_id UUID NOT NULL
        REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
    show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
    seat_layout_id UUID NOT NULL REFERENCES public.seat_layouts(id) ON DELETE RESTRICT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_checkout_session_seat
        UNIQUE (checkout_session_id, seat_layout_id),
    CONSTRAINT unique_active_show_hold
        UNIQUE (show_id, seat_layout_id)
);

CREATE INDEX idx_checkout_seats_session
    ON public.checkout_session_seats(checkout_session_id);

CREATE FUNCTION public.generate_booking_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
BEGIN
    RETURN 'ARA'
        || TO_CHAR(CURRENT_DATE, 'YYYY')
        || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8));
END;
$$;

-- Final bookings are inserted only after successful payment verification.
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code TEXT NOT NULL UNIQUE DEFAULT public.generate_booking_code(),
    checkout_session_id UUID UNIQUE
        REFERENCES public.checkout_sessions(id) ON DELETE RESTRICT,
    show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    convenience_fee NUMERIC(10, 2) NOT NULL CHECK (convenience_fee >= 0),
    gst_amount NUMERIC(10, 2) NOT NULL CHECK (gst_amount >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed', 'cancelled', 'refunded')),
    is_checked_in BOOLEAN NOT NULL DEFAULT FALSE,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_code_email
    ON public.bookings(booking_code, LOWER(customer_email));
CREATE INDEX idx_bookings_show ON public.bookings(show_id);
CREATE INDEX idx_bookings_created ON public.bookings(created_at DESC);

CREATE TRIGGER bookings_set_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.booking_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE RESTRICT,
    seat_layout_id UUID NOT NULL REFERENCES public.seat_layouts(id) ON DELETE RESTRICT,
    seat_number TEXT NOT NULL,
    category_name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_booking_seat UNIQUE (booking_id, seat_layout_id),
    CONSTRAINT unique_booked_show_seat UNIQUE (show_id, seat_layout_id)
);

CREATE INDEX idx_booking_seats_booking ON public.booking_seats(booking_id);
CREATE INDEX idx_booking_seats_show ON public.booking_seats(show_id);

CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID UNIQUE REFERENCES public.bookings(id) ON DELETE RESTRICT,
    checkout_session_id UUID NOT NULL UNIQUE
        REFERENCES public.checkout_sessions(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL DEFAULT 'razorpay' CHECK (provider = 'razorpay'),
    provider_order_id TEXT NOT NULL UNIQUE,
    provider_payment_id TEXT UNIQUE,
    provider_signature TEXT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    status TEXT NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'captured', 'failed', 'refunded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON public.payments(provider_order_id);

CREATE TRIGGER payments_set_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Poll tables are created now but their application flow can be implemented later.
CREATE TABLE public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL UNIQUE,
    voting_starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    voting_ends_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'voting', 'closed', 'overridden')),
    winning_movie_id UUID REFERENCES public.movies(id) ON DELETE SET NULL,
    overridden_movie_id UUID REFERENCES public.movies(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_poll_window CHECK (voting_ends_at > voting_starts_at)
);

CREATE TRIGGER polls_set_updated_at
BEFORE UPDATE ON public.polls
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    movie_id UUID NOT NULL REFERENCES public.movies(id) ON DELETE RESTRICT,
    votes_count INTEGER NOT NULL DEFAULT 0 CHECK (votes_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_poll_movie UNIQUE (poll_id, movie_id)
);

CREATE INDEX idx_poll_options_poll ON public.poll_options(poll_id);

CREATE TABLE public.poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    poll_option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    fingerprint_hash TEXT NOT NULL,
    phone_hash TEXT,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_poll_fingerprint UNIQUE (poll_id, fingerprint_hash)
);

CREATE INDEX idx_poll_votes_option ON public.poll_votes(poll_option_id);

CREATE FUNCTION public.increment_vote(option_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.poll_options
    SET votes_count = votes_count + 1
    WHERE id = option_uuid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Poll option not found';
    END IF;
END;
$$;

-- Future email/SMS/WhatsApp delivery audit trail.
CREATE TABLE public.notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
    recipient TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed')),
    provider_message_id TEXT,
    error_message TEXT,
    attempted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_booking
    ON public.notification_deliveries(booking_id);

-- Backend-only data access. The frontend must use the FastAPI service.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.show_seat_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_session_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_vote(UUID) TO service_role;

-- Initial auditorium layout. Replace or expand through the later admin editor.
INSERT INTO public.seat_layouts (
    section_name,
    row_prefix,
    row_index,
    col_index,
    seat_number,
    category_name,
    price
)
VALUES
    ('Balcony', 'A', 1, 1, 'A-1', 'Gold', 600.00),
    ('Balcony', 'A', 1, 2, 'A-2', 'Gold', 600.00),
    ('Balcony', 'A', 1, 3, 'A-3', 'Gold', 600.00),
    ('Balcony', 'A', 1, 4, 'A-4', 'Gold', 600.00),
    ('Balcony', 'A', 1, 5, 'A-5', 'Gold', 600.00),
    ('Ground Left', 'B', 2, 1, 'B-1', 'Gold', 400.00),
    ('Ground Left', 'B', 2, 2, 'B-2', 'Gold', 400.00),
    ('Ground Left', 'B', 2, 3, 'B-3', 'Gold', 400.00),
    ('Ground Right', 'B', 2, 4, 'B-4', 'Gold', 400.00),
    ('Ground Right', 'B', 2, 5, 'B-5', 'Gold', 400.00),
    ('Ground Left', 'C', 3, 1, 'C-1', 'Silver', 300.00),
    ('Ground Left', 'C', 3, 2, 'C-2', 'Silver', 300.00),
    ('Ground Left', 'C', 3, 3, 'C-3', 'Silver', 300.00),
    ('Ground Right', 'C', 3, 4, 'C-4', 'Silver', 300.00),
    ('Ground Right', 'C', 3, 5, 'C-5', 'Silver', 300.00);

COMMIT;

-- Refresh Supabase PostgREST after recreating the schema.
NOTIFY pgrst, 'reload schema';
