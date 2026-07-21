from typing import Optional

from pydantic import BaseModel


class ShowResponse(BaseModel):
    id: str
    movie_id: str
    title: str
    description: Optional[str] = None
    date: str
    time: str
    venue: str
    poster_url: Optional[str] = None
    trailer_url: Optional[str] = None
    duration_minutes: int
    genre: str
    certificate: str
    language: str
    cast_members: Optional[str] = None
    director: Optional[str] = None
    release_year: int
    status: str
