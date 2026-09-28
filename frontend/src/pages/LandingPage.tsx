import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { CalendarX2, Ticket, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "../../convex/_generated/api";
import { useLoadingTimeout } from "../hooks/useLoadingTimeout";
import { auditoriumToday } from "../lib/auditoriumDate";
import { MoviePoll } from "./MoviePoll";

export function LandingPage() {
  const today = auditoriumToday();
  const shows = useQuery(api.events.listUpcoming, { today });
  const [activeShowIndex, setActiveShowIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const upcomingShows = shows ?? [];
  const upcomingShow = upcomingShows[activeShowIndex] ?? upcomingShows[0] ?? null;
  const loadingTimedOut = useLoadingTimeout(shows === undefined);
  const isLoading = shows === undefined && !loadingTimedOut;

  useEffect(() => {
    setActiveShowIndex((index) => Math.min(index, Math.max(upcomingShows.length - 1, 0)));
  }, [upcomingShows.length]);

  useEffect(() => {
    if (upcomingShows.length < 2 || carouselPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setActiveShowIndex((index) => (index + 1) % upcomingShows.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [carouselPaused, upcomingShows.length]);

  return (
    <div>
      <header className="featured-section-heading">
        <h1>Upcoming Show</h1>
        <p>Book your seats for the next screening</p>
      </header>
      {isLoading ? (
        <section
          className="featured-movie featured-movie-skeleton"
          aria-label="Loading upcoming show"
        >
          <div className="featured-movie-content">
            <span className="featured-skeleton-line featured-skeleton-title" />
            <span className="featured-skeleton-line featured-skeleton-copy" />
            <span className="featured-skeleton-line featured-skeleton-button" />
          </div>
        </section>
      ) : upcomingShow ? (
        <section
          className="featured-movie"
          aria-roledescription={upcomingShows.length > 1 ? "carousel" : undefined}
          aria-label={upcomingShows.length > 1 ? "Upcoming shows" : undefined}
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
          onFocusCapture={() => setCarouselPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCarouselPaused(false);
          }}
        >
          {upcomingShow.poster_url && (
            <img
              src={upcomingShow.poster_url}
              alt={`${upcomingShow.title} poster`}
              className="featured-movie-art"
            />
          )}
          <div className="featured-movie-shade" />
          <div className="featured-movie-content">
            <h1>{upcomingShow.title}</h1>
            {upcomingShow.description && <p>{upcomingShow.description}</p>}
            <div className="featured-movie-actions">
              <Link
                to={`/showtimes/${upcomingShow.movie_id}`}
                className="featured-movie-play"
              >
                <Ticket /> Book Ticket
              </Link>
            </div>
          </div>
          {upcomingShows.length > 1 && (
            <div className="featured-carousel-dots" role="group" aria-label="Choose an upcoming show">
              {upcomingShows.map((show, index) => (
                <button
                  key={show.id}
                  type="button"
                  className={`featured-carousel-dot${index === activeShowIndex ? " is-active" : ""}`}
                  aria-label={`Show ${index + 1} of ${upcomingShows.length}: ${show.title}`}
                  aria-current={index === activeShowIndex ? "true" : undefined}
                  aria-valuetext={index === activeShowIndex ? "Next show in 5 seconds" : undefined}
                  onClick={() => setActiveShowIndex(index)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="featured-movie featured-movie-empty">
          <div className="featured-empty-content">
            <span className="featured-empty-icon">
              {loadingTimedOut ? <WifiOff /> : <CalendarX2 />}
            </span>
            <p className="featured-empty-label">
              {loadingTimedOut ? "Connection issue" : "Now showing"}
            </p>
            <h1>{loadingTimedOut ? "Unable to load shows" : "No upcoming shows"}</h1>
            <p>
              {loadingTimedOut
                ? "We could not reach the booking service. The page will update automatically when the connection returns."
                : "New screenings will appear here as soon as they are scheduled."}
            </p>
          </div>
        </section>
      )}
      <MoviePoll />
    </div>
  );
}
