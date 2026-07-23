import { v } from "convex/values";

import { query } from "./_generated/server";

function serializeShow(show: {
  _id: string;
  movieId: string;
  date: string;
  time: string;
  isEnabled: boolean;
}, movie: {
  title: string;
  description: string;
  posterUrl: string;
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
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_date_and_time", (q) => q.gte("date", args.today))
      .take(100);
    const result = [];
    for (const show of shows) {
      if (!show.isEnabled) continue;
      const movie = await ctx.db.get("movies", show.movieId);
      if (movie) result.push(serializeShow(show, movie));
    }
    return result;
  },
});

export const getById = query({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show?.isEnabled) return null;
    const movie = await ctx.db.get("movies", show.movieId);
    if (!movie) return null;
    return serializeShow(show, movie);
  },
});
