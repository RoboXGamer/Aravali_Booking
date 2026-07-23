import { internalMutation } from "./_generated/server";

const MAIN_FLOOR_ROWS = 15;
const BALCONY_ROWS = 5;
const SEATS_PER_ROW = 40;
function alphabeticRow(index: number): string {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

function physicalColumn(seatNumber: number): number {
  if (seatNumber <= 10) return seatNumber;
  if (seatNumber <= 30) return seatNumber + 2;
  return seatNumber + 4;
}

export const seedAuditoriumSeats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existingSeats = await ctx.db
      .query("seats")
      .withIndex("by_rowIndex_and_colIndex")
      .collect();

    const alreadySeeded =
      existingSeats.length === (MAIN_FLOOR_ROWS + BALCONY_ROWS) * SEATS_PER_ROW
      && existingSeats.some((seat) => seat.sectionName === "Main Floor" && seat.seatNumber === "A1")
      && existingSeats.some((seat) => seat.sectionName === "Main Floor" && seat.seatNumber === "A11" && seat.colIndex === 13)
      && existingSeats.some((seat) => seat.sectionName === "Balcony" && seat.seatNumber === "BA31" && seat.colIndex === 35);

    if (alreadySeeded) {
      return {
        status: "already_seeded",
        inserted: 0,
        total: existingSeats.length,
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

    let inserted = 0;

    for (let rowIndex = 0; rowIndex < MAIN_FLOOR_ROWS; rowIndex += 1) {
      const rowPrefix = alphabeticRow(rowIndex);
      const categoryName = "Silver";
      const price = 80;

      for (let colIndex = 1; colIndex <= SEATS_PER_ROW; colIndex += 1) {
        await ctx.db.insert("seats", {
          sectionName: "Main Floor",
          rowPrefix,
          rowIndex,
          colIndex: physicalColumn(colIndex),
          seatNumber: `${rowPrefix}${colIndex}`,
          categoryName,
          price,
          status: "active",
          isVisible: true,
        });
        inserted += 1;
      }
    }

    for (let balconyRow = 0; balconyRow < BALCONY_ROWS; balconyRow += 1) {
      const rowPrefix = `B${alphabeticRow(balconyRow)}`;
      const rowIndex = MAIN_FLOOR_ROWS + balconyRow;

      for (let colIndex = 1; colIndex <= SEATS_PER_ROW; colIndex += 1) {
        await ctx.db.insert("seats", {
          sectionName: "Balcony",
          rowPrefix,
          rowIndex,
          colIndex: physicalColumn(colIndex),
          seatNumber: `${rowPrefix}${colIndex}`,
          categoryName: "Gold",
          price: 120,
          status: "active",
          isVisible: true,
        });
        inserted += 1;
      }
    }

    return {
      status: "seeded",
      inserted,
      removed: existingSeats.length,
      mainFloorSeats: MAIN_FLOOR_ROWS * SEATS_PER_ROW,
      balconySeats: BALCONY_ROWS * SEATS_PER_ROW,
      total: inserted,
    };
  },
});

export const applyAuditoriumAisles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_rowIndex_and_colIndex")
      .collect();

    let updated = 0;
    let unchanged = 0;

    for (const seat of seats) {
      if (seat.sectionName !== "Main Floor" && seat.sectionName !== "Balcony") continue;

      const displayNumber = Number(seat.seatNumber.slice(seat.rowPrefix.length));
      if (!Number.isInteger(displayNumber) || displayNumber < 1 || displayNumber > SEATS_PER_ROW) {
        throw new Error(`Cannot derive the display number for seat ${seat.seatNumber}.`);
      }

      const nextColumn = physicalColumn(displayNumber);
      if (seat.colIndex === nextColumn) {
        unchanged += 1;
        continue;
      }

      await ctx.db.patch("seats", seat._id, { colIndex: nextColumn });
      updated += 1;
    }

    return {
      status: updated ? "updated" : "already_applied",
      updated,
      unchanged,
      total: updated + unchanged,
      aisleSlots: [11, 12, 33, 34],
    };
  },
});
