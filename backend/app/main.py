import sys
from pathlib import Path

# Dynamically add the project root to sys.path so 'app' imports resolve correctly on Windows
sys.path.append(str(Path(__file__).resolve().parent.parent))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings
from app.routers import events, bookings, admin, polls

app = FastAPI(
    title="Aravalli Auditorium Ticketing System",
    description="Custom microservice handling secure routing, signatures mapping, and pdf streams compilation.",
    version="2.0.0",
    redirect_slashes=False
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(bookings.router)
app.include_router(admin.router)
app.include_router(polls.router)

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Aravalli Core API"}

if __name__ == "__main__":
    # Use 'app.main:app' as the import string so uvicorn resolves paths cleanly from the root directory
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
