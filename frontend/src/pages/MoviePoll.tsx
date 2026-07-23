import { ArrowRight, CheckCircle2, Clock3, Popcorn, Trophy, WifiOff } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useLoadingTimeout } from "../hooks/useLoadingTimeout";

const VISITOR_KEY = "aravalli.poll.visitor";

function getVisitorId(): string {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  localStorage.setItem(VISITOR_KEY, generated);
  return generated;
}

function formatRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return "Closed";
  const totalMinutes = Math.floor(milliseconds / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
}

function PollHeader({ status }: { status: ReactNode }) {
  return (
    <header className="movie-poll-header">
      <div className="movie-poll-heading">
        <Popcorn className="movie-poll-icon" strokeWidth={1.8} />
        <h1>NEXT WEEK&apos;S MOVIE POLL</h1>
        <span className="movie-poll-divider" />
        <p>Vote for what we should screen next week</p>
      </div>
      <div className="movie-poll-desktop-timer"><Clock3 />{status}</div>
    </header>
  );
}

export function MoviePoll() {
  const visitorId = useMemo(getVisitorId, []);
  const data = useQuery(api.polls.getCurrent, { visitorId });
  const castVote = useMutation(api.polls.vote);
  const [votingOption, setVotingOption] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const loadingTimedOut = useLoadingTimeout(data === undefined);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const vote = async (optionId: string) => {
    setVotingOption(optionId);
    setError("");
    try {
      await castVote({ optionId: optionId as Id<"pollOptions">, visitorId, now: Date.now() });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setVotingOption(null);
    }
  };

  if (data === undefined && !loadingTimedOut) {
    return (
      <section className="movie-poll-section" aria-label="Loading movie poll">
        <div className="movie-poll-shell">
          <PollHeader status={<span>Loading poll</span>} />
          <div className="movie-poll-grid">
            {[0, 1, 2].map((item) => (
              <article key={item} className="movie-poll-option movie-poll-option-skeleton">
                <span className="poll-skeleton-line poll-skeleton-title" />
                <span className="poll-skeleton-line poll-skeleton-button" />
              </article>
            ))}
          </div>
          <footer className="movie-poll-mobile-timer"><Clock3 />Loading poll</footer>
        </div>
      </section>
    );
  }

  if (data === undefined) {
    return (
      <section className="movie-poll-section">
        <div className="movie-poll-shell">
          <PollHeader status={<strong>Unavailable</strong>} />
          <div className="movie-poll-empty">
            <span className="movie-poll-empty-icon"><WifiOff /></span>
            <h2>Unable to load the movie poll</h2>
            <p>We will reconnect automatically when the booking service is available.</p>
          </div>
          <footer className="movie-poll-mobile-timer"><Clock3 />Unavailable</footer>
        </div>
      </section>
    );
  }

  if (!data?.poll) {
    return (
      <section className="movie-poll-section">
        <div className="movie-poll-shell">
          <PollHeader status={<strong>No active poll</strong>} />
          <div className="movie-poll-empty">
            <span className="movie-poll-empty-icon"><Trophy /></span>
            <h2>No upcoming movie poll</h2>
            <p>The next audience vote will appear here when it opens.</p>
          </div>
          {error && <p className="movie-poll-error">{error}</p>}
          <footer className="movie-poll-mobile-timer"><Clock3 />No active poll</footer>
        </div>
      </section>
    );
  }

  const { poll, options, has_voted: hasVoted, selected_option_id: selectedId } = data;
  const remaining = new Date(poll.voting_ends_at).getTime() - now;
  const open = data.is_open && remaining > 0;
  const winner = poll.winning_movie || options.find((option) => option.movie_id === poll.winning_movie_id)?.movie;

  const timer = open ? <span>Poll ends in <strong>{formatRemaining(remaining)}</strong></span> : <strong>Poll closed</strong>;

  return (
    <section className="movie-poll-section">
      <div className="movie-poll-shell">
        <PollHeader status={timer} />

        {!open && winner && (
          <div className="movie-poll-message"><Trophy /><span>Winner: <strong>{winner.title}</strong></span></div>
        )}
        {error && <p className="movie-poll-error">{error}</p>}

        <div className="movie-poll-grid">
          {options.map((option, index) => {
            const selected = selectedId === option.id;
            const letter = String.fromCharCode(65 + index);
            const posterUrl = option.movie.poster_url || "https://placehold.co/600x900/16191D/FFFFFF?text=Movie";
            return (
              <article key={option.id} className={`movie-poll-option ${selected ? "is-selected" : ""}`}>
                <div className="movie-poll-media">
                  <img
                    src={posterUrl}
                    alt=""
                    aria-hidden="true"
                    className="movie-poll-poster-backdrop"
                  />
                  <img
                    src={posterUrl}
                    alt={option.movie.title}
                    className="movie-poll-poster"
                  />
                  <div className="movie-poll-shade" />
                  <div className="movie-poll-letter">{letter}</div>
                </div>

                <div className="movie-poll-action-wrap">
                  <p className="movie-poll-title">{option.movie.title}</p>
                  <button
                    className={`movie-poll-vote ${selected ? "is-selected" : ""} ${!selected && hasVoted ? "is-dimmed" : ""}`}
                    disabled={!open || hasVoted || votingOption !== null}
                    onClick={() => void vote(option.id)}
                    aria-label={`Vote for ${option.movie.title}`}
                  >
                    <span>{selected ? `VOTED ${letter}` : votingOption === option.id ? "RECORDING..." : open ? `VOTE ${letter}` : "CLOSED"}</span>
                    <span className="movie-poll-arrow">{selected ? <CheckCircle2 /> : <ArrowRight />}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <footer className="movie-poll-mobile-timer"><Clock3 />{timer}</footer>
      </div>
    </section>
  );
}
