import { internalMutation } from "./_generated/server";
import { preserveCheckoutItems } from "./paymentState";
import { releaseSeatHolds } from "./seatAvailability";

export const runMinuteTasks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("checkoutSessions")
      .withIndex("by_status_and_expiresAt", (q) => q.eq("status", "pending").lte("expiresAt", now))
      .take(100);
    for (const session of expired) {
      await preserveCheckoutItems(ctx, session);
      await ctx.db.patch("checkoutSessions", session._id, { status: "expired" });
      await releaseSeatHolds(ctx, session._id);
    }

    const duePolls = await ctx.db
      .query("polls")
      .withIndex("by_status_and_votingEndsAt", (q) => q.eq("status", "voting").lte("votingEndsAt", now))
      .take(20);
    for (const poll of duePolls) {
      const options = await ctx.db
        .query("pollOptions")
        .withIndex("by_pollId", (q) => q.eq("pollId", poll._id))
        .take(20);
      options.sort((a, b) => b.votesCount - a.votesCount || a._creationTime - b._creationTime);
      await ctx.db.patch("polls", poll._id, {
        status: "closed",
        winningMovieId: options[0]?.movieId ?? null,
      });
    }
    return { expiredCheckouts: expired.length, closedPolls: duePolls.length };
  },
});
