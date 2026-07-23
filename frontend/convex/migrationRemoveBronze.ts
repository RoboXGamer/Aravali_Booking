import { internalMutation } from "./_generated/server";

export const migrateBronzeSeatsToSilver = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [seats, bookingSeats] = await Promise.all([
      ctx.db.query("seats").collect(),
      ctx.db.query("bookingSeats").collect(),
    ]);

    let seatsUpdated = 0;
    let bookingSeatSnapshotsUpdated = 0;

    for (const seat of seats) {
      if (String(seat.categoryName) !== "Bronze") continue;
      await ctx.db.patch("seats", seat._id, {
        categoryName: "Silver",
        price: 80,
      });
      seatsUpdated += 1;
    }

    for (const bookingSeat of bookingSeats) {
      if (String(bookingSeat.categoryName) !== "Bronze") continue;
      await ctx.db.patch("bookingSeats", bookingSeat._id, {
        categoryName: "Silver",
      });
      bookingSeatSnapshotsUpdated += 1;
    }

    return {
      status: seatsUpdated || bookingSeatSnapshotsUpdated ? "migrated" : "already_clean",
      seatsUpdated,
      bookingSeatSnapshotsUpdated,
      liveSeatPrice: 80,
      historicalPricesPreserved: true,
    };
  },
});
