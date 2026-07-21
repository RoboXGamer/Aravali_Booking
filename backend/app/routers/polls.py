import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from app.config.settings import settings
from app.middleware.auth import get_current_admin
from app.models.database import supabase


router = APIRouter(prefix="/api/polls", tags=["Movie Polls"])


class VotePayload(BaseModel):
    poll_option_id: str
    visitor_id: str = Field(min_length=16, max_length=128)


class OverridePayload(BaseModel):
    movie_id: str


def _fingerprint_hash(poll_id: str, visitor_id: str) -> str:
    payload = f"{poll_id}:{visitor_id}:{settings.SUPABASE_JWT_SECRET}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _serialize_poll(poll: Dict[str, Any], visitor_id: Optional[str]) -> Dict[str, Any]:
    options_response = (
        supabase.table("poll_options")
        .select("*, movies(*)")
        .eq("poll_id", poll["id"])
        .order("votes_count", desc=True)
        .execute()
    )
    options = options_response.data or []
    total_votes = sum(int(option.get("votes_count") or 0) for option in options)

    serialized_options = []
    for option in options:
        votes = int(option.get("votes_count") or 0)
        serialized_options.append(
            {
                "id": option["id"],
                "movie_id": option["movie_id"],
                "votes_count": votes,
                "percentage": round((votes / total_votes * 100) if total_votes else 0, 1),
                "movie": option.get("movies") or {},
            }
        )

    has_voted = False
    selected_option_id = None
    if visitor_id:
        vote_response = (
            supabase.table("poll_votes")
            .select("poll_option_id")
            .eq("poll_id", poll["id"])
            .eq("fingerprint_hash", _fingerprint_hash(poll["id"], visitor_id))
            .limit(1)
            .execute()
        )
        if vote_response.data:
            has_voted = True
            selected_option_id = vote_response.data[0]["poll_option_id"]

    return {
        "poll": poll,
        "options": serialized_options,
        "total_votes": total_votes,
        "has_voted": has_voted,
        "selected_option_id": selected_option_id,
        "is_open": poll["status"] == "voting",
    }


def _load_current_poll(visitor_id: Optional[str]) -> Dict[str, Any]:
    supabase.rpc("close_due_polls").execute()
    now = datetime.now(timezone.utc).isoformat()

    active_response = (
        supabase.table("polls")
        .select("*, winning_movie:movies!polls_winning_movie_id_fkey(*)")
        .eq("status", "voting")
        .lte("voting_starts_at", now)
        .gt("voting_ends_at", now)
        .order("voting_ends_at")
        .limit(1)
        .execute()
    )
    if active_response.data:
        return _serialize_poll(active_response.data[0], visitor_id)

    latest_response = (
        supabase.table("polls")
        .select("*, winning_movie:movies!polls_winning_movie_id_fkey(*)")
        .in_("status", ["closed", "overridden"])
        .order("week_start", desc=True)
        .limit(1)
        .execute()
    )
    if latest_response.data:
        return _serialize_poll(latest_response.data[0], visitor_id)

    return {
        "poll": None,
        "options": [],
        "total_votes": 0,
        "has_voted": False,
        "selected_option_id": None,
        "is_open": False,
    }


@router.get("/current")
@router.get("/active")
def get_current_poll(visitor_id: Optional[str] = Query(default=None, min_length=16, max_length=128)):
    try:
        return _load_current_poll(visitor_id)
    except APIError as exc:
        raise HTTPException(status_code=502, detail="Unable to load the movie poll.") from exc


@router.post("/vote")
def cast_poll_vote(payload: VotePayload):
    try:
        option_response = (
            supabase.table("poll_options")
            .select("poll_id")
            .eq("id", payload.poll_option_id)
            .limit(1)
            .execute()
        )
        if not option_response.data:
            raise HTTPException(status_code=404, detail="Poll option not found.")

        poll_id = option_response.data[0]["poll_id"]
        supabase.rpc(
            "cast_poll_vote",
            {
                "p_option_id": payload.poll_option_id,
                "p_fingerprint_hash": _fingerprint_hash(poll_id, payload.visitor_id),
            },
        ).execute()
        return _load_current_poll(payload.visitor_id)
    except HTTPException:
        raise
    except APIError as exc:
        message = str(getattr(exc, "message", "") or exc)
        status = 409 if "already voted" in message.lower() or "closed" in message.lower() else 502
        raise HTTPException(status_code=status, detail=message if status == 409 else "Unable to record vote.") from exc


@router.post("/{poll_id}/override")
def override_winner(
    poll_id: str,
    payload: OverridePayload,
    _: dict = Depends(get_current_admin),
):
    try:
        supabase.rpc(
            "override_poll_winner",
            {"p_poll_id": poll_id, "p_movie_id": payload.movie_id},
        ).execute()
        return {"status": "success", "poll_id": poll_id, "movie_id": payload.movie_id}
    except APIError as exc:
        raise HTTPException(status_code=409, detail=str(getattr(exc, "message", "") or exc)) from exc
