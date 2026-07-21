-- Aravalli Auditorium - development seed data
-- Run this only after database.sql completes successfully.
-- This script is safe to run more than once.

BEGIN;

-- Sample movie catalogue.
INSERT INTO public.movies (
    title,
    synopsis,
    duration_minutes,
    genre,
    certificate,
    language,
    cast_members,
    director,
    release_year,
    poster_url,
    trailer_url
)
SELECT
    seed.title,
    seed.synopsis,
    seed.duration_minutes,
    seed.genre,
    seed.certificate,
    seed.language,
    seed.cast_members,
    seed.director,
    seed.release_year,
    seed.poster_url,
    seed.trailer_url
FROM (
    VALUES
        (
            'Aravalli Nights',
            'A young photographer uncovers a forgotten story hidden in the Aravalli hills.',
            128,
            'Drama',
            'U/A',
            'Hindi',
            'Aarav Mehta, Kavya Sharma',
            'Rohan Kapoor',
            2026,
            'https://placehold.co/600x900/172033/D4AF37?text=Aravalli+Nights',
            'https://www.youtube.com/'
        ),
        (
            'Desert Signal',
            'A mysterious radio transmission leads three friends across the Rajasthan desert.',
            116,
            'Adventure',
            'U/A',
            'Hindi',
            'Vihaan Singh, Anaya Verma',
            'Meera Joshi',
            2026,
            'https://placehold.co/600x900/B45309/FFFFFF?text=Desert+Signal',
            'https://www.youtube.com/'
        ),
        (
            'Monsoon Letters',
            'Two strangers discover a collection of letters that changes both their lives.',
            104,
            'Romance',
            'U',
            'Hindi',
            'Ishaan Roy, Tara Nair',
            'Neha Malhotra',
            2025,
            'https://placehold.co/600x900/075985/FFFFFF?text=Monsoon+Letters',
            'https://www.youtube.com/'
        ),
        (
            'The Last Projection',
            'An ageing projectionist prepares an auditorium for one unforgettable final screening.',
            121,
            'Mystery',
            'U/A',
            'Hindi',
            'Kabir Anand, Rhea Sen',
            'Dev Khanna',
            2026,
            'https://placehold.co/600x900/3F3F46/D4AF37?text=The+Last+Projection',
            'https://www.youtube.com/'
        ),
        (
            'City of Kites',
            'A spirited teenager enters Jaipur''s largest kite competition to save a family tradition.',
            110,
            'Family',
            'U',
            'Hindi',
            'Reyansh Patel, Myra Desai',
            'Anil Batra',
            2026,
            'https://placehold.co/600x900/0369A1/FFFFFF?text=City+of+Kites',
            'https://www.youtube.com/'
        )
) AS seed (
    title,
    synopsis,
    duration_minutes,
    genre,
    certificate,
    language,
    cast_members,
    director,
    release_year,
    poster_url,
    trailer_url
)
WHERE NOT EXISTS (
    SELECT 1 FROM public.movies existing_movie
    WHERE existing_movie.title = seed.title
);

-- Schedule one movie per week for the next three complete weeks.
-- Each week follows the official timetable:
-- Wed/Thu/Fri 7 PM and Sat/Sun 2 PM + 7 PM.
WITH schedule_weeks AS (
    SELECT
        movie.title,
        movie.id AS movie_id,
        CASE movie.title
            WHEN 'Aravalli Nights' THEN 1
            WHEN 'Desert Signal' THEN 2
            WHEN 'Monsoon Letters' THEN 3
        END AS week_offset
    FROM public.movies movie
    WHERE movie.title IN ('Aravalli Nights', 'Desert Signal', 'Monsoon Letters')
),
official_slots AS (
    SELECT *
    FROM (
        VALUES
            (2, TIME '19:00'),
            (3, TIME '19:00'),
            (4, TIME '19:00'),
            (5, TIME '14:00'),
            (5, TIME '19:00'),
            (6, TIME '14:00'),
            (6, TIME '19:00')
    ) AS slots(day_offset, show_time)
),
new_shows AS (
    SELECT
        schedule_weeks.movie_id,
        (
            DATE_TRUNC('week', CURRENT_DATE)::date
            + (schedule_weeks.week_offset * 7)
            + official_slots.day_offset
        ) AS show_date,
        official_slots.show_time
    FROM schedule_weeks
    CROSS JOIN official_slots
    WHERE schedule_weeks.week_offset IS NOT NULL
)
INSERT INTO public.shows (movie_id, date, time, is_enabled)
SELECT movie_id, show_date, show_time, TRUE
FROM new_shows
ON CONFLICT (date, time) DO NOTHING;

-- Keep one disabled physical seat to demonstrate the gray/unavailable state.
UPDATE public.seat_layouts
SET status = 'disabled'
WHERE seat_number = 'C-5';

-- Reserve one seat specifically for the first upcoming show.
INSERT INTO public.show_seat_reservations (
    show_id,
    seat_layout_id,
    reason
)
SELECT
    upcoming_show.id,
    reserved_seat.id,
    'House reservation - seed data'
FROM (
    SELECT id
    FROM public.shows
    WHERE is_enabled = TRUE
      AND date >= CURRENT_DATE
    ORDER BY date, time
    LIMIT 1
) upcoming_show
CROSS JOIN (
    SELECT id
    FROM public.seat_layouts
    WHERE seat_number = 'A-5'
    LIMIT 1
) reserved_seat
ON CONFLICT (show_id, seat_layout_id) DO NOTHING;

-- Create a voting poll for the fourth upcoming week.
INSERT INTO public.polls (
    week_start,
    voting_starts_at,
    voting_ends_at,
    status
)
SELECT
    DATE_TRUNC('week', CURRENT_DATE)::date + 28,
    NOW(),
    (DATE_TRUNC('week', CURRENT_DATE)::date + 27) + TIME '20:00',
    'voting'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.polls
    WHERE week_start = DATE_TRUNC('week', CURRENT_DATE)::date + 28
);

INSERT INTO public.poll_options (poll_id, movie_id)
SELECT poll.id, movie.id
FROM public.polls poll
JOIN public.movies movie
    ON movie.title IN ('The Last Projection', 'City of Kites', 'Desert Signal')
WHERE poll.week_start = DATE_TRUNC('week', CURRENT_DATE)::date + 28
ON CONFLICT (poll_id, movie_id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Quick summary shown in the Supabase SQL result panel.
SELECT 'movies' AS entity, COUNT(*) AS row_count FROM public.movies
UNION ALL
SELECT 'shows', COUNT(*) FROM public.shows
UNION ALL
SELECT 'seats', COUNT(*) FROM public.seat_layouts
UNION ALL
SELECT 'reservations', COUNT(*) FROM public.show_seat_reservations
UNION ALL
SELECT 'polls', COUNT(*) FROM public.polls
UNION ALL
SELECT 'poll options', COUNT(*) FROM public.poll_options;
