import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Dynamically add the project root to sys.path so 'app' imports resolve correctly on Windows
sys.path.append(str(Path(__file__).resolve().parent.parent))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings
from app.models.database import supabase
from app.routers import events, bookings, admin, polls


async def cleanup_expired_holds() -> None:
    while True:
        try:
            await asyncio.to_thread(
                lambda: supabase.rpc("cleanup_expired_checkout_sessions").execute()
            )
            await asyncio.to_thread(
                lambda: supabase.rpc("close_due_polls").execute()
            )
        except Exception:
            # A failed cleanup cycle must not stop the API. Availability and
            # checkout creation also invoke the same cleanup defensively.
            pass
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(_: FastAPI):
    cleanup_task = asyncio.create_task(cleanup_expired_holds())
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass

fastapi_app = FastAPI(
    title="Aravalli Auditorium Ticketing System",
    description="Custom microservice handling secure routing, signatures mapping, and pdf streams compilation.",
    version="2.0.0",
    redirect_slashes=False,
    lifespan=lifespan,
)

fastapi_app.include_router(events.router)
fastapi_app.include_router(bookings.router)
fastapi_app.include_router(admin.router)
fastapi_app.include_router(polls.router)

@fastapi_app.get("/")
def read_root():
    return {"status": "healthy", "service": "Aravalli Core API"}

# Wrap the complete application so even unexpected 500 responses receive CORS
# headers. Otherwise browsers hide the useful server error behind a CORS error.
app = CORSMiddleware(
    app=fastapi_app,
    allow_origins=settings.allowed_frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    # Use 'app.main:app' as the import string so uvicorn resolves paths cleanly from the root directory
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.RELOAD)
