from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class BookingCreate(BaseModel):
    event_id: str
    category_id: str
    quantity: int = Field(..., gt=0, le=10)
    customer_name: str
    customer_phone: str

class BookingResponse(BaseModel):
    id: str
    user_id: Optional[str]
    event_id: str
    category_id: str
    quantity: int
    subtotal: float
    convenience_fee: float
    gst: float
    grand_total: float
    customer_name: str
    customer_phone: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
