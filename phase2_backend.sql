-- Phase 2 backend database functions
-- Run once after database.sql and seed.sql.

BEGIN;

DROP FUNCTION IF EXISTS public.finalize_paid_booking(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_checkout_session(UUID, TEXT, TEXT, TEXT, UUID[]);
DROP FUNCTION IF EXISTS public.release_checkout_session(UUID);
DROP FUNCTION IF EXISTS public.cleanup_expired_checkout_sessions();
DROP FUNCTION IF EXISTS public.booking_payload(UUID);

CREATE FUNCTION public.cleanup_expired_checkout_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    released_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE public.checkout_sessions
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'pending'
          AND expires_at <= NOW()
        RETURNING id
    ),
    released AS (
        DELETE FROM public.checkout_session_seats held_seat
        USING expired
        WHERE held_seat.checkout_session_id = expired.id
        RETURNING held_seat.id
    )
    SELECT COUNT(*) INTO released_count FROM released;

    RETURN released_count;
END;
$$;

CREATE FUNCTION public.release_checkout_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.checkout_sessions
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_session_id
      AND status = 'pending';

    DELETE FROM public.checkout_session_seats
    WHERE checkout_session_id = p_session_id;

    UPDATE public.payments
    SET status = 'failed', updated_at = NOW()
    WHERE checkout_session_id = p_session_id
      AND status = 'created';
END;
$$;

CREATE FUNCTION public.create_checkout_session(
    p_show_id UUID,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_email TEXT,
    p_seat_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    config public.app_settings%ROWTYPE;
    new_session public.checkout_sessions%ROWTYPE;
    selected_count INTEGER;
    distinct_count INTEGER;
    selected_subtotal NUMERIC(10, 2);
    calculated_fee NUMERIC(10, 2);
    calculated_gst NUMERIC(10, 2);
    calculated_total NUMERIC(10, 2);
    selected_seats JSONB;
BEGIN
    PERFORM public.cleanup_expired_checkout_sessions();

    SELECT * INTO config
    FROM public.app_settings
    WHERE id = 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking settings are missing';
    END IF;

    IF p_customer_name IS NULL OR BTRIM(p_customer_name) = '' THEN
        RAISE EXCEPTION 'Customer name is required';
    END IF;

    IF p_customer_email IS NULL OR BTRIM(p_customer_email) = '' THEN
        RAISE EXCEPTION 'Customer email is required';
    END IF;

    IF p_seat_ids IS NULL OR CARDINALITY(p_seat_ids) = 0 THEN
        RAISE EXCEPTION 'At least one seat is required';
    END IF;

    IF CARDINALITY(p_seat_ids) > config.max_seats_per_booking THEN
        RAISE EXCEPTION 'Maximum % seats can be selected', config.max_seats_per_booking;
    END IF;

    SELECT COUNT(DISTINCT seat_id)
    INTO distinct_count
    FROM UNNEST(p_seat_ids) AS selected(seat_id);

    IF distinct_count <> CARDINALITY(p_seat_ids) THEN
        RAISE EXCEPTION 'The same seat cannot be selected more than once';
    END IF;

    PERFORM 1
    FROM public.shows
    WHERE id = p_show_id
      AND is_enabled = TRUE
      AND date >= CURRENT_DATE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Show not found or no longer available';
    END IF;

    -- Lock physical seat rows in a stable order to serialize competing holds.
    PERFORM 1
    FROM public.seat_layouts
    WHERE id = ANY(p_seat_ids)
    ORDER BY id
    FOR UPDATE;

    SELECT COUNT(*), COALESCE(SUM(price), 0)
    INTO selected_count, selected_subtotal
    FROM public.seat_layouts
    WHERE id = ANY(p_seat_ids)
      AND status = 'active'
      AND is_visible = TRUE;

    IF selected_count <> CARDINALITY(p_seat_ids) THEN
        RAISE EXCEPTION 'One or more selected seats are invalid or disabled';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.booking_seats
        WHERE show_id = p_show_id
          AND seat_layout_id = ANY(p_seat_ids)
    ) THEN
        RAISE EXCEPTION 'One or more selected seats are already booked';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.show_seat_reservations
        WHERE show_id = p_show_id
          AND seat_layout_id = ANY(p_seat_ids)
    ) THEN
        RAISE EXCEPTION 'One or more selected seats are reserved';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.checkout_session_seats held_seat
        JOIN public.checkout_sessions held_session
          ON held_session.id = held_seat.checkout_session_id
        WHERE held_seat.show_id = p_show_id
          AND held_seat.seat_layout_id = ANY(p_seat_ids)
          AND held_session.status = 'pending'
          AND held_session.expires_at > NOW()
    ) THEN
        RAISE EXCEPTION 'One or more selected seats are currently held by another customer';
    END IF;

    calculated_fee := selected_count * config.convenience_fee_per_seat;
    calculated_gst := ROUND(
        (selected_subtotal + calculated_fee) * config.gst_percentage / 100,
        2
    );
    calculated_total := selected_subtotal + calculated_fee + calculated_gst;

    INSERT INTO public.checkout_sessions (
        show_id,
        customer_name,
        customer_phone,
        customer_email,
        subtotal,
        convenience_fee,
        gst_amount,
        total_amount,
        expires_at
    )
    VALUES (
        p_show_id,
        BTRIM(p_customer_name),
        NULLIF(BTRIM(p_customer_phone), ''),
        LOWER(BTRIM(p_customer_email)),
        selected_subtotal,
        calculated_fee,
        calculated_gst,
        calculated_total,
        NOW() + MAKE_INTERVAL(mins => config.seat_hold_minutes)
    )
    RETURNING * INTO new_session;

    INSERT INTO public.checkout_session_seats (
        checkout_session_id,
        show_id,
        seat_layout_id,
        price
    )
    SELECT new_session.id, p_show_id, seat.id, seat.price
    FROM public.seat_layouts seat
    WHERE seat.id = ANY(p_seat_ids);

    SELECT COALESCE(JSONB_AGG(TO_JSONB(seat) ORDER BY seat.row_index, seat.col_index), '[]'::JSONB)
    INTO selected_seats
    FROM public.seat_layouts seat
    WHERE seat.id = ANY(p_seat_ids);

    RETURN JSONB_BUILD_OBJECT(
        'checkout_session', TO_JSONB(new_session),
        'selected_seats', selected_seats
    );
