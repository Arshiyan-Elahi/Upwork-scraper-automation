from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.ingestion.stats import get_ingestion_status
from app.ingestion.webhook import run_webhook_ingestion
from app.schemas import IngestStatus, WebhookIngestSummary

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.get("/status", response_model=IngestStatus)
def ingest_status(db: Session = Depends(get_db)) -> IngestStatus:
    """Webhook ingestion stats from the database."""
    return get_ingestion_status(db)


@router.post("/webhook", response_model=WebhookIngestSummary)
async def ingest_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_webhook_secret: str | None = Header(None, alias="X-Webhook-Secret"),
) -> WebhookIngestSummary:
    """
    Accept jobs pushed from the Upwork Job Scraper Chrome extension.

    Optional auth: set WEBHOOK_SECRET in .env and send matching X-Webhook-Secret header.
    """
    settings = get_settings()
    if settings.webhook_secret:
        if x_webhook_secret != settings.webhook_secret:
            raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        payload: dict[str, Any] = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Request body must be a JSON object")

    return run_webhook_ingestion(db, payload)
