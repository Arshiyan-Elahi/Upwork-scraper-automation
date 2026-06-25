"""Map Chrome extension webhook payloads to Job model-ready dicts."""

from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

from app.ingestion.normalizer import normalize_extension_job
from app.ingestion.job_urls import extract_external_id, normalize_job_url


def _first_value(data: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key not in data:
            continue
        value = data[key]
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _nested_client(data: dict[str, Any]) -> dict[str, Any]:
    client = data.get("client")
    if isinstance(client, dict):
        return client
    return {}


def _parse_skills(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item).strip()]
    if isinstance(raw, str):
        return [part.strip() for part in raw.split(",") if part.strip()]
    return []


def _parse_budget_type(raw: Any) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip().lower()
    if not text:
        return None
    if "hour" in text:
        return "hourly"
    if "fixed" in text:
        return "fixed"
    if text in {"hourly", "fixed"}:
        return text
    return None


def _parse_posted_date(raw: Any) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    if isinstance(raw, (int, float)):
        try:
            return datetime.fromtimestamp(raw, tz=timezone.utc)
        except (OSError, ValueError, OverflowError):
            return None
    text = str(raw).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    try:
        parsed = parsedate_to_datetime(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError, IndexError):
        return None


def _parse_rating(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _parse_payment_verified(raw: Any) -> bool | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return raw
    text = str(raw).strip().lower()
    if text in {"true", "1", "yes", "verified"}:
        return True
    if text in {"false", "0", "no", "unverified"}:
        return False
    return None


def map_webhook_job(raw: dict[str, Any]) -> dict[str, Any]:
    """Flexibly map extension job JSON to parsed fields for normalize_extension_job."""
    client = _nested_client(raw)

    title = _first_value(raw, "title", "job_title", "name")
    url = _first_value(raw, "url", "job_url", "link", "job_link")
    if url:
        url = normalize_job_url(str(url))

    description = _first_value(raw, "description", "job_description", "body", "details")
    budget = _first_value(raw, "budget", "budget_amount", "budgetAmount", "price")
    budget_type = _parse_budget_type(
        _first_value(raw, "budget_type", "budgetType", "type", "job_type")
    )
    skills = _parse_skills(_first_value(raw, "skills", "skill_list", "tags"))
    posted_date = _parse_posted_date(
        _first_value(raw, "posted_date", "postedDate", "date", "posted")
    )

    client_rating = _parse_rating(
        _first_value(raw, "client_rating", "rating", "clientRating")
        or _first_value(client, "rating", "client_rating", "clientRating")
    )
    client_spend = _first_value(
        raw, "client_spend", "spend", "clientSpend", "total_spent", "totalSpent"
    ) or _first_value(client, "spend", "client_spend", "total_spent", "totalSpent")
    client_country = _first_value(
        raw, "client_country", "country", "clientCountry", "location"
    ) or _first_value(client, "country", "client_country", "location")
    payment_verified = _parse_payment_verified(
        _first_value(raw, "payment_verified", "paymentVerified", "verified")
        or _first_value(client, "payment_verified", "paymentVerified", "verified")
    )

    parsed = {
        "title": title or "Untitled job",
        "job_url": url,
        "external_id": extract_external_id(str(url) if url else None),
        "description": str(description) if description is not None else None,
        "budget": str(budget).strip() if budget is not None else None,
        "budget_type": budget_type,
        "skills": skills,
        "posted_date": posted_date,
        "client_rating": client_rating,
        "client_spend": str(client_spend).strip() if client_spend is not None else None,
        "client_country": str(client_country).strip() if client_country is not None else None,
        "payment_verified": payment_verified,
    }
    return normalize_extension_job(parsed)
