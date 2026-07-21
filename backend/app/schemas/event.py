from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, time, datetime

class TicketCategoryBase(BaseModel):
    name: str
    price: float
    total_seats: int

class TicketCategoryCreate(TicketCategoryBase):
    pass

class TicketCategoryResponse(TicketCategoryBase):
    id: str
    event_id: str
    available_seats: int

    class Config:
        from_attributes = True

class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    date: date
    time: time
    venue: str = "Aravalli Auditorium Main Hall"
    poster_url: Optional[str] = None
    status: str = "active"

class EventCreate(EventBase):
    categories: List[TicketCategoryCreate]

class EventResponse(EventBase):
    id: str
    created_at: datetime
    categories: List[TicketCategoryResponse] = []

    class Config:
        from_attributes = True
