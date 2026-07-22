-- Consolidate public poll reads into one database round trip.
-- Run once in the Supabase SQL editor after phase3_poll.sql.

BEGIN;

DROP FUNCTION IF EXISTS public.get_current_poll_payload(TEXT);

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

REVOKE ALL ON FUNCTION public.get_current_poll_payload(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_poll_payload(TEXT) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
