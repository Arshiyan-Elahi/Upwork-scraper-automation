from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routes import (
    auth,
    generations,
    ingest,
    jobs,
    maintenance,
    portfolio,
    profiles,
    proposals,
    settings as settings_routes,
    winning_proposals,
)
from app.security.auth import get_current_user

config = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Upwork-AI-intelligence API",
    description="Backend for job ingestion and intelligence.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origin_list,
    allow_origin_regex=r"^chrome-extension://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes (no auth): authentication, the extension webhook, and health.
app.include_router(auth.router)
app.include_router(ingest.router)

# Protected routes (require a valid login token). The DATA stays shared for now —
# per-user isolation is the next step; this just gates the portal behind auth.
_auth_required = [Depends(get_current_user)]
app.include_router(jobs.router, dependencies=_auth_required)
app.include_router(proposals.router, dependencies=_auth_required)
app.include_router(maintenance.router, dependencies=_auth_required)
app.include_router(profiles.router, dependencies=_auth_required)
app.include_router(portfolio.router, dependencies=_auth_required)
app.include_router(generations.router, dependencies=_auth_required)
app.include_router(winning_proposals.router, dependencies=_auth_required)
app.include_router(settings_routes.router, dependencies=_auth_required)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
