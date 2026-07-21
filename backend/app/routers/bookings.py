from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Optional

import razorpay
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from postgrest.exceptions import APIError

from app.config.settings import settings
from app.models.database import supabase
from app.schemas.booking import BookingLookup, CheckoutSessionCreate, PaymentVerify
from app.services.pdf_generator import create_ticket_pdf_stream


router = APIRouter(prefix="/api/bookings", tags=["Public Bookings"])
rzp_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_SECRET))


def _money_to_paise(value: Any) -> int:
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _rpc_payload(response: Any) -> Dict[str, Any]:
    data = response.data
    if isinstance(data, list):
        data = data[0] if data else None
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="Database returned an invalid booking response.")
    return data


def _database_error(exc: APIError, fallback: str) -> HTTPException:
    message = str(getattr(exc, "message", "") or exc)
    lowered = message.lower()
    if any(term in lowered for term in ("unavailable", "already", "expired", "reserved", "disabled")):
        return HTTPException(status_code=409, detail=message)
    if any(term in lowered for term in ("invalid", "maximum", "required", "not found")):
        return HTTPException(status_code=400, detail=message)
    return HTTPException(status_code=502, detail=fallback)


def _booking_query(booking_code: str, customer_email: str) -> Optional[Dict[str, Any]]:
    response = (
        supabase.table("bookings")
        .select("*, shows(*, movies(*)), booking_seats(*)")
        .eq("booking_code", booking_code.strip().upper())
        .eq("customer_email", customer_email.strip().lower())
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


@router.get("/settings")
def get_booking_settings():
    try:
        response = supabase.table("app_settings").select("*").eq("id", 1).single().execute()
        return response.data
    except APIError as exc:
        raise HTTPException(status_code=502, detail="Unable to load booking settings.") from exc


@router.get("/availability/{show_id}")
def get_show_availability(show_id: str):
    try:
        supabase.rpc("cleanup_expired_checkout_sessions").execute()

        show_response = (
            supabase.table("shows")
            .select("id")
            .eq("id", show_id)
            .eq("is_enabled", True)
            .limit(1)
            .execute()
        )
        if not show_response.data:
            raise HTTPException(status_code=404, detail="Show not found or no longer enabled.")

        seats = (
            supabase.table("seat_layouts")
            .select("*")
            .eq("is_visible", True)
            .order("row_index")
            .order("col_index")
            .execute()
        ).data or []
        booked = (
            supabase.table("booking_seats")
            .select("seat_layout_id")
            .eq("show_id", show_id)
            .execute()
        ).data or []
        reserved = (
            supabase.table("show_seat_reservations")
            .select("seat_layout_id")
            .eq("show_id", show_id)
            .execute()
        ).data or []
        held = (
            supabase.table("checkout_session_seats")
            .select("seat_layout_id, checkout_sessions!inner(status, expires_at)")
            .eq("show_id", show_id)
            .eq("checkout_sessions.status", "pending")
            .execute()
        ).data or []
    except HTTPException:
        raise
    except APIError as exc:
        raise HTTPException(status_code=502, detail="Unable to load seat availability.") from exc

    booked_ids = {row["seat_layout_id"] for row in booked}
    reserved_ids = {row["seat_layout_id"] for row in reserved}
    held_ids = {row["seat_layout_id"] for row in held}

    for seat in seats:
        seat_id = seat["id"]
        if seat.get("status") == "disabled":
            availability = "disabled"
        elif seat_id in booked_ids:
            availability = "booked"
        elif seat_id in reserved_ids:
            availability = "reserved"
        elif seat_id in held_ids:
            availability = "held"
        else:
            availability = "available"
        seat["availability"] = availability

    return {
        "show_id": show_id,
        "seats": seats,
        "booked_seat_layout_ids": sorted(booked_ids | held_ids),
        "reserved_seat_layout_ids": sorted(reserved_ids),
    }


@router.post("/checkout-sessions")
@router.post("/")
def create_checkout_session(payload: CheckoutSessionCreate):
    try:
        rpc_response = supabase.rpc(
            "create_checkout_session",
            {
                "p_show_id": payload.show_id,
                "p_customer_name": payload.customer_name,
                "p_customer_phone": payload.customer_phone,
                "p_customer_email": payload.customer_email,
                "p_seat_ids": payload.seat_layout_ids,
            },
        ).execute()
        checkout = _rpc_payload(rpc_response)
    except APIError as exc:
        raise _database_error(exc, "Unable to hold the selected seats.") from exc

    session = checkout["checkout_session"]
    try:
        razorpay_order = rzp_client.order.create(
            data={
                "amount": _money_to_paise(session["total_amount"]),
                "currency": "INR",
                "receipt": session["id"],
                "notes": {"checkout_session_id": session["id"], "show_id": payload.show_id},
            }
        )

        supabase.table("checkout_sessions").update(
            {"razorpay_order_id": razorpay_order["id"]}
        ).eq("id", session["id"]).execute()

        supabase.table("payments").insert(
            {
                "checkout_session_id": session["id"],
                "provider_order_id": razorpay_order["id"],
                "amount": session["total_amount"],
                "status": "created",
            }
        ).execute()
    except Exception as exc:
        try:
            supabase.rpc("release_checkout_session", {"p_session_id": session["id"]}).execute()
        except Exception:
            pass
        raise HTTPException(status_code=502, detail="Unable to initialize Razorpay checkout.") from exc

    session["razorpay_order_id"] = razorpay_order["id"]
    return {
        "checkout_session": session,
        "selected_seats": checkout["selected_seats"],
        "razorpay_order": razorpay_order,
        # Compatibility alias for the existing checkout screen until Phase 4.
        "booking": session,
    }


@router.post("/verify")
def verify_payment(payload: PaymentVerify):
    try:
        rzp_client.utility.verify_payment_signature(
            {
                "razorpay_order_id": payload.razorpay_order_id,
                "razorpay_payment_id": payload.razorpay_payment_id,
                "razorpay_signature": payload.razorpay_signature,
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature.") from exc

    try:
        session_query = (
            supabase.table("checkout_sessions")
            .select("id")
            .eq("razorpay_order_id", payload.razorpay_order_id)
            .limit(1)
            .execute()
        )
        if not session_query.data:
            raise HTTPException(status_code=404, detail="Checkout session not found.")

        session_id = session_query.data[0]["id"]
        if payload.checkout_session_id and payload.checkout_session_id != session_id:
            raise HTTPException(status_code=400, detail="Payment does not match the checkout session.")

        finalized = _rpc_payload(
            supabase.rpc(
                "finalize_paid_booking",
                {
                    "p_session_id": session_id,
                    "p_provider_payment_id": payload.razorpay_payment_id,
                    "p_provider_signature": payload.razorpay_signature,
                },
            ).execute()
        )
    except HTTPException:
        raise
    except APIError as exc:
        raise _database_error(exc, "Payment succeeded but booking finalization failed.") from exc

    booking = finalized["booking"]
    return {
        "status": "success",
        "booking_id": booking["booking_code"],
        "booking_code": booking["booking_code"],
        "booking": booking,
    }


@router.post("/lookup")
def lookup_booking(payload: BookingLookup):
    try:
        booking = _booking_query(payload.booking_code, payload.customer_email)
    except APIError as exc:
        raise HTTPException(status_code=502, detail="Unable to retrieve booking.") from exc
    if not booking:
        raise HTTPException(status_code=404, detail="No booking matches that code and email address.")
    return booking


@router.get("/ticket/{booking_code}/download")
def download_ticket(booking_code: str, email: str = Query(..., min_length=5, max_length=255)):
    try:
        booking = _booking_query(booking_code, email)
    except APIError as exc:
        raise HTTPException(status_code=502, detail="Unable to create ticket.") from exc
    if not booking:
        raise HTTPException(status_code=404, detail="No booking matches that code and email address.")
    if booking.get("status") != "confirmed":
        raise HTTPException(status_code=409, detail="Only confirmed bookings have downloadable tickets.")

    ticket_stream = create_ticket_pdf_stream(booking)
    filename = f"Aravalli-{booking['booking_code']}.pdf"
    return StreamingResponse(
        ticket_stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{booking_code}")
def get_booking(booking_code: str, email: str = Query(..., min_length=5, max_length=255)):
    try:
        booking = _booking_query(booking_code, email)
    except APIError as exc:
        raise HTTPException(status_code=502, detail="Unable to retrieve booking.") from exc
    if not booking:
        raise HTTPException(status_code=404, detail="No booking matches that code and email address.")
    return booking
