from datetime import date
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from postgrest.exceptions import APIError

from app.models.database import supabase


router = APIRouter(prefix="/api/events", tags=["Public Shows"])


def _serialize_show(show: Dict[str, Any]) -> Dict[str, Any]:
    movie = show.get("movies") or {}
    return {
        "id": show["id"],
        "movie_id": show["movie_id"],
        "title": movie.get("title", "Untitled Movie"),
        "description": movie.get("synopsis"),
        "date": show["date"],
        "time": show["time"],
        "venue": "Aravalli Auditorium Main Hall",
        "poster_url": movie.get("poster_url"),
        "trailer_url": movie.get("trailer_url"),
        "duration_minutes": movie.get("duration_minutes", 0),
        "genre": movie.get("genre", ""),
        "certificate": movie.get("certificate", ""),
        "language": movie.get("language", ""),
        "cast_members": movie.get("cast_members"),
        "director": movie.get("director"),
        "release_year": movie.get("release_year", 0),
        "status": "active" if show.get("is_enabled") else "disabled",
    }


@router.get("")
@router.get("/")
def list_events():
    try:
        response = (
            supabase.table("shows")
            .select("*, movies(*)")
            .eq("is_enabled", True)
            .gte("date", date.today().isoformat())
            .order("date")
            .order("time")
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=502, detail="Unable to load upcoming shows.") from exc

    return [_serialize_show(show) for show in (response.data or [])]


@router.get("/{event_id}")
def get_event(event_id: str):
    try:
        response = (
            supabase.table("shows")
            .select("*, movies(*)")
            .eq("id", event_id)
            .eq("is_enabled", True)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=502, detail="Unable to load the selected show.") from exc

    if not response.data:
        raise HTTPException(status_code=404, detail="Show not found or no longer enabled.")

    return _serialize_show(response.data[0])
