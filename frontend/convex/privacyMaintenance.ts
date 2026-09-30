import { internalMutation } from "./_generated/server";

// Run only after clearing the authorized test booking and payment tables.
export const resetTestSoldSeats = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query("bookings").first()) throw new Error("Clear test bookings first.");
    const shows = await ctx.db.query("shows").take(1000);
    for (const show of shows) await ctx.db.patch("shows", show._id, { soldSeats: 0 });
    return { showsReset: shows.length };
  },
});
