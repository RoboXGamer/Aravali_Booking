import hashlib
from typing import Any, Dict, Optional

import httpx
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


def _visitor_hash(visitor_id: str) -> str:
    payload = f"{visitor_id}:{settings.SUPABASE_JWT_SECRET}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _rpc_payload(response: Any) -> Dict[str, Any]:
    data = response.data
    if isinstance(data, list):
        data = data[0] if data else None
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="The movie poll returned an invalid response.")
    return data


def _load_current_poll(visitor_id: Optional[str]) -> Dict[str, Any]:
    return _rpc_payload(
        supabase.rpc(
            "get_current_poll_payload",
            {"p_fingerprint_hash": _visitor_hash(visitor_id) if visitor_id else None},
        ).execute()
    )


def _raise_transport_unavailable(exc: httpx.TransportError) -> None:
    raise HTTPException(
        status_code=503,
        detail="The movie poll is temporarily unavailable. Please try again shortly.",
    ) from exc


@router.get("/current")
@router.get("/active")
def get_current_poll(visitor_id: Optional[str] = Query(default=None, min_length=16, max_length=128)):
    try:
        return _load_current_poll(visitor_id)
    except httpx.TransportError as exc:
        _raise_transport_unavailable(exc)
    except APIError as exc:
        raise HTTPException(status_code=502, detail="Unable to load the movie poll.") from exc


@router.post("/vote")
def cast_poll_vote(payload: VotePayload):
    try:
        supabase.rpc(
            "cast_poll_vote",
            {
                "p_option_id": payload.poll_option_id,
                "p_fingerprint_hash": _visitor_hash(payload.visitor_id),
            },
        ).execute()
        return _load_current_poll(payload.visitor_id)
    except HTTPException:
        raise
    except httpx.TransportError as exc:
        _raise_transport_unavailable(exc)
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
    except httpx.TransportError as exc:
        _raise_transport_unavailable(exc)
    except APIError as exc:
        raise HTTPException(status_code=409, detail=str(getattr(exc, "message", "") or exc)) from exc
