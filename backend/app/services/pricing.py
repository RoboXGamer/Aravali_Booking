from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict


MONEY = Decimal("0.01")


def calculate_checkout_totals(
    *,
    subtotal: Any,
    seat_count: int,
    convenience_fee_per_seat: Any,
    gst_percentage: Any,
    razorpay_fee_percentage: Any,
) -> Dict[str, Decimal]:
    """Calculate the authoritative checkout amounts from application settings."""
    subtotal_amount = Decimal(str(subtotal)).quantize(MONEY, rounding=ROUND_HALF_UP)
    per_seat_fee = Decimal(str(convenience_fee_per_seat)) * max(seat_count, 0)
    gateway_fee = subtotal_amount * Decimal(str(razorpay_fee_percentage)) / Decimal("100")
    convenience_fee = (per_seat_fee + gateway_fee).quantize(MONEY, rounding=ROUND_HALF_UP)
    gst_amount = (
        (subtotal_amount + convenience_fee)
        * Decimal(str(gst_percentage))
        / Decimal("100")
    ).quantize(MONEY, rounding=ROUND_HALF_UP)
    return {
        "subtotal": subtotal_amount,
        "convenience_fee": convenience_fee,
        "gst_amount": gst_amount,
        "total_amount": subtotal_amount + convenience_fee + gst_amount,
    }
