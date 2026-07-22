-- Remove the discontinued refund state from an existing deployment.
-- Run once in the Supabase SQL editor after the earlier schema migrations.

BEGIN;

-- A refunded booking is no longer active, so retain it as cancelled.
UPDATE public.bookings
SET status = 'cancelled'
WHERE status = 'refunded';

-- A refunded payment was originally captured successfully. Preserve that
-- payment history without retaining a refund-specific application state.
UPDATE public.payments
SET status = 'captured'
WHERE status = 'refunded';

ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_status_check
CHECK (status IN ('confirmed', 'cancelled'));

ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
ADD CONSTRAINT payments_status_check
CHECK (status IN ('created', 'captured', 'failed'));

COMMIT;

NOTIFY pgrst, 'reload schema';
