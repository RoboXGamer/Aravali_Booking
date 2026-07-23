import { internalMutation } from "./_generated/server";
import { auditoriumLayoutSummary, auditoriumSeats } from "./seatLayout";

export const applyAuditoriumLayout = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [existingSeats, bookingSeats, heldSeats, reservations] = await Promise.all([
      ctx.db.query("seats").collect(),
      ctx.db.query("bookingSeats").collect(),
      ctx.db.query("checkoutSessionSeats").collect(),
      ctx.db.query("reservations").collect(),
    ]);
    const targetByKey = new Map(
      auditoriumSeats.map((seat) => [`${seat.sectionName}:${seat.seatNumber}`, seat]),
    );
    const existingByKey = new Map<string, (typeof existingSeats)[number]>();

    for (const seat of existingSeats) {
      const key = `${seat.sectionName}:${seat.seatNumber}`;
      if (existingByKey.has(key)) throw new Error(`Duplicate seat found: ${key}.`);
      existingByKey.set(key, seat);
    }

    const referencedSeatIds = new Set([
      ...bookingSeats.map((seat) => seat.seatId),
      ...heldSeats.map((seat) => seat.seatId),
      ...reservations.map((seat) => seat.seatId),
    ]);
    const obsoleteSeats = existingSeats.filter(
      (seat) => !targetByKey.has(`${seat.sectionName}:${seat.seatNumber}`),
    );
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let archived = 0;
    let deleted = 0;

    for (const target of auditoriumSeats) {
      const existing = existingByKey.get(`${target.sectionName}:${target.seatNumber}`);
      if (!existing) {
        await ctx.db.insert("seats", target);
        inserted += 1;
        continue;
      }

      const matches =
        existing.rowPrefix === target.rowPrefix
        && existing.rowIndex === target.rowIndex
        && existing.colIndex === target.colIndex
        && existing.categoryName === target.categoryName
        && existing.price === target.price
        && existing.status === target.status
        && existing.isVisible === target.isVisible;
      if (matches) {
        unchanged += 1;
        continue;
      }

      await ctx.db.patch("seats", existing._id, target);
      updated += 1;
    }

    for (const obsolete of obsoleteSeats) {
      if (referencedSeatIds.has(obsolete._id)) {
        if (obsolete.status !== "disabled" || obsolete.isVisible) {
          await ctx.db.patch("seats", obsolete._id, {
            status: "disabled",
            isVisible: false,
          });
          archived += 1;
        } else {
          unchanged += 1;
        }
        continue;
      }

      await ctx.db.delete("seats", obsolete._id);
      deleted += 1;
    }

    return {
      status: inserted || updated || archived || deleted ? "migrated" : "already_aligned",
      inserted,
      updated,
      unchanged,
      archived,
      deleted,
      ...auditoriumLayoutSummary,
    };
  },
});
