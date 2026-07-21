import React from 'react';

interface Seat {
  id: string;
  section_name: string;
  row_prefix: string;
  col_index: number;
  seat_number: string;
  category_name: 'VIP' | 'Gold' | 'Silver' | 'Bronze';
  price: string;
  status: 'active' | 'disabled' | 'reserved';
}

interface SeatMapProps {
  seats: Seat[];
  bookedSeatIds: string[];
  selectedSeatIds: string[];
  onSeatSelect: (seatId: string) => void;
  maxSelectable?: number;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  seats,
  bookedSeatIds,
  selectedSeatIds,
  onSeatSelect,
  maxSelectable = 6
}) => {
  const sections = React.useMemo(() => {
    const map: Record<string, Record<string, Seat[]>> = {};
    seats.forEach(seat => {
      if (!map[seat.section_name]) map[seat.section_name] = {};
      if (!map[seat.section_name][seat.row_prefix]) map[seat.section_name][seat.row_prefix] = [];
      map[seat.section_name][seat.row_prefix].push(seat);
    });

    Object.keys(map).forEach(secName => {
      Object.keys(map[secName]).forEach(rowPrefix => {
        map[secName][rowPrefix].sort((a, b) => a.col_index - b.col_index);
      });
    });

    return map;
  }, [seats]);

  const getSeatColor = (seat: Seat) => {
    const isSelected = selectedSeatIds.includes(seat.id);
    const isBooked = bookedSeatIds.includes(seat.id);

    if (isSelected) return 'bg-blue-600 hover:bg-blue-500 border border-blue-400';
    if (isBooked) return 'bg-red-650 cursor-not-allowed opacity-90 text-slate-400';
    if (seat.status === 'disabled') return 'bg-gray-700 cursor-not-allowed opacity-30';
    if (seat.status === 'reserved') return 'bg-yellow-600 border border-yellow-500 cursor-not-allowed';
    if (seat.category_name === 'VIP') return 'bg-purple-600 hover:bg-purple-500 border border-purple-400';
    
    return 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/20';
  };

  const handleSeatClick = (seat: Seat) => {
    if (bookedSeatIds.includes(seat.id) || seat.status !== 'active') return;
    if (!selectedSeatIds.includes(seat.id) && selectedSeatIds.length >= maxSelectable) {
      alert(`You can select a maximum of ${maxSelectable} seats.`);
      return;
    }
    onSeatSelect(seat.id);
  };

  return (
    <div className="space-y-12 select-none">
      <div className="relative w-full flex flex-col items-center">
        <div className="w-4/5 h-2 bg-gradient-to-r from-transparent via-amber-500 to-transparent rounded-full shadow-lg shadow-amber-500/10" />
        <span className="text-[10px] text-amber-500 uppercase tracking-widest font-bold mt-2">Projection Screen Direction</span>
      </div>

      <div className="overflow-x-auto seat-map-scrollbar pb-6 flex flex-col gap-10">
        {Object.entries(sections).map(([sectionName, rows]) => (
          <div key={sectionName} className="min-w-[600px] flex flex-col items-center gap-3">
            <h4 className="text-xs uppercase tracking-widest font-bold text-amber-500 border-b border-amber-500/20 pb-1 mb-2">
              {sectionName} Section
            </h4>

            {Object.entries(rows).map(([row_prefix, rowSeats]) => (
              <div key={row_prefix} className="flex items-center gap-4">
                <span className="w-6 text-sm font-bold text-slate-500">{row_prefix}</span>
                <div className="flex gap-2">
                  {rowSeats.map(seat => (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => handleSeatClick(seat)}
                      className={`w-10 h-10 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${getSeatColor(seat)}`}
                      title={`${seat.seat_number} - ${seat.category_name} (INR ${seat.price})`}
                    >
                      {seat.col_index}
                    </button>
                  ))}
                </div>
                <span className="w-6 text-sm font-bold text-slate-500">{row_prefix}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-400 pt-6 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-600 border border-emerald-500/20" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-600 border border-purple-400" />
          <span>VIP Seats</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-600 border border-blue-400" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-650" />
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-600 border border-yellow-500" />
          <span>Reserved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-700 opacity-30" />
          <span>Disabled</span>
        </div>
      </div>
    </div>
  );
};
