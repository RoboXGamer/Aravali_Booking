from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class CheckoutSessionCreate(BaseModel):
    show_id: str
    customer_name: str = Field(min_length=2, max_length=120)
    customer_email: str = Field(min_length=5, max_length=255)
    customer_phone: Optional[str] = Field(default=None, min_length=7, max_length=20)
    seat_layout_ids: List[str] = Field(min_length=1)

    @field_validator("customer_name")
    @classmethod
    def trim_required_fields(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty.")
        return value

    @field_validator("customer_email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or "." not in value.rsplit("@", 1)[-1]:
            raise ValueError("Enter a valid email address.")
        return value

    @field_validator("customer_phone")
    @classmethod
    def normalize_optional_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("seat_layout_ids")
    @classmethod
    def reject_duplicate_seats(cls, value: List[str]) -> List[str]:
        if len(value) != len(set(value)):
            raise ValueError("The same seat cannot be selected more than once.")
        return value


class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    checkout_session_id: Optional[str] = None


class BookingLookup(BaseModel):
    booking_code: str = Field(min_length=5, max_length=40)
    customer_email: str = Field(min_length=5, max_length=255)

    @field_validator("booking_code")
    @classmethod
    def normalize_booking_code(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("customer_email")
    @classmethod
    def normalize_lookup_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or "." not in value.rsplit("@", 1)[-1]:
            raise ValueError("Enter a valid email address.")
        return value