END;
$$;

CREATE FUNCTION public.booking_payload(p_booking_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        TO_JSONB(booking)
        || JSONB_BUILD_OBJECT(
            'shows',
            TO_JSONB(show_row)
            || JSONB_BUILD_OBJECT('movies', TO_JSONB(movie)),
            'booking_seats',
            COALESCE(
                (
                    SELECT JSONB_AGG(TO_JSONB(booked_seat) ORDER BY booked_seat.seat_number)
                    FROM public.booking_seats booked_seat
                    WHERE booked_seat.booking_id = booking.id
                ),
                '[]'::JSONB
            )
        )
    FROM public.bookings booking
    JOIN public.shows show_row ON show_row.id = booking.show_id
    JOIN public.movies movie ON movie.id = show_row.movie_id
    WHERE booking.id = p_booking_id;
$$;

CREATE FUNCTION public.finalize_paid_booking(
    p_session_id UUID,
    p_provider_payment_id TEXT,
    p_provider_signature TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    checkout public.checkout_sessions%ROWTYPE;
    payment public.payments%ROWTYPE;
    final_booking public.bookings%ROWTYPE;
    held_count INTEGER;
    payload JSONB;
BEGIN
    SELECT * INTO checkout
    FROM public.checkout_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Checkout session not found';
    END IF;

    IF checkout.status = 'paid' THEN
        SELECT * INTO final_booking
        FROM public.bookings
        WHERE checkout_session_id = p_session_id;

        RETURN JSONB_BUILD_OBJECT(
            'booking', public.booking_payload(final_booking.id),
            'already_finalized', TRUE
        );
    END IF;

    IF checkout.status <> 'pending' THEN
        RAISE EXCEPTION 'Checkout session is % and cannot be finalized', checkout.status;
    END IF;

    SELECT * INTO payment
    FROM public.payments
    WHERE checkout_session_id = p_session_id
    FOR UPDATE;

    IF NOT FOUND OR payment.status <> 'created' THEN
        RAISE EXCEPTION 'Payment attempt not found or already processed';
    END IF;

    SELECT COUNT(*) INTO held_count
    FROM public.checkout_session_seats
    WHERE checkout_session_id = p_session_id;

    IF held_count = 0 THEN
        RAISE EXCEPTION 'Seat hold expired before payment confirmation';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.checkout_session_seats held_seat
        JOIN public.booking_seats booked_seat
          ON booked_seat.show_id = held_seat.show_id
         AND booked_seat.seat_layout_id = held_seat.seat_layout_id
        WHERE held_seat.checkout_session_id = p_session_id
    ) THEN
        RAISE EXCEPTION 'A selected seat is already booked';
    END IF;

    INSERT INTO public.bookings (
        checkout_session_id,
        show_id,
        customer_name,
        customer_phone,
        customer_email,
        subtotal,
        convenience_fee,
        gst_amount,
        total_amount,
        status
    )
    VALUES (
        checkout.id,
        checkout.show_id,
        checkout.customer_name,
        checkout.customer_phone,
        checkout.customer_email,
        checkout.subtotal,
        checkout.convenience_fee,
        checkout.gst_amount,
        checkout.total_amount,
        'confirmed'
    )
    RETURNING * INTO final_booking;

    INSERT INTO public.booking_seats (
        booking_id,
        show_id,
        seat_layout_id,
        seat_number,
        category_name,
        price
    )
    SELECT
        final_booking.id,
        held_seat.show_id,
        held_seat.seat_layout_id,
        seat.seat_number,
        seat.category_name,
        held_seat.price
    FROM public.checkout_session_seats held_seat
    JOIN public.seat_layouts seat ON seat.id = held_seat.seat_layout_id
    WHERE held_seat.checkout_session_id = p_session_id;

    UPDATE public.payments
    SET booking_id = final_booking.id,
        provider_payment_id = p_provider_payment_id,
        provider_signature = p_provider_signature,
        status = 'captured',
        updated_at = NOW()
    WHERE id = payment.id;

    UPDATE public.checkout_sessions
    SET status = 'paid', updated_at = NOW()
    WHERE id = p_session_id;

    DELETE FROM public.checkout_session_seats
    WHERE checkout_session_id = p_session_id;

    payload := public.booking_payload(final_booking.id);

    RETURN JSONB_BUILD_OBJECT(
        'booking', payload,
        'already_finalized', FALSE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_checkout_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_checkout_session(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_checkout_session(UUID, TEXT, TEXT, TEXT, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_payload(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_paid_booking(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_checkout_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_checkout_session(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_checkout_session(UUID, TEXT, TEXT, TEXT, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.booking_payload(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_paid_booking(UUID, TEXT, TEXT) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
