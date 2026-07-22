-- Phase 3 movie poll functions
-- Run once after phase2_backend.sql.

BEGIN;

DROP FUNCTION IF EXISTS public.cast_poll_vote(UUID, TEXT);
DROP FUNCTION IF EXISTS public.close_due_polls();
DROP FUNCTION IF EXISTS public.override_poll_winner(UUID, UUID);
DROP FUNCTION IF EXISTS public.schedule_poll_winner(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_current_poll_payload(TEXT);

CREATE FUNCTION public.schedule_poll_winner(p_poll_id UUID, p_movie_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_week DATE;
BEGIN
    SELECT week_start INTO target_week
    FROM public.polls
    WHERE id = p_poll_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Poll not found';
    END IF;

    IF EXTRACT(ISODOW FROM target_week) <> 1 THEN
        RAISE EXCEPTION 'Poll week_start must be a Monday';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.shows
        WHERE date BETWEEN target_week AND target_week + 6
          AND movie_id <> p_movie_id
    ) THEN
        RAISE EXCEPTION 'The target week already contains a different movie';
    END IF;

    INSERT INTO public.shows (movie_id, date, time, is_enabled)
    VALUES
        (p_movie_id, target_week + 2, TIME '19:00', TRUE),
        (p_movie_id, target_week + 3, TIME '19:00', TRUE),
        (p_movie_id, target_week + 4, TIME '19:00', TRUE),
        (p_movie_id, target_week + 5, TIME '14:00', TRUE),
        (p_movie_id, target_week + 5, TIME '19:00', TRUE),
        (p_movie_id, target_week + 6, TIME '14:00', TRUE),
        (p_movie_id, target_week + 6, TIME '19:00', TRUE)
    ON CONFLICT (date, time) DO NOTHING;
END;
$$;

CREATE FUNCTION public.cast_poll_vote(p_option_id UUID, p_fingerprint_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    selected_option public.poll_options%ROWTYPE;
    active_poll public.polls%ROWTYPE;
    new_total INTEGER;
BEGIN
    SELECT * INTO selected_option
    FROM public.poll_options
    WHERE id = p_option_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Poll option not found';
    END IF;

    SELECT * INTO active_poll
    FROM public.polls
    WHERE id = selected_option.poll_id
    FOR UPDATE;

    IF active_poll.status <> 'voting'
       OR active_poll.voting_starts_at > NOW()
       OR active_poll.voting_ends_at <= NOW() THEN
        RAISE EXCEPTION 'Voting is closed for this poll';
    END IF;

    INSERT INTO public.poll_votes (
        poll_id,
        poll_option_id,
        fingerprint_hash
    )
    VALUES (
        active_poll.id,
        selected_option.id,
        p_fingerprint_hash
    );

    UPDATE public.poll_options
    SET votes_count = votes_count + 1
    WHERE id = selected_option.id
    RETURNING votes_count INTO new_total;

    RETURN JSONB_BUILD_OBJECT(
        'poll_id', active_poll.id,
        'poll_option_id', selected_option.id,
        'votes_count', new_total
    );
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'You have already voted in this poll';
END;
$$;

CREATE FUNCTION public.get_current_poll_payload(p_fingerprint_hash TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    selected_poll public.polls%ROWTYPE;
    winner JSONB;
    options JSONB;
    total_votes INTEGER := 0;
    selected_option UUID;
BEGIN
    SELECT * INTO selected_poll
    FROM public.polls
    WHERE status = 'voting'
      AND voting_starts_at <= NOW()
      AND voting_ends_at > NOW()
    ORDER BY voting_ends_at, id
    LIMIT 1;

    IF NOT FOUND THEN
        SELECT * INTO selected_poll
        FROM public.polls
        WHERE status IN ('closed', 'overridden')
        ORDER BY week_start DESC, id
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        RETURN JSONB_BUILD_OBJECT(
            'poll', NULL,
            'options', '[]'::JSONB,
            'total_votes', 0,
            'has_voted', FALSE,
            'selected_option_id', NULL,
            'is_open', FALSE
        );
    END IF;

    SELECT COALESCE(SUM(votes_count), 0)::INTEGER
    INTO total_votes
    FROM public.poll_options
    WHERE poll_id = selected_poll.id;

    SELECT COALESCE(
        JSONB_AGG(
            JSONB_BUILD_OBJECT(
                'id', option_row.id,
                'movie_id', option_row.movie_id,
                'votes_count', option_row.votes_count,
                'percentage', CASE
                    WHEN total_votes = 0 THEN 0
                    ELSE ROUND(option_row.votes_count::NUMERIC / total_votes * 100, 1)
                END,
                'movie', TO_JSONB(movie_row)
            )
            ORDER BY option_row.votes_count DESC, option_row.created_at, option_row.id
        ),
        '[]'::JSONB
    )
    INTO options
    FROM public.poll_options option_row
    JOIN public.movies movie_row ON movie_row.id = option_row.movie_id
    WHERE option_row.poll_id = selected_poll.id;

    IF selected_poll.winning_movie_id IS NOT NULL THEN
        SELECT TO_JSONB(movie_row)
        INTO winner
        FROM public.movies movie_row
        WHERE movie_row.id = selected_poll.winning_movie_id;
    END IF;

    IF p_fingerprint_hash IS NOT NULL THEN
        SELECT poll_option_id
        INTO selected_option
        FROM public.poll_votes
        WHERE poll_id = selected_poll.id
          AND fingerprint_hash = p_fingerprint_hash
        LIMIT 1;
    END IF;

    RETURN JSONB_BUILD_OBJECT(
        'poll', TO_JSONB(selected_poll) || JSONB_BUILD_OBJECT('winning_movie', winner),
        'options', options,
        'total_votes', total_votes,
        'has_voted', selected_option IS NOT NULL,
        'selected_option_id', selected_option,
        'is_open', selected_poll.status = 'voting'
            AND selected_poll.voting_starts_at <= NOW()
            AND selected_poll.voting_ends_at > NOW()
    );
END;
$$;

CREATE FUNCTION public.close_due_polls()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    due_poll RECORD;
    winner_id UUID;
    closed_count INTEGER := 0;
BEGIN
    FOR due_poll IN
        SELECT id, overridden_movie_id
        FROM public.polls
        WHERE status = 'voting'
          AND voting_ends_at <= NOW()
        ORDER BY voting_ends_at
        FOR UPDATE SKIP LOCKED
    LOOP
        winner_id := due_poll.overridden_movie_id;

        IF winner_id IS NULL THEN
            SELECT movie_id INTO winner_id
            FROM public.poll_options
            WHERE poll_id = due_poll.id
            ORDER BY votes_count DESC, created_at ASC, id ASC
            LIMIT 1;
        END IF;

        UPDATE public.polls
        SET winning_movie_id = winner_id,
            status = CASE WHEN due_poll.overridden_movie_id IS NULL THEN 'closed' ELSE 'overridden' END,
            updated_at = NOW()
        WHERE id = due_poll.id;

        IF winner_id IS NOT NULL THEN
            PERFORM public.schedule_poll_winner(due_poll.id, winner_id);
        END IF;

        closed_count := closed_count + 1;
    END LOOP;

    RETURN closed_count;
END;
$$;

CREATE FUNCTION public.override_poll_winner(p_poll_id UUID, p_movie_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    poll_state public.polls%ROWTYPE;
BEGIN
    SELECT * INTO poll_state
    FROM public.polls
    WHERE id = p_poll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Poll not found';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.movies WHERE id = p_movie_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Movie not found or inactive';
    END IF;

    IF poll_state.winning_movie_id IS NOT NULL
       AND poll_state.winning_movie_id <> p_movie_id THEN
        DELETE FROM public.shows
        WHERE date BETWEEN poll_state.week_start AND poll_state.week_start + 6
          AND movie_id = poll_state.winning_movie_id
          AND NOT EXISTS (
              SELECT 1 FROM public.bookings
              WHERE bookings.show_id = shows.id
          );
    END IF;

    UPDATE public.polls
    SET overridden_movie_id = p_movie_id,
        winning_movie_id = p_movie_id,
        status = 'overridden',
        updated_at = NOW()
    WHERE id = p_poll_id;

    PERFORM public.schedule_poll_winner(p_poll_id, p_movie_id);
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_poll_winner(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cast_poll_vote(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_due_polls() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.override_poll_winner(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_poll_payload(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.schedule_poll_winner(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cast_poll_vote(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_due_polls() TO service_role;
GRANT EXECUTE ON FUNCTION public.override_poll_winner(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_current_poll_payload(TEXT) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
