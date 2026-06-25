from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routes import (
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

app.include_router(jobs.router)
app.include_router(proposals.router)
app.include_router(ingest.router)
app.include_router(maintenance.router)
app.include_router(profiles.router)
app.include_router(portfolio.router)
app.include_router(generations.router)
app.include_router(winning_proposals.router)
app.include_router(settings_routes.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
