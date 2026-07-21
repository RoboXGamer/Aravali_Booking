from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field
from supabase import create_client

from app.config.settings import settings
from app.middleware.auth import get_current_admin
from app.models.database import supabase


router = APIRouter(prefix="/api/admin", tags=["Admin"])


class AdminLogin(BaseModel):
    email: str
    password: str


class MoviePayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    synopsis: Optional[str] = None
    duration_minutes: int = Field(gt=0)
    genre: str
    certificate: str
    language: str
    cast_members: Optional[str] = None
    director: Optional[str] = None
    release_year: int = Field(ge=1888, le=2200)
    poster_url: Optional[str] = None
    trailer_url: Optional[str] = None
    is_active: bool = True


class ShowPayload(BaseModel):
    movie_id: str
    date: date
    time: str
    is_enabled: bool = True


class ShowStatusPayload(BaseModel):
    is_enabled: bool


class DuplicateWeekPayload(BaseModel):
    source_week_start: date
    target_week_start: date


class SeatPayload(BaseModel):
    section_name: str
    row_prefix: str
    row_index: int = Field(gt=0)
    col_index: int = Field(gt=0)
    seat_number: str
    category_name: str
    price: float = Field(ge=0)
    status: str = "active"
    is_visible: bool = True


class SeatReservationPayload(BaseModel):
    show_id: str
    seat_layout_id: str
    reason: Optional[str] = None


class BookingStatusPayload(BaseModel):
    status: str


class PollPayload(BaseModel):
    week_start: date
    voting_starts_at: datetime
    voting_ends_at: datetime
    movie_ids: List[str] = Field(min_length=2)


class PollOverridePayload(BaseModel):
    movie_id: str


def _admin(_: dict = Depends(get_current_admin)) -> dict:
    return _


