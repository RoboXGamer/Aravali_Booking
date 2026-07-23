import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { moviePosterUrl } from "./lib";

async function loadPoll(ctx: QueryCtx, pollId: Id<"polls">, visitorId: string | null) {
  const poll = await ctx.db.get("polls", pollId);
  if (!poll) return null;
  const options = await ctx.db
    .query("pollOptions")
    .withIndex("by_pollId", (q) => q.eq("pollId", pollId))
    .take(20);
  const optionRows = [];
  for (const option of options) {
    const movie = await ctx.db.get("movies", option.movieId);
    if (!movie) continue;
    optionRows.push({
      id: option._id,
      movie_id: option.movieId,
      votes_count: option.votesCount,
      movie: {
        id: movie._id,
        title: movie.title,
        description: movie.description,
        poster_url: await moviePosterUrl(ctx, movie),
        duration_minutes: movie.durationMinutes,
      },
    });
  }
  const totalVotes = optionRows.reduce((sum, option) => sum + option.votes_count, 0);
  const selected = visitorId
    ? await ctx.db
      .query("pollVotes")
      .withIndex("by_pollId_and_visitorHash", (q) => q.eq("pollId", pollId).eq("visitorHash", visitorId))
      .unique()
    : null;
  const winnerId = poll.overriddenMovieId ?? poll.winningMovieId;
  const winningMovie = winnerId ? await ctx.db.get("movies", winnerId) : null;
  return {
    poll: {
      id: poll._id,
      week_start: poll.weekStart,
      voting_starts_at: new Date(poll.votingStartsAt).toISOString(),
      voting_ends_at: new Date(poll.votingEndsAt).toISOString(),
      status: poll.status,
      winning_movie_id: poll.winningMovieId,
      overridden_movie_id: poll.overriddenMovieId,
      winning_movie: winningMovie ? {
        id: winningMovie._id,
        title: winningMovie.title,
        description: winningMovie.description,
        poster_url: await moviePosterUrl(ctx, winningMovie),
        duration_minutes: winningMovie.durationMinutes,
      } : null,
    },
    options: optionRows.map((option) => ({
      ...option,
      percentage: totalVotes ? Math.round(option.votes_count / totalVotes * 1000) / 10 : 0,
    })),
    total_votes: totalVotes,
    has_voted: Boolean(selected),
    selected_option_id: selected?.optionId ?? null,
    is_open: poll.status === "voting",
  };
}

export const getCurrent = query({
  args: { visitorId: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const open = await ctx.db
      .query("polls")
      .withIndex("by_status_and_votingEndsAt", (q) => q.eq("status", "voting"))
      .order("desc")
      .first();
    if (open) return await loadPoll(ctx, open._id, args.visitorId);
    const overridden = await ctx.db
      .query("polls")
      .withIndex("by_status_and_votingEndsAt", (q) => q.eq("status", "overridden"))
      .order("desc")
      .first();
    const closed = overridden ?? await ctx.db
      .query("polls")
      .withIndex("by_status_and_votingEndsAt", (q) => q.eq("status", "closed"))
      .order("desc")
      .first();
    if (!closed) return { poll: null, options: [], total_votes: 0, has_voted: false, selected_option_id: null, is_open: false };
    return await loadPoll(ctx, closed._id, args.visitorId);
  },
});

export const vote = mutation({
  args: { optionId: v.id("pollOptions"), visitorId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    if (args.visitorId.length < 16 || args.visitorId.length > 128) throw new Error("Invalid visitor identifier.");
    const option = await ctx.db.get("pollOptions", args.optionId);
    if (!option) throw new Error("Poll option not found.");
    const poll = await ctx.db.get("polls", option.pollId);
    if (!poll || poll.status !== "voting" || args.now < poll.votingStartsAt || args.now >= poll.votingEndsAt) {
      throw new Error("Voting is closed.");
    }
    const existing = await ctx.db
      .query("pollVotes")
      .withIndex("by_pollId_and_visitorHash", (q) => q.eq("pollId", poll._id).eq("visitorHash", args.visitorId))
      .unique();
    if (existing) throw new Error("You have already voted in this poll.");
    await ctx.db.insert("pollVotes", {
      pollId: poll._id,
      optionId: option._id,
      visitorHash: args.visitorId,
      createdAt: args.now,
    });
    await ctx.db.patch("pollOptions", option._id, { votesCount: option.votesCount + 1 });
    return null;
  },
});
