from typing import Iterable


def occupancy_percentage(sold_seats: int, capacity: int) -> float:
    """Return a bounded occupancy percentage for one show."""
    if capacity <= 0:
        return 0.0
    return round(min(max(sold_seats, 0) / capacity * 100, 100.0), 1)


def aggregate_occupancy(sold_counts: Iterable[int], capacity_per_show: int) -> float:
    """Return occupancy across shows using one capacity allocation per show."""
    counts = [max(count, 0) for count in sold_counts]
    if capacity_per_show <= 0 or not counts:
        return 0.0
    return occupancy_percentage(sum(counts), capacity_per_show * len(counts))
