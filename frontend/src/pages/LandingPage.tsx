import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "../services/api";
import type { Show } from "../types";
import { MoviePoll } from "./MoviePoll";

export function LandingPage() {
  const [upcomingShow, setUpcomingShow] = useState<Show | null>(null);

  useEffect(() => {
    let active = true;

    api.get<Show[]>("/api/events")
      .then((shows) => {
        if (active) setUpcomingShow(shows[0] || null);
      })
      .catch(() => {
        if (active) setUpcomingShow(null);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      {upcomingShow?.poster_url && (
        <section className="featured-movie">
          <img
            src={upcomingShow.poster_url}
            alt={`${upcomingShow.title} poster`}
            className="featured-movie-art"
          />
          <div className="featured-movie-shade" />
          <div className="featured-movie-content">
            <h1>{upcomingShow.title}</h1>
            {upcomingShow.description && <p>{upcomingShow.description}</p>}
            <div className="featured-movie-actions">
              <Link
                to={`/book/${upcomingShow.id}`}
                className="featured-movie-play"
              >
                <Ticket /> Book Ticket
              </Link>
            </div>
          </div>
        </section>
      )}
      <MoviePoll />
    </div>
  );
}
