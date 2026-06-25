"""Ingest jobs pushed from the Upwork Job Scraper Chrome extension."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.ingestion.job_urls import normalize_job_url
from app.ingestion.stats import record_webhook_ingestion_run
from app.ingestion.webhook_mapper import map_webhook_job
from app.intelligence.job_fit import auto_score_new_jobs
from app.models import Job

logger = logging.getLogger(__name__)


def _find_existing_job(session: Session, job_data: dict[str, Any]) -> Job | None:
    url = job_data.get("job_url")
    if url:
        normalized = normalize_job_url(url)
        exact = session.query(Job).filter(Job.job_url == url).first()
        if exact is not None:
            return exact

        for row in session.query(Job).filter(Job.job_url.isnot(None)).all():
            if row.job_url and normalize_job_url(row.job_url) == normalized:
                return row

    external_id = job_data.get("external_id")
    if external_id:
        match = session.query(Job).filter(Job.external_id == external_id).first()
        if match is not None:
            return match

    title = job_data.get("title") or ""
    budget = job_data.get("budget")
    if title:
        return (
            session.query(Job)
            .filter(Job.title == title, Job.budget == budget)
            .first()
        )

    return None


def _enrich_existing(existing: Job, incoming: dict[str, Any]) -> bool:
    """Merge extension fields into an existing job. Prefer longer descriptions."""
    changed = False

    new_desc = incoming.get("description")
    if new_desc and (not existing.description or len(new_desc) > len(existing.description)):
        existing.description = new_desc
        changed = True

    if incoming.get("job_url") and not existing.job_url:
        existing.job_url = incoming["job_url"]
        changed = True

    if incoming.get("external_id") and not existing.external_id:
        existing.external_id = incoming["external_id"]
        changed = True

    for field in (
        "budget",
        "budget_type",
        "client_rating",
        "client_spend",
        "client_country",
        "payment_verified",
        "posted_date",
    ):
        value = incoming.get(field)
        if value is None:
            continue
        if getattr(existing, field) in (None, "", "unknown") and value not in ("", "unknown"):
            setattr(existing, field, value)
            changed = True

    incoming_skills = incoming.get("skills") or []
    if incoming_skills and len(incoming_skills) > len(existing.skills or []):
        existing.skills = incoming_skills
        changed = True

    incoming_title = incoming.get("title")
    if incoming_title and incoming_title != "Untitled job" and existing.title == "Untitled job":
        existing.title = incoming_title
        changed = True

    return changed


def run_webhook_ingestion(session: Session, payload: dict[str, Any]) -> dict[str, Any]:
    """
    Process a Chrome extension webhook payload.

    Returns: received, added, updated, duplicates_skipped, errors
    """
    summary: dict[str, Any] = {
        "received": 0,
        "added": 0,
        "updated": 0,
        "duplicates_skipped": 0,
        "errors": [],
    }

    status = str(payload.get("status", "")).strip().lower()
    if status != "success":
        target = payload.get("targetName") or "unknown"
        logger.info("Webhook ignored — status=%s target=%s", status, target)
        record_webhook_ingestion_run(session, summary)
        return summary

    jobs = payload.get("jobs") or []
    if not isinstance(jobs, list):
        summary["errors"].append("jobs must be a list")
        record_webhook_ingestion_run(session, summary)
        return summary

    summary["received"] = len(jobs)
    seen_urls: set[str] = set()
    seen_title_budget: set[tuple[str, str | None]] = set()
    added_jobs: list[Job] = []

    for index, raw in enumerate(jobs):
        if not isinstance(raw, dict):
            summary["errors"].append(f"jobs[{index}]: expected an object")
            continue

        try:
            job_data = map_webhook_job(raw)
        except Exception as exc:
            logger.exception("Failed to map webhook job at index %s", index)
            summary["errors"].append(f"jobs[{index}]: {exc}")
            continue

        url = job_data.get("job_url")
        if url:
            normalized = normalize_job_url(url)
            if normalized in seen_urls:
                summary["duplicates_skipped"] += 1
                continue
            seen_urls.add(normalized)

        title_budget_key = (job_data.get("title") or "", job_data.get("budget"))
        if not url and title_budget_key in seen_title_budget:
            summary["duplicates_skipped"] += 1
            continue
        if not url:
            seen_title_budget.add(title_budget_key)

        existing = _find_existing_job(session, job_data)
        if existing is not None:
            if _enrich_existing(existing, job_data):
                summary["updated"] += 1
            else:
                summary["duplicates_skipped"] += 1
            continue

        new_job = Job(**job_data)
        session.add(new_job)
        added_jobs.append(new_job)
        summary["added"] += 1

    try:
        session.commit()
    except Exception as exc:
        session.rollback()
        logger.exception("Webhook ingestion commit failed")
        summary["errors"].append(str(exc))
        summary["added"] = 0
        summary["updated"] = 0
        added_jobs = []

    record_webhook_ingestion_run(session, summary)

    # Best-effort LLM fit scoring for newly ingested jobs. Never blocks ingestion:
    # if there's no active profile / no Gemini key / scoring fails, jobs stay unscored.
    if added_jobs:
        try:
            auto_score_new_jobs(session, added_jobs)
        except Exception:
            logger.exception("Auto fit scoring failed for ingested jobs")

    return summary
