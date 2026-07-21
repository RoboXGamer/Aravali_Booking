-- Switch customer identity and booking lookup from phone-first to email-first.
-- Run this once if database.sql was already executed before this change.

BEGIN;

ALTER TABLE public.checkout_sessions
    ALTER COLUMN customer_phone DROP NOT NULL,
    ALTER COLUMN customer_email SET NOT NULL;

ALTER TABLE public.bookings
    ALTER COLUMN customer_phone DROP NOT NULL,
    ALTER COLUMN customer_email SET NOT NULL;

DROP INDEX IF EXISTS public.idx_checkout_sessions_phone;
DROP INDEX IF EXISTS public.idx_bookings_code_phone;

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_email
    ON public.checkout_sessions(LOWER(customer_email));

CREATE INDEX IF NOT EXISTS idx_bookings_code_email
    ON public.bookings(booking_code, LOWER(customer_email));

COMMIT;

NOTIFY pgrst, 'reload schema';
