import { Hand, Info } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import type { BookingCategory, Seat, TicketCategory } from "../../types";

interface SeatControlsProps {
  categories: TicketCategory[];
  selectedCategory: BookingCategory | null;
  onCategorySelect: (category: BookingCategory | null) => void;
  className?: string;
  footer?: ReactNode;
}

export function SeatControls({
  selectedCategory,
  onCategorySelect,
  categories,
  className = "booking-seat-controls",
  footer,
}: SeatControlsProps) {
  return (
    <aside className={className} aria-label="Seat selection controls">
      <div className="booking-seat-legend">
        <span><i className="available" />Available</span>
        <span><i className="selected" />Selected</span>
        <span><i className="booked" />Booked</span>
        <span><i className="premium" />Premium</span>
      </div>

      <div className="booking-category-options" aria-label="Choose seat category" data-category-selector>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={selectedCategory === category.id ? "is-active" : ""}
            onClick={() => onCategorySelect(selectedCategory === category.id ? null : category.id)}
          >
            {category.id} · ₹{category.price}
          </button>
        ))}
      </div>

      <p className="booking-category-lock">
        <Info />
        {selectedCategory ? `${selectedCategory} selected · Other seat categories are locked` : "Select a category to unlock seats"}
      </p>

      {footer}
    </aside>
  );
}

interface SeatMapProps {
  seats: Seat[];
  selectedSeatIds: string[];
  categories: TicketCategory[];
  selectedCategory: BookingCategory | null;
  onCategorySelect: (category: BookingCategory | null) => void;
  onSeatSelect: (seatId: string) => void;
  onCategoryRequired: (seat: Seat) => void;
  maxSelectable: number;
}

export function SeatMap({ seats, selectedSeatIds, categories, selectedCategory, onCategorySelect, onSeatSelect, onCategoryRequired, maxSelectable }: SeatMapProps) {
  const supportedCategories: Seat["category_name"][] = ["Gold", "Silver"];
  const selectedTicketCategory = categories.find((category) => category.id === selectedCategory) ?? null;
  const sections = useMemo(() => {
    const grouped = new Map<string, Map<string, Seat[]>>();
    [...seats].filter((seat) => supportedCategories.includes(seat.category_name))
      .sort((a, b) => a.row_index - b.row_index || a.col_index - b.col_index)
      .forEach((seat) => {
        const section = grouped.get(seat.section_name) ?? new Map<string, Seat[]>();
        section.set(seat.row_prefix, [...(section.get(seat.row_prefix) ?? []), seat]);
        grouped.set(seat.section_name, section);
      });

    return [...grouped.entries()].map(([sectionName, sectionRows]) => {
      const rows = [...sectionRows.entries()];
      const physicalCategory = rows[0]?.[1][0]?.category_name;
      const prices = categories
        .filter((category) => category.seat_category === physicalCategory)
        .map((category) => category.price);
      return {
        name: sectionName,
        categoryLabel: physicalCategory,
        priceLabel: prices.map((price) => `₹${price}`).join(" / "),
        rows,
      };
    });
  }, [categories, seats]);

  const selectSeat = (seat: Seat) => {
    if (seat.availability !== "available") return;
    if (!selectedTicketCategory || seat.category_name !== selectedTicketCategory.seat_category) {
      onCategoryRequired(seat);
      return;
    }
    if (!selectedSeatIds.includes(seat.id) && selectedSeatIds.length >= maxSelectable) return;
    onSeatSelect(seat.id);
  };

  return (
    <div className="booking-seat-map">
      <div className="booking-screen"><span>SCREEN THIS WAY</span></div>

      <SeatControls categories={categories} selectedCategory={selectedCategory} onCategorySelect={onCategorySelect} />

      <div className="booking-seat-area">
        <div className="booking-seat-scroll">
          <div className="booking-seat-rows">
            {sections.map((section) => (
              <section key={section.name} className="booking-seat-section" aria-label={`${section.name} seats`}>
                <div className="booking-seat-section-heading">
                  <span>{section.name}</span>
                  <strong>{section.categoryLabel} · {section.priceLabel}</strong>
                </div>
                <div className="booking-seat-section-rows">
                  {section.rows.map(([rowPrefix, rowSeats]) => {
                    const maximumColumn = Math.max(...rowSeats.map((seat) => seat.col_index));
                    return (
                      <div key={rowPrefix} className="booking-seat-row">
                        <span className="booking-row-label">{rowPrefix}</span>
                        <div
                          className="booking-seat-list"
                          style={{ gridTemplateColumns: `repeat(${maximumColumn}, var(--booking-seat-size))` }}
                        >
                          {rowSeats.map((seat) => {
                            const selected = selectedSeatIds.includes(seat.id);
                            const unavailable = seat.availability !== "available";
                            const categoryLocked = !selectedTicketCategory || seat.category_name !== selectedTicketCategory.seat_category;
                            const premium = seat.category_name === "Gold";
                            const displayNumber = seat.seat_number.startsWith(rowPrefix)
                              ? seat.seat_number.slice(rowPrefix.length)
                              : seat.seat_number;
                            return (
                              <button
                                key={seat.id}
                                type="button"
                                onClick={() => selectSeat(seat)}
                                disabled={unavailable}
                                aria-disabled={categoryLocked || unavailable}
                                title={categoryLocked ? selectedCategory ? `${seat.category_name} seats are locked while ${selectedCategory} is selected` : "Select a ticket category first" : `${seat.seat_number} · ${selectedCategory} · INR ${selectedTicketCategory?.price} · ${seat.availability}`}
                                className={`booking-seat ${selected ? "is-selected" : unavailable ? "is-booked" : categoryLocked ? "is-category-locked" : premium ? "is-premium" : "is-available"}`}
                                aria-label={`${seat.seat_number}, ${categoryLocked ? "different category locked" : seat.availability}`}
                                style={{ gridColumn: seat.col_index }}
                              >
                                {unavailable ? "×" : displayNumber}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
        <p className="booking-scroll-hint"><Hand /> Drag or scroll to view more seats</p>
      </div>
    </div>
  );
}
