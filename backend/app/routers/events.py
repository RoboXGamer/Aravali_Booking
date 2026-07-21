from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.database import supabase

router = APIRouter(prefix="/api/events", tags=["Cinema Showtimes API"])

@router.get("")
@router.get("/")
def list_events():
    shows_query = supabase.table("shows").select("*, movies(*)").eq("is_enabled", True).execute()
    if not shows_query.data:
        return []

    processed_events = []
    for s in shows_query.data:
        processed_events.append({
            "id": s["id"],
            "title": s["movies"]["title"],
            "description": s["movies"]["synopsis"],
            "date": s["date"],
            "time": s["time"],
            "venue": "Aravalli Auditorium Main Hall",
            "poster_url": s["movies"]["poster_url"],
            "status": "active"
        })
    return processed_events

@router.get("/{event_id}")
def get_event(event_id: str):
    show_query = supabase.table("shows").select("*, movies(*)").eq("id", event_id).execute()
    if not show_query.data:
        raise HTTPException(status_code=404, detail="Requested show time slot is missing.")
    
    s = show_query.data[0]
    return {
        "id": s["id"],
        "title": s["movies"]["title"],
        "description": s["movies"]["synopsis"],
        "date": s["date"],
        "time": s["time"],
        "venue": "Aravalli Auditorium Main Hall",
        "poster_url": s["movies"]["poster_url"],
        "status": "active"
    }
