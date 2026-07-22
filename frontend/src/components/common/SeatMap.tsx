import { Hand, Info } from "lucide-react";
import { useMemo } from "react";

import type { Seat } from "../../types";

interface SeatMapProps {
  seats: Seat[];
  selectedSeatIds: string[];
  selectedCategory: Seat["category_name"] | null;
  onCategorySelect: (category: Seat["category_name"] | null) => void;
  onSeatSelect: (seatId: string) => void;
  maxSelectable: number;
}

export function SeatMap({ seats, selectedSeatIds, selectedCategory, onCategorySelect, onSeatSelect, maxSelectable }: SeatMapProps) {
  const supportedCategories: Seat["category_name"][] = ["Gold", "Silver", "Bronze"];
  const categories = supportedCategories;
  const rows = useMemo(() => {
    const grouped = new Map<string, Seat[]>();
    [...seats].filter((seat) => supportedCategories.includes(seat.category_name))
      .sort((a, b) => a.row_index - b.row_index || a.col_index - b.col_index)
      .forEach((seat) => grouped.set(seat.row_prefix, [...(grouped.get(seat.row_prefix) || []), seat]));
    return [...grouped.entries()];
  }, [seats]);

  const selectSeat = (seat: Seat) => {
    if (seat.availability !== "available") return;
    if (!selectedSeatIds.includes(seat.id) && selectedSeatIds.length >= maxSelectable) return;
    onSeatSelect(seat.id);
  };

  return (
    <div className="booking-seat-map">
      <div className="booking-screen"><span>SCREEN THIS WAY</span></div>

      <aside className="booking-seat-controls" aria-label="Seat selection controls">
        <div className="booking-seat-legend">
          <span><i className="available" />Available</span>
          <span><i className="selected" />Selected</span>
          <span><i className="booked" />Booked</span>
          <span><i className="premium" />Premium</span>
        </div>

        <div className="booking-category-options" aria-label="Choose seat category">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={selectedCategory === category ? "is-active" : ""}
              onClick={() => onCategorySelect(selectedCategory === category ? null : category)}
            >
              {category}
            </button>
          ))}
        </div>

        <p className="booking-category-lock">
          <Info />
          {selectedCategory ? `${selectedCategory} selected · Other seat categories are locked` : "Select a category to unlock seats"}
        </p>
      </aside>

      <div className="booking-seat-area">
        <div className="booking-seat-scroll">
          <div className="booking-seat-rows">
            {rows.map(([rowPrefix, rowSeats]) => (
              <div key={rowPrefix} className="booking-seat-row">
                <span className="booking-row-label">{rowPrefix}</span>
                <div className="booking-seat-list">
                  {rowSeats.map((seat) => {
                    const selected = selectedSeatIds.includes(seat.id);
                    const unavailable = seat.availability !== "available";
                    const categoryLocked = !selectedCategory || seat.category_name !== selectedCategory;
                    const premium = seat.category_name === "Gold";
                    return (
                      <button
                        key={seat.id}
                        type="button"
                        onClick={() => selectSeat(seat)}
                        disabled={unavailable || categoryLocked}
                        title={categoryLocked ? selectedCategory ? `${seat.category_name} is locked while ${selectedCategory} seats are selected` : "Select a seat category first" : `${seat.seat_number} · ${seat.category_name} · INR ${seat.price} · ${seat.availability}`}
                        className={`booking-seat ${selected ? "is-selected" : unavailable ? "is-booked" : categoryLocked ? "is-category-locked" : premium ? "is-premium" : "is-available"}`}
                        aria-label={`${seat.seat_number}, ${categoryLocked ? "different category locked" : seat.availability}`}
                      >
                        {unavailable ? "×" : seat.col_index}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="booking-scroll-hint"><Hand /> Drag or scroll to view more seats</p>
      </div>
    </div>
  );
}
