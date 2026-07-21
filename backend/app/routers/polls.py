from datetime import datetime, date
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.database import supabase

router = APIRouter(prefix="/api/polls", tags=["Movie Polls"])

class VotePayload(BaseModel):
    poll_option_id: str
    fingerprint: str

@router.get("/active")
def get_active_poll():
    poll_query = supabase.table("polls").select("*").filter("voting_ends_at", "gt", datetime.utcnow().isoformat()).eq("status", "voting").execute()
    if not poll_query.data:
        return {"poll": None, "options": []}
    
    poll = poll_query.data[0]
    options_query = supabase.table("poll_options").select("*, movies(*)").eq("poll_id", poll["id"]).execute()
    
    return {
        "poll": poll,
        "options": options_query.data or []
    }

@router.post("/vote")
def cast_poll_vote(payload: VotePayload):
    option_query = supabase.table("poll_options").select("poll_id").eq("id", payload.poll_option_id).execute()
    if not option_query.data:
        raise HTTPException(status_code=404, detail="Selected option was not found.")
    
    poll_id = option_query.data[0]["poll_id"]

    options_in_poll = supabase.table("poll_options").select("id").eq("poll_id", poll_id).execute()
    option_ids = [opt["id"] for opt in (options_in_poll.data or [])]

    voted_query = supabase.table("poll_votes").select("id").in_("poll_option_id", option_ids).eq("fingerprint", payload.fingerprint).execute()
    if voted_query.data:
        raise HTTPException(status_code=400, detail="You have already voted on this poll.")

    vote_insert = supabase.table("poll_votes").insert({
        "poll_option_id": payload.poll_option_id,
        "fingerprint": payload.fingerprint
    }).execute()

    if not vote_insert.data:
        raise HTTPException(status_code=500, detail="Failed to record vote.")

    supabase.rpc("increment_vote", {"option_uuid": payload.poll_option_id}).execute()
    return {"status": "success", "detail": "Vote recorded successfully."}
