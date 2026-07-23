import { internalMutation } from "./_generated/server";
import { auditoriumLayoutSummary, auditoriumSeats } from "./seatLayout";

export const seedAuditoriumSeats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existingSeats = await ctx.db.query("seats").collect();
    const existingByKey = new Map(
      existingSeats.map((seat) => [`${seat.sectionName}:${seat.seatNumber}`, seat]),
    );
    const alreadySeeded =
      existingSeats.length === auditoriumSeats.length
      && auditoriumSeats.every((seat) => {
        const existing = existingByKey.get(`${seat.sectionName}:${seat.seatNumber}`);
        return existing
          && existing.rowIndex === seat.rowIndex
          && existing.colIndex === seat.colIndex
          && existing.categoryName === seat.categoryName
          && existing.price === seat.price;
      });

    if (alreadySeeded) {
      return {
        status: "already_seeded",
        inserted: 0,
        total: existingSeats.length,
        ...auditoriumLayoutSummary,
      };
    }

    const [bookingSeat, heldSeat, reservation] = await Promise.all([
      ctx.db.query("bookingSeats").first(),
      ctx.db.query("checkoutSessionSeats").first(),
      ctx.db.query("reservations").first(),
    ]);
    if (bookingSeat || heldSeat || reservation) {
      throw new Error(
        "Seat layout was not replaced because bookings, checkout holds, or reservations still reference existing seats.",
      );
    }

    for (const seat of existingSeats) {
      await ctx.db.delete("seats", seat._id);
    }
    for (const seat of auditoriumSeats) {
      await ctx.db.insert("seats", seat);
    }

    return {
      status: "seeded",
      inserted: auditoriumSeats.length,
      removed: existingSeats.length,
      ...auditoriumLayoutSummary,
    };
  },
});
