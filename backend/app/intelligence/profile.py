"""
Freelancer profile extraction from pasted Upwork profile text.

Field-agnostic — works for any niche (dev, design, marketing, etc.).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session

from app.llm.router import LLMRouter, get_llm_router

if TYPE_CHECKING:
    from app.models_profile import Profile

logger = logging.getLogger(__name__)

PROFILE_SCHEMA_HINT = """{
  "niches": ["string — primary market verticals or specializations"],
  "skills": ["string — technical or professional skills"],
  "services": ["string — services offered to clients"],
  "strengths": ["string — competitive strengths or differentiators"],
  "ideal_clients": "string — description of best-fit clients",
  "writing_tone": "string — tone/style of their profile writing",
  "best_fit_job_types": ["string — job types they should pursue"],
  "avoid_job_types": ["string — job types to skip"],
  "headline": "string — professional headline if present",
  "summary": "string — short professional summary"
}"""

PROFILE_SYSTEM = (
    "You extract structured freelancer profile data from pasted Upwork or freelance profile text. "
    "Infer fields from the content only — do not assume a specific industry. "
    "Use empty arrays or empty strings when information is not present. "
    "Return ONLY valid JSON matching the requested shape."
)

_LIST_FIELDS = (
    "niches",
    "skills",
    "services",
    "strengths",
    "best_fit_job_types",
    "avoid_job_types",
)

_STRING_FIELDS = (
    "ideal_clients",
    "writing_tone",
    "headline",
    "summary",
)


def _coerce_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _coerce_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_extracted(data: dict[str, Any] | None) -> dict[str, Any]:
    """Ensure all expected profile fields exist with safe defaults."""
    source = data if isinstance(data, dict) else {}
    normalized: dict[str, Any] = {}
    for field in _LIST_FIELDS:
        normalized[field] = _coerce_list(source.get(field))
    for field in _STRING_FIELDS:
        normalized[field] = _coerce_str(source.get(field))
    return normalized


def extract_profile(
    raw_text: str,
    *,
    session: Session,
    router: LLMRouter | None = None,
) -> dict[str, Any]:
    """
    Turn pasted profile text into structured fields via Gemini analyze().

    Returns normalized dict even when the model omits fields. Never raises on
    partial extraction — only on total LLM failure.
    """
    text = (raw_text or "").strip()
    if not text:
        return normalize_extracted({})

    llm = router or get_llm_router(session)
    prompt = f"Extract profile fields from this freelancer profile text:\n\n{text}"

    try:
        raw = llm.analyze(PROFILE_SYSTEM, prompt, PROFILE_SCHEMA_HINT)
        return normalize_extracted(raw)
    except Exception:
        logger.exception("Profile extraction failed")
        raise


def get_active_profile(session: Session) -> Profile | None:
    from app.models_profile import Profile

    return session.query(Profile).filter(Profile.is_active.is_(True)).first()


def resolve_profile_for_pipeline(session: Session, profile_id: int | None = None) -> Profile:
    from app.models_profile import Profile

    if profile_id is not None:
        row = session.query(Profile).filter(Profile.id == profile_id).first()
        if row is None:
            raise ValueError(f"Profile {profile_id} not found.")
        return row

    row = get_active_profile(session)
    if row is None:
        raise ValueError("No active profile configured. Create a profile and set it active.")
    return row