@router.post("/auth/login")
def admin_login(payload: AdminLogin):
    try:
        auth_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)
        auth_response = auth_client.auth.sign_in_with_password(
            {"email": payload.email.strip().lower(), "password": payload.password}
        )
        if not auth_response.user or not auth_response.session:
            raise HTTPException(status_code=401, detail="Invalid admin credentials.")

        profile = (
            supabase.table("profiles")
            .select("id, email, full_name, role")
            .eq("id", str(auth_response.user.id))
            .eq("role", "admin")
            .limit(1)
            .execute()
        )
        if not profile.data:
            raise HTTPException(status_code=403, detail="This account is not an administrator.")

        return {
            "access_token": auth_response.session.access_token,
            "expires_at": auth_response.session.expires_at,
            "admin": profile.data[0],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid admin credentials.") from exc


@router.get("/auth/me")
def admin_me(admin: dict = Depends(get_current_admin)):
    return admin


@router.get("/dashboard")
@router.get("/dashboard-stats")
def dashboard(admin: dict = Depends(get_current_admin)):
    del admin
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    week_start = (now.date() - timedelta(days=now.weekday())).isoformat()
    month_start = now.date().replace(day=1).isoformat()

    bookings = (
        supabase.table("bookings")
        .select("id, total_amount, status, created_at, show_id")
        .in_("status", ["confirmed", "refunded"])
        .execute()
    ).data or []
    confirmed = [booking for booking in bookings if booking["status"] == "confirmed"]
    today_bookings = [booking for booking in confirmed if booking["created_at"][:10] == today]
    weekly = [booking for booking in confirmed if booking["created_at"][:10] >= week_start]
    monthly = [booking for booking in confirmed if booking["created_at"][:10] >= month_start]

    sold_seats = supabase.table("booking_seats").select("id", count="exact").execute()
    total_seats = (
        supabase.table("seat_layouts")
        .select("id", count="exact")
        .eq("status", "active")
        .eq("is_visible", True)
        .execute()
    )
    upcoming = (
        supabase.table("shows")
        .select("*, movies(*)")
        .gte("date", today)
        .eq("is_enabled", True)
        .order("date")
        .order("time")
        .limit(10)
        .execute()
    ).data or []
    active_poll = (
        supabase.table("polls")
        .select("*, poll_options(*, movies(*))")
        .in_("status", ["voting", "closed", "overridden"])
        .order("week_start", desc=True)
        .limit(1)
        .execute()
    ).data

    sold_count = sold_seats.count or 0
    seat_count = total_seats.count or 0
    return {
        "today_bookings": len(today_bookings),
        "today_revenue": sum(float(item["total_amount"]) for item in today_bookings),
        "weekly_revenue": sum(float(item["total_amount"]) for item in weekly),
        "monthly_revenue": sum(float(item["total_amount"]) for item in monthly),
        "total_revenue": sum(float(item["total_amount"]) for item in confirmed),
        "total_seats_sold": sold_count,
        "occupancy_percentage": round((sold_count / seat_count * 100) if seat_count else 0, 1),
        "upcoming_shows": upcoming,
        "current_poll": active_poll[0] if active_poll else None,
    }


@router.get("/movies")
def list_movies(_: dict = Depends(get_current_admin)):
    return supabase.table("movies").select("*").order("created_at", desc=True).execute().data or []


@router.post("/movies")
def create_movie(payload: MoviePayload, _: dict = Depends(get_current_admin)):
    return supabase.table("movies").insert(payload.model_dump()).execute().data[0]


@router.put("/movies/{movie_id}")
def update_movie(movie_id: str, payload: MoviePayload, _: dict = Depends(get_current_admin)):
    response = supabase.table("movies").update(payload.model_dump()).eq("id", movie_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Movie not found.")
    return response.data[0]


@router.delete("/movies/{movie_id}")
def delete_movie(movie_id: str, _: dict = Depends(get_current_admin)):
    try:
        response = supabase.table("movies").delete().eq("id", movie_id).execute()
    except APIError as exc:
        raise HTTPException(status_code=409, detail="Movie is used by a show or poll and cannot be deleted.") from exc
    if not response.data:
        raise HTTPException(status_code=404, detail="Movie not found.")
    return {"status": "success"}


@router.get("/shows")
def list_shows(_: dict = Depends(get_current_admin)):
    return (
        supabase.table("shows")
        .select("*, movies(*)")
        .order("date", desc=True)
        .order("time")
        .execute()
    ).data or []


@router.post("/shows")
def create_show(payload: ShowPayload, _: dict = Depends(get_current_admin)):
    try:
        return supabase.table("shows").insert(payload.model_dump(mode="json")).execute().data[0]
    except APIError as exc:
        raise HTTPException(status_code=409, detail=str(getattr(exc, "message", "") or exc)) from exc


@router.patch("/shows/{show_id}")
def change_show_status(show_id: str, payload: ShowStatusPayload, _: dict = Depends(get_current_admin)):
    response = supabase.table("shows").update(payload.model_dump()).eq("id", show_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Show not found.")
    return response.data[0]


@router.delete("/shows/{show_id}")
@router.delete("/events/{show_id}")
def delete_show(show_id: str, _: dict = Depends(get_current_admin)):
    try:
        response = supabase.table("shows").delete().eq("id", show_id).execute()
    except APIError as exc:
        raise HTTPException(status_code=409, detail="Show has bookings and cannot be deleted.") from exc
    if not response.data:
        raise HTTPException(status_code=404, detail="Show not found.")
    return {"status": "success"}


@router.post("/shows/duplicate-week")
def duplicate_week(payload: DuplicateWeekPayload, _: dict = Depends(get_current_admin)):
    source_end = payload.source_week_start + timedelta(days=6)
    offset = (payload.target_week_start - payload.source_week_start).days
    source = (
        supabase.table("shows")
        .select("movie_id, date, time, is_enabled")
        .gte("date", payload.source_week_start.isoformat())
        .lte("date", source_end.isoformat())
        .execute()
    ).data or []
    if not source:
        raise HTTPException(status_code=404, detail="Source week has no shows.")
    rows = [
        {**show, "date": (date.fromisoformat(show["date"]) + timedelta(days=offset)).isoformat()}
        for show in source
    ]
    try:
        return supabase.table("shows").insert(rows).execute().data or []
    except APIError as exc:
        raise HTTPException(status_code=409, detail=str(getattr(exc, "message", "") or exc)) from exc


@router.get("/seats")
@router.get("/seats/layout")
def list_seats(_: dict = Depends(get_current_admin)):
    return supabase.table("seat_layouts").select("*").order("row_index").order("col_index").execute().data or []


@router.post("/seats")
def create_seat(payload: SeatPayload, _: dict = Depends(get_current_admin)):
    try:
        return supabase.table("seat_layouts").insert(payload.model_dump()).execute().data[0]
    except APIError as exc:
        raise HTTPException(status_code=409, detail=str(getattr(exc, "message", "") or exc)) from exc


@router.put("/seats/{seat_id}")
def update_seat(seat_id: str, payload: SeatPayload, _: dict = Depends(get_current_admin)):
    response = supabase.table("seat_layouts").update(payload.model_dump()).eq("id", seat_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Seat not found.")
    return response.data[0]


@router.delete("/seats/{seat_id}")
def delete_seat(seat_id: str, _: dict = Depends(get_current_admin)):
    try:
        response = supabase.table("seat_layouts").delete().eq("id", seat_id).execute()
    except APIError as exc:
        raise HTTPException(status_code=409, detail="Seat is used by a booking and cannot be deleted; disable it instead.") from exc
    if not response.data:
        raise HTTPException(status_code=404, detail="Seat not found.")
    return {"status": "success"}


@router.get("/reservations")
def list_reservations(show_id: Optional[str] = None, _: dict = Depends(get_current_admin)):
    query = supabase.table("show_seat_reservations").select("*, shows(*, movies(*)), seat_layouts(*)")
    if show_id:
        query = query.eq("show_id", show_id)
    return query.order("created_at", desc=True).execute().data or []


@router.post("/reservations")
def reserve_seat(payload: SeatReservationPayload, admin: dict = Depends(get_current_admin)):
    row = {**payload.model_dump(), "reserved_by": admin["sub"]}
    try:
        return supabase.table("show_seat_reservations").insert(row).execute().data[0]
    except APIError as exc:
        raise HTTPException(status_code=409, detail="Seat is already reserved for this show.") from exc


@router.delete("/reservations/{reservation_id}")
def release_seat(reservation_id: str, _: dict = Depends(get_current_admin)):
    response = supabase.table("show_seat_reservations").delete().eq("id", reservation_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Reservation not found.")
    return {"status": "success"}


@router.get("/bookings")
def list_bookings(
    search: Optional[str] = None,
    show_id: Optional[str] = None,
    status: Optional[str] = None,
    _: dict = Depends(get_current_admin),
):
    query = supabase.table("bookings").select("*, shows(*, movies(*)), booking_seats(*)")
    if show_id:
        query = query.eq("show_id", show_id)
    if status:
        query = query.eq("status", status)
    if search:
        term = search.strip()
        query = query.or_(f"booking_code.ilike.%{term}%,customer_email.ilike.%{term}%,customer_phone.ilike.%{term}%")
    return query.order("created_at", desc=True).execute().data or []


@router.patch("/bookings/{booking_id}/status")
def update_booking_status(booking_id: str, payload: BookingStatusPayload, _: dict = Depends(get_current_admin)):
    if payload.status not in {"confirmed", "cancelled", "refunded"}:
        raise HTTPException(status_code=400, detail="Invalid booking status.")
    response = supabase.table("bookings").update({"status": payload.status}).eq("id", booking_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if payload.status == "refunded":
        supabase.table("payments").update({"status": "refunded"}).eq("booking_id", booking_id).execute()
    return response.data[0]


@router.get("/polls")
def list_polls(_: dict = Depends(get_current_admin)):
    return (
        supabase.table("polls")
        .select("*, poll_options(*, movies(*))")
        .order("week_start", desc=True)
        .execute()
    ).data or []


@router.post("/polls")
def create_poll(payload: PollPayload, _: dict = Depends(get_current_admin)):
    if payload.week_start.weekday() != 0:
        raise HTTPException(status_code=400, detail="Poll week_start must be a Monday.")
    try:
        poll = supabase.table("polls").insert(
            {
                "week_start": payload.week_start.isoformat(),
                "voting_starts_at": payload.voting_starts_at.isoformat(),
                "voting_ends_at": payload.voting_ends_at.isoformat(),
                "status": "voting",
            }
        ).execute().data[0]
        supabase.table("poll_options").insert(
            [{"poll_id": poll["id"], "movie_id": movie_id} for movie_id in dict.fromkeys(payload.movie_ids)]
        ).execute()
        return poll
    except APIError as exc:
        raise HTTPException(status_code=409, detail=str(getattr(exc, "message", "") or exc)) from exc


@router.post("/polls/{poll_id}/override")
def override_poll(poll_id: str, payload: PollOverridePayload, _: dict = Depends(get_current_admin)):
    try:
        supabase.rpc("override_poll_winner", {"p_poll_id": poll_id, "p_movie_id": payload.movie_id}).execute()
        return {"status": "success"}
    except APIError as exc:
        raise HTTPException(status_code=409, detail=str(getattr(exc, "message", "") or exc)) from exc


@router.post("/check-in/{booking_code}")
def check_in(booking_code: str, _: dict = Depends(get_current_admin)):
    response = (
        supabase.table("bookings")
        .select("*")
        .eq("booking_code", booking_code.strip().upper())
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    booking = response.data[0]
    if booking["status"] != "confirmed":
        raise HTTPException(status_code=409, detail=f"Ticket is {booking['status']}.")
    if booking["is_checked_in"]:
        raise HTTPException(status_code=409, detail=f"Ticket already used at {booking['checked_in_at']}.")
    checked_at = datetime.now(timezone.utc).isoformat()
    updated = (
        supabase.table("bookings")
        .update({"is_checked_in": True, "checked_in_at": checked_at})
        .eq("id", booking["id"])
        .eq("is_checked_in", False)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status_code=409, detail="Ticket was already checked in.")
    return {
        "status": "success",
        "booking_code": booking["booking_code"],
        "customer_name": booking["customer_name"],
        "checked_in_at": checked_at,
    }
