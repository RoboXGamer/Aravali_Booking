from fastapi import APIRouter, HTTPException, Depends
from app.models.database import supabase
from app.middleware.auth import get_current_admin
from datetime import date, datetime

router = APIRouter(prefix="/api/admin", tags=["Admin Portal Contexts"])

@router.get("/dashboard-stats")
def get_dashboard_metrics(admin: dict = Depends(get_current_admin)):
    today_str = str(date.today())

    bookings_query = supabase.table("bookings").select("*, shows(*)").eq("status", "confirmed").execute()
    bookings_data = bookings_query.data or []

    today_rev = sum(float(b["total_amount"]) for b in bookings_data if b["created_at"][:10] == today_str)
    all_rev = sum(float(b["total_amount"]) for b in bookings_data)

    seats_query = supabase.table("booking_seats").select("id").execute()
    total_leased_seats = len(seats_query.data) if seats_query.data else 0

    reserved_seats_query = supabase.table("seat_layouts").select("id").eq("status", "reserved").execute()
    reserved_count = len(reserved_seats_query.data) if reserved_seats_query.data else 0

    return {
        "today_revenue": today_rev,
        "total_revenue": all_rev,
        "total_seats_sold": total_leased_seats,
        "total_reserved_seats": reserved_count
    }

@router.get("/seats/layout")
def get_seat_layouts():
    layouts_query = supabase.table("seat_layouts").select("*").execute()
    return layouts_query.data or []

@router.get("/bookings")
def get_all_bookings(admin: dict = Depends(get_current_admin)):
    bookings_query = supabase.table("bookings").select("*, shows(*, movies(*))").order("created_at", desc=True).execute()
    bookings_data = bookings_query.data or []

    for b in bookings_data:
        b["event_title"] = b.get("shows", {}).get("movies", {}).get("title", "Aravalli Auditorium Performance")
    
    return bookings_data

@router.post("/check-in/{booking_id}")
def verify_qr_code_checkin(booking_id: str, admin: dict = Depends(get_current_admin)):
    booking_query = supabase.table("bookings").select("*").eq("id", booking_id).execute()
    if not booking_query.data:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    booking = booking_query.data[0]

    if booking["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Ticket payment is pending or cancelled.")

    if booking["is_checked_in"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Ticket Already Used. Scanned at {booking['checked_in_at']}"
        )

    checkin_time = datetime.utcnow().isoformat()
    supabase.table("bookings").update({
        "is_checked_in": True,
        "checked_in_at": checkin_time
    }).eq("id", booking_id).execute()

    return {
        "status": "success",
        "detail": "Welcome to Aravalli Auditorium. Enjoy the show!",
        "booking_id": booking_id,
        "customer_name": booking["customer_name"]
    }

@router.post("/seats/reserve/{seat_id}")
def reserve_seat_manually(seat_id: str, admin: dict = Depends(get_current_admin)):
    supabase.table("seat_layouts").update({"status": "reserved"}).eq("id", seat_id).execute()
    return {"status": "success", "detail": "Seat marked as reserved. Closed from online sales."}

@router.post("/seats/release/{seat_id}")
def release_seat_manually(seat_id: str, admin: dict = Depends(get_current_admin)):
    supabase.table("seat_layouts").update({"status": "active"}).eq("id", seat_id).execute()
    return {"status": "success", "detail": "Seat released. Reopened for public bookings."}

@router.delete("/events/{event_id}")
def delete_event(event_id: str, admin: dict = Depends(get_current_admin)):
    response = supabase.table("shows").delete().eq("id", event_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Entity reference not resolved.")
    return {"status": "success", "detail": "Show playtime removed safely."}
