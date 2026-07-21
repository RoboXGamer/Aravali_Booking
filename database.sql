-- Upgraded database schema for Aravalli Auditorium Cinema Platform
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
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE NOT NULL,
    seat_layout_id UUID REFERENCES public.seat_layouts(id) ON DELETE RESTRICT NOT NULL,
    CONSTRAINT unique_show_seat_booking UNIQUE (show_id, seat_layout_id)
);

-- 7. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
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
DROP POLICY IF EXISTS "Allow public select on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read on movies" ON public.movies;
DROP POLICY IF EXISTS "Allow public read on shows" ON public.shows;
DROP POLICY IF EXISTS "Allow public read on seat_layouts" ON public.seat_layouts;
DROP POLICY IF EXISTS "Allow anonymous read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow anonymous insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow anonymous update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow anonymous read booking_seats" ON public.booking_seats;
DROP POLICY IF EXISTS "Allow anonymous insert booking_seats" ON public.booking_seats;
DROP POLICY IF EXISTS "Allow anonymous read polls" ON public.polls;
DROP POLICY IF EXISTS "Allow anonymous read poll_options" ON public.poll_options;
DROP POLICY IF EXISTS "Allow anonymous read poll_votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Allow anonymous insert poll_votes" ON public.poll_votes;
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
DROP POLICY IF EXISTS "Allow admins all actions" ON public.movies;
DROP POLICY IF EXISTS "Allow admins all actions on shows" ON public.shows;
DROP POLICY IF EXISTS "Allow admins all actions on seat_layouts" ON public.seat_layouts;
DROP POLICY IF EXISTS "Allow admins all actions on polls" ON public.polls;
DROP POLICY IF EXISTS "Allow admins all actions on poll_options" ON public.poll_options;
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
