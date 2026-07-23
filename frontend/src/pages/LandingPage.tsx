import { useQuery } from "convex/react";
import { Ticket } from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "../../convex/_generated/api";
import { MoviePoll } from "./MoviePoll";

export function LandingPage() {
  const today = new Date().toISOString().slice(0, 10);
  const shows = useQuery(api.events.listUpcoming, { today });
  const upcomingShow = shows?.[0] ?? null;

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
