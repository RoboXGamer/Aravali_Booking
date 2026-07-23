import { internalMutation } from "./_generated/server";

export const alignSeatSectionsAndPrices = internalMutation({
  args: {},
  handler: async (ctx) => {
    const seats = await ctx.db.query("seats").collect();
    let groundFloorUpdated = 0;
    let balconyUpdated = 0;

    for (const seat of seats) {
      if (seat.sectionName === "Main Floor") {
        if (seat.categoryName === "Silver" && seat.price === 80) continue;
        await ctx.db.patch("seats", seat._id, {
          categoryName: "Silver",
          price: 80,
        });
        groundFloorUpdated += 1;
      } else if (seat.sectionName === "Balcony") {
        if (seat.categoryName === "Gold" && seat.price === 120) continue;
        await ctx.db.patch("seats", seat._id, {
          categoryName: "Gold",
          price: 120,
        });
        balconyUpdated += 1;
      }
    }

    return {
      status: groundFloorUpdated || balconyUpdated ? "migrated" : "already_aligned",
      groundFloorUpdated,
      balconyUpdated,
      silverOrPrice: 80,
      silverJcoPrice: 100,
      goldPrice: 120,
    };
  },
});
