type SeatCategory = "Gold" | "Silver";
type RowDefinition = {
  row: string;
  blocks: readonly [number, number, number];
};

export interface AuditoriumSeat {
  sectionName: "Main Floor" | "Balcony";
  rowPrefix: string;
  rowIndex: number;
  colIndex: number;
  seatNumber: string;
  categoryName: SeatCategory;
  price: number;
  status: "active";
  isVisible: true;
}

const mainFloorRows: readonly RowDefinition[] = [
  { row: "T", blocks: [7, 14, 7] },
  { row: "S", blocks: [7, 14, 7] },
  { row: "R", blocks: [7, 14, 7] },
  { row: "Q", blocks: [8, 14, 8] },
  { row: "P", blocks: [8, 14, 8] },
  { row: "O", blocks: [8, 14, 8] },
  { row: "N", blocks: [8, 14, 8] },
  { row: "M", blocks: [9, 14, 9] },
  { row: "L", blocks: [9, 14, 9] },
  { row: "K", blocks: [9, 14, 9] },
  { row: "J", blocks: [9, 14, 9] },
  { row: "H", blocks: [9, 14, 9] },
  { row: "G", blocks: [10, 14, 10] },
  { row: "F", blocks: [10, 14, 10] },
  { row: "E", blocks: [10, 14, 10] },
  { row: "D", blocks: [11, 14, 11] },
  { row: "C", blocks: [11, 14, 11] },
  { row: "B", blocks: [11, 14, 11] },
  { row: "A", blocks: [10, 9, 10] },
];

const balconyRows: readonly RowDefinition[] = [
  { row: "A", blocks: [9, 10, 8] },
  { row: "B", blocks: [12, 13, 12] },
  { row: "C", blocks: [12, 12, 11] },
  { row: "D", blocks: [11, 13, 11] },
  { row: "E", blocks: [11, 12, 12] },
  { row: "F", blocks: [11, 13, 11] },
  { row: "G", blocks: [11, 12, 11] },
  { row: "H", blocks: [10, 10, 10] },
];

function createSectionSeats(
  sectionName: AuditoriumSeat["sectionName"],
  rows: readonly RowDefinition[],
  rowIndexOffset: number,
  categoryName: SeatCategory,
  price: number,
): AuditoriumSeat[] {
  const maximumLeft = Math.max(...rows.map((row) => row.blocks[0]));
  const maximumMiddle = Math.max(...rows.map((row) => row.blocks[1]));
  const seats: AuditoriumSeat[] = [];

  rows.forEach(({ row, blocks }, rowOffset) => {
    const [leftCount, middleCount, rightCount] = blocks;
    const leftStart = maximumLeft - leftCount + 1;
    const middleAreaStart = maximumLeft + 3;
    const middleStart = middleAreaStart + Math.floor((maximumMiddle - middleCount) / 2);
    const rightStart = maximumLeft + maximumMiddle + 5;
    const columns = [
      ...Array.from({ length: leftCount }, (_, index) => leftStart + index),
      ...Array.from({ length: middleCount }, (_, index) => middleStart + index),
      ...Array.from({ length: rightCount }, (_, index) => rightStart + index),
    ];
    const rowPrefix = sectionName === "Balcony" ? `B${row}` : row;

    columns.forEach((colIndex, seatOffset) => {
      const displayNumber = seatOffset + 1;
      seats.push({
        sectionName,
        rowPrefix,
        rowIndex: rowIndexOffset + rowOffset,
        colIndex,
        seatNumber: `${rowPrefix}${displayNumber}`,
        categoryName,
        price,
        status: "active",
        isVisible: true,
      });
    });
  });

  return seats;
}

export const auditoriumSeats: readonly AuditoriumSeat[] = [
  ...createSectionSeats("Main Floor", mainFloorRows, 0, "Silver", 80),
  ...createSectionSeats("Balcony", balconyRows, mainFloorRows.length, "Gold", 120),
];

export const auditoriumLayoutSummary = {
  mainFloorRows: mainFloorRows.length,
  mainFloorSeats: mainFloorRows.reduce((total, row) => total + row.blocks.reduce((sum, block) => sum + block, 0), 0),
  balconyRows: balconyRows.length,
  balconySeats: balconyRows.reduce((total, row) => total + row.blocks.reduce((sum, block) => sum + block, 0), 0),
  totalSeats: auditoriumSeats.length,
} as const;
