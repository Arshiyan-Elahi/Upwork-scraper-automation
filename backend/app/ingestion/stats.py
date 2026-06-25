"""Persist and read webhook ingestion statistics for GET /ingest/status."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import IngestionRun, Job


def record_webhook_ingestion_run(session: Session, summary: dict[str, Any]) -> None:
    """Append a run record after each Chrome extension webhook ingestion."""
    session.add(
        IngestionRun(
            ran_at=datetime.now(timezone.utc),
            emails_scanned=int(summary.get("received", 0)),
            jobs_added=int(summary.get("added", 0)),
            duplicates_skipped=int(summary.get("duplicates_skipped", 0)),
            parse_failures=len(summary.get("errors") or []),
            jobs_updated=int(summary.get("updated", 0)),
            run_type="webhook",
            gmail_connected=False,
        )
    )
    session.commit()


def get_ingestion_status(session: Session) -> dict[str, Any]:
    """Webhook ingestion status from the database."""
    latest_webhook = (
        session.query(IngestionRun)
        .filter(IngestionRun.run_type == "webhook")
        .order_by(IngestionRun.ran_at.desc())
        .first()
    )

    totals = session.query(
        func.coalesce(func.sum(IngestionRun.duplicates_skipped), 0),
        func.coalesce(func.sum(IngestionRun.parse_failures), 0),
        func.coalesce(func.sum(IngestionRun.jobs_updated), 0),
    ).filter(IngestionRun.run_type == "webhook").one()

    duplicates_skipped, failed_parses, jobs_updated = (
        int(totals[0]),
        int(totals[1]),
        int(totals[2]),
    )

    webhook_jobs_added = int(
        session.query(func.coalesce(func.sum(IngestionRun.jobs_added), 0))
        .filter(IngestionRun.run_type == "webhook")
        .scalar()
        or 0
    )

    return {
        "last_webhook_sync": latest_webhook.ran_at if latest_webhook else None,
        "jobs_extracted": session.query(Job).count(),
        "failed_parses": failed_parses,
        "duplicates_skipped": duplicates_skipped,
        "jobs_updated": jobs_updated,
        "webhook_jobs_added": webhook_jobs_added,
    }
