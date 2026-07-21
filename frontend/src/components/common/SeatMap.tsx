import { useMemo } from "react";

import type { Seat } from "../../types";

interface SeatMapProps {
  seats: Seat[];
  selectedSeatIds: string[];
  onSeatSelect: (seatId: string) => void;
  maxSelectable: number;
}

const availabilityStyles: Record<Seat["availability"], string> = {
  available: "bg-emerald-600 text-white hover:bg-emerald-500",
  booked: "cursor-not-allowed bg-rose-700/80 text-rose-100",
  held: "cursor-not-allowed bg-orange-600/80 text-orange-100",
  reserved: "cursor-not-allowed bg-yellow-500/80 text-slate-950",
  disabled: "cursor-not-allowed bg-slate-700/50 text-slate-500",
};

export function SeatMap({ seats, selectedSeatIds, onSeatSelect, maxSelectable }: SeatMapProps) {
  const sections = useMemo(() => {
    const grouped: Record<string, Record<string, Seat[]>> = {};
    for (const seat of seats) {
      grouped[seat.section_name] ??= {};
      grouped[seat.section_name][seat.row_prefix] ??= [];
      grouped[seat.section_name][seat.row_prefix].push(seat);
    }
    for (const rows of Object.values(grouped)) {
      for (const row of Object.values(rows)) row.sort((a, b) => a.col_index - b.col_index);
    }
    return grouped;
  }, [seats]);

  const selectSeat = (seat: Seat) => {
    if (seat.availability !== "available") return;
    if (!selectedSeatIds.includes(seat.id) && selectedSeatIds.length >= maxSelectable) return;
    onSeatSelect(seat.id);
  };

  return (
    <div className="select-none">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <div className="h-2 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_8px_24px_rgba(212,175,55,0.25)]" />
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.32em] text-amber-400">Screen</p>
      </div>

      <div className="seat-map-scrollbar overflow-x-auto pb-5">
        <div className="min-w-[620px] space-y-10">
          {Object.entries(sections).map(([sectionName, rows]) => (
            <section key={sectionName}>
              <h3 className="mb-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{sectionName}</h3>
              <div className="space-y-2">
                {Object.entries(rows).map(([rowPrefix, rowSeats]) => (
                  <div key={rowPrefix} className="flex items-center justify-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-slate-600">{rowPrefix}</span>
                    <div className="flex gap-2">
                      {rowSeats.map((seat) => {
                        const selected = selectedSeatIds.includes(seat.id);
                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => selectSeat(seat)}
                            disabled={seat.availability !== "available"}
                            title={`${seat.seat_number} · ${seat.category_name} · INR ${seat.price} · ${seat.availability}`}
                            className={`h-10 w-10 rounded-lg text-xs font-bold transition ${
                              selected
                                ? "scale-105 bg-blue-600 text-white ring-2 ring-blue-300"
                                : seat.category_name === "VIP" && seat.availability === "available"
                                  ? "bg-purple-600 text-white hover:bg-purple-500"
                                  : availabilityStyles[seat.availability]
                            }`}
                          >
                            {seat.col_index}
                          </button>
                        );
                      })}
                    </div>
                    <span className="w-6 text-center text-xs font-bold text-slate-600">{rowPrefix}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-3 border-t border-slate-800 pt-6 text-xs text-slate-400">
        {[
          ["bg-emerald-600", "Available"],
          ["bg-purple-600", "VIP"],
          ["bg-blue-600", "Selected"],
          ["bg-rose-700", "Booked"],
          ["bg-orange-600", "Held"],
          ["bg-yellow-500", "Reserved"],
          ["bg-slate-700", "Disabled"],
        ].map(([color, label]) => (
          <span key={label} className="flex items-center gap-2"><i className={`h-3 w-3 rounded ${color}`} />{label}</span>
        ))}
      </div>
    </div>
  );
}
