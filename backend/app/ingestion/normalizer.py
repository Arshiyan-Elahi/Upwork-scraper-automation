"""Map parsed job fields to Job model-ready dicts."""

from __future__ import annotations

from typing import Any


def normalize_extension_job(parsed: dict[str, Any]) -> dict[str, Any]:
    """Produce a dict ready for Job(**fields) from Chrome extension webhook data."""
    skills = parsed.get("skills")
    if skills is None:
        skills = []
    elif not isinstance(skills, list):
        skills = [str(skills)]

    return {
        "external_id": parsed.get("external_id"),
        "title": parsed.get("title") or "Untitled job",
        "description": parsed.get("description"),
        "budget": parsed.get("budget"),
        "budget_type": parsed.get("budget_type") or "unknown",
        "skills": skills,
        "job_url": parsed.get("job_url"),
        "posted_date": parsed.get("posted_date"),
        "source": "extension",
        "raw_email_id": None,
        "client_rating": parsed.get("client_rating"),
        "client_spend": parsed.get("client_spend"),
        "client_country": parsed.get("client_country"),
        "payment_verified": parsed.get("payment_verified"),
    }
