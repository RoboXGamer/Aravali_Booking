import { v } from "convex/values";

import { query } from "./_generated/server";
import { moviePosterUrl } from "./lib";

function serializeShow(show: {
  _id: string;
  movieId: string;
  date: string;
  time: string;
  isEnabled: boolean;
}, movie: {
  title: string;
  description: string;
  posterUrl: string | null;
  durationMinutes: number;
}) {
  return {
    id: show._id,
    movie_id: show.movieId,
    title: movie.title,
    description: movie.description,
    date: show.date,
    time: show.time,
    venue: "Aravalli Auditorium Main Hall",
    poster_url: movie.posterUrl,
    duration_minutes: movie.durationMinutes,
    status: show.isEnabled ? "active" as const : "disabled" as const,
  };
}

export const listUpcoming = query({
  args: { today: v.string(), currentTime: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_date_and_time", (q) => q.gte("date", args.today))
      .take(100);
    const result = [];
    for (const show of shows) {
      if (!show.isEnabled) continue;
      const movie = await ctx.db.get("movies", show.movieId);
      if (movie) {
        result.push(serializeShow(show, {
          ...movie,
          posterUrl: await moviePosterUrl(ctx, movie),
        }));
      }
    }
    return result;
  },
});

export const listUpcomingByMovie = query({
  args: {
    movieId: v.id("movies"),
    today: v.string(),
    currentTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const movie = await ctx.db.get("movies", args.movieId);
    if (!movie) return null;

    const shows = await ctx.db
      .query("shows")
      .withIndex("by_movieId", (q) => q.eq("movieId", args.movieId))
      .collect();
    const upcomingShows = shows
      .filter((show) =>
        show.isEnabled
        && show.date >= args.today,
      )
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    const posterUrl = await moviePosterUrl(ctx, movie);

    return {
      movie: {
        id: movie._id,
        title: movie.title,
        description: movie.description,
        poster_url: posterUrl,
        duration_minutes: movie.durationMinutes,
      },
      shows: upcomingShows.map((show) => serializeShow(show, {
        ...movie,
        posterUrl,
      })),
    };
  },
});

export const getById = query({
  args: { showId: v.id("shows"), today: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show?.isEnabled || (args.today && show.date < args.today)) return null;
    const movie = await ctx.db.get("movies", show.movieId);
    if (!movie) return null;
    return serializeShow(show, {
      ...movie,
      posterUrl: await moviePosterUrl(ctx, movie),
    });
  },
});
