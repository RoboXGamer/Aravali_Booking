from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel, Field
import razorpay
from app.models.database import supabase
from app.config.settings import settings
from app.services.notifications import notification_service

router = APIRouter(prefix="/api/bookings", tags=["Cinema Bookings"])

rzp_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_SECRET))

class AnonymousBookingCreate(BaseModel):
    show_id: str
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    seat_layout_ids: List[str] = Field(..., min_items=1)

class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

@router.get("/availability/{show_id}")
def get_booked_seats(show_id: str):
    seats_query = supabase.table("booking_seats").select("seat_layout_id").eq("show_id", show_id).execute()
    booked_ids = [row["seat_layout_id"] for row in (seats_query.data or [])]
    return {"booked_seat_layout_ids": booked_ids}

@router.post("/")
def init_anonymous_booking(payload: AnonymousBookingCreate):
    show_query = supabase.table("shows").select("*, movies(*)").eq("id", payload.show_id).eq("is_enabled", True).execute()
    if not show_query.data:
        raise HTTPException(status_code=404, detail="Show session is either unavailable or disabled.")
    
    show = show_query.data[0]

    seats_query = supabase.table("seat_layouts").select("*").in_("id", payload.seat_layout_ids).execute()
    seats_map = {row["id"]: row for row in (seats_query.data or [])}

    for s_id in payload.seat_layout_ids:
        if s_id not in seats_map:
            raise HTTPException(status_code=400, detail="Invalid seat selected.")
        seat = seats_map[s_id]
        if seat["status"] != "active":
            raise HTTPException(status_code=400, detail=f"Seat {seat['seat_number']} is currently unavailable.")

    conflicts_query = supabase.table("booking_seats")\
        .select("seat_layout_id")\
        .eq("show_id", payload.show_id)\
        .in_("seat_layout_id", payload.seat_layout_ids)\
        .execute()
    
    if conflicts_query.data:
        raise HTTPException(status_code=400, detail="One or more selected seats were already booked by another user.")

    subtotal = sum(float(seats_map[s_id]["price"]) for s_id in payload.seat_layout_ids)
    convenience_fee = 30.00 * len(payload.seat_layout_ids)
    gst = (subtotal + convenience_fee) * 0.18
    grand_total = subtotal + convenience_fee + gst

    # Supabase's existing bookings table uses a UUID primary key. Keep the ID
    # as a string at the API boundary while storing a valid UUID in Postgres.
    booking_id = str(uuid4())

    booking_payload = {
        "id": booking_id,
        "show_id": payload.show_id,
        "customer_name": payload.customer_name,
        "customer_phone": payload.customer_phone,
        "customer_email": payload.customer_email,
        "total_amount": grand_total,
        "status": "pending"
    }

    booking_insert = supabase.table("bookings").insert(booking_payload).execute()
    if not booking_insert.data:
        raise HTTPException(status_code=500, detail="Failed to initialize reservation order state.")

    booking_seats_payload = [
        {"booking_id": booking_id, "show_id": payload.show_id, "seat_layout_id": s_id}
        for s_id in payload.seat_layout_ids
    ]
    try:
        supabase.table("booking_seats").insert(booking_seats_payload).execute()
    except Exception:
        supabase.table("bookings").delete().eq("id", booking_id).execute()
        raise HTTPException(status_code=400, detail="A seat has just been locked by another user session.")

    try:
        rzp_order = rzp_client.order.create(data={
            "amount": int(grand_total * 100),
            "currency": "INR",
            "receipt": booking_id,
            "payment_capture": 1
        })
    except Exception as e:
        supabase.table("bookings").delete().eq("id", booking_id).execute()
        raise HTTPException(status_code=500, detail=f"Payment partner handshake failed: {str(e)}")

    payment_payload = {
        "booking_id": booking_id,
        "razorpay_order_id": rzp_order["id"],
        "amount": grand_total,
        "status": "initiated"
    }
    supabase.table("payments").insert(payment_payload).execute()

    return {
        "booking": booking_insert.data[0],
        "razorpay_order": rzp_order
    }

@router.post("/verify")
def verify_cinema_payment(payload: PaymentVerify):
    try:
        signature_valid = rzp_client.utility.verify_payment_signature({
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature
        })
    except Exception:
        signature_valid = False

    if not signature_valid:
        raise HTTPException(status_code=400, detail="Invalid merchant transaction signature detected.")

    payment_query = supabase.table("payments").select("*").eq("razorpay_order_id", payload.razorpay_order_id).execute()
    if not payment_query.data:
        raise HTTPException(status_code=404, detail="Staged payment tracker not found.")

    payment_row = payment_query.data[0]
    booking_id = payment_row["booking_id"]

    supabase.table("bookings").update({"status": "confirmed"}).eq("id", booking_id).execute()

    supabase.table("payments").update({
        "razorpay_payment_id": payload.razorpay_payment_id,
        "razorpay_signature": payload.razorpay_signature,
        "status": "captured"
    }).eq("id", payment_row["id"]).execute()

    booking_query = supabase.table("bookings").select("*, shows(*, movies(*))").eq("id", booking_id).execute()
    if booking_query.data:
        b_data = booking_query.data[0]
        email_addr = b_data.get("customer_email")
        if email_addr:
            notification_service.send_email(
                to_email=email_addr,
                subject=f"Ticket Confirmed - Aravalli Auditorium: {booking_id}",
                body=f"Hello {b_data['customer_name']},\n\nYour seats for {b_data['shows']['movies']['title']} are successfully booked.\n\nBooking Reference: {booking_id}"
            )

    return {"status": "success", "booking_id": booking_id}
