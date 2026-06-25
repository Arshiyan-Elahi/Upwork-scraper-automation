"""One-off cleanup for stale email-sourced jobs (manual run only)."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from app.models import Job

_TRUNCATED_RE = re.compile(r"(?:…|\.\.\.)?\s*more\s*$", re.IGNORECASE)


def is_stale_email_job(job: Job) -> bool:
    """
    True when source='email' and the job was not enriched by the Chrome extension.

    Enriched jobs typically have longer descriptions without the email "...more" suffix.
    """
    if job.source != "email":
        return False

    desc = (job.description or "").strip()
    if len(desc) >= 400:
        return False
    if _TRUNCATED_RE.search(desc):
        return True
    if len(desc) < 180:
        return True
    return False


def cleanup_stale_email_jobs(session: Session, *, dry_run: bool = False) -> dict[str, Any]:
    email_jobs = session.query(Job).filter(Job.source == "email").all()
    stale = [job for job in email_jobs if is_stale_email_job(job)]
    kept = len(email_jobs) - len(stale)

    if not dry_run and stale:
        for job in stale:
            session.delete(job)
        session.commit()

    return {
        "deleted": len(stale),
        "kept": kept,
        "dry_run": dry_run,
    }
