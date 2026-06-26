"""Gemini-powered portfolio item categorization and tagging suggestions."""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.constants.portfolio_taxonomy import PORTFOLIO_TAXONOMY
from app.llm.router import LLMRouter, get_llm_router
from app.portfolio.utils import normalize_tags

logger = logging.getLogger(__name__)

ANALYZE_SCHEMA_HINT = """{
  "main_category": "string — exactly one allowed main category from the taxonomy",
  "sub_category": "string — exactly one allowed sub-category under that main category",
  "industry_tags": ["string — industry or vertical labels, e.g. SaaS, e-commerce"],
  "skill_tags": ["string — professional skills demonstrated"],
  "style_tags": ["string — visual or creative style descriptors"],
  "tools_tags": ["string — tools, platforms, or technologies used"],
  "best_for_jobs": ["string — short Upwork-style job types this work is best for"],
  "short_summary": "string — 1-2 sentence portfolio blurb for proposals",
  "confidence_score": "integer 0-100 — how confident you are in the categorization"
}"""

ANALYZE_SYSTEM = (
    "You categorize freelance portfolio work for an Upwork proposal system. "
    "Given a project title, URL, and optional description, pick the best main_category "
    "and sub_category ONLY from the provided taxonomy — never invent categories. "
    "Infer reasonable tags from the title, URL path, and description. "
    "Return ONLY valid JSON matching the requested shape."
)


def _empty_result() -> dict[str, Any]:
    return {
        "main_category": "",
        "sub_category": "",
        "industry_tags": [],
        "skill_tags": [],
        "style_tags": [],
        "tools_tags": [],
        "best_for_jobs": [],
        "short_summary": "",
        "confidence_score": 0,
    }


def _match_main_category(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    if text in PORTFOLIO_TAXONOMY:
        return text
    lower = text.lower()
    for key in PORTFOLIO_TAXONOMY:
        if key.lower() == lower:
            return key
    for key in PORTFOLIO_TAXONOMY:
        if lower in key.lower() or key.lower() in lower:
            return key
    return ""


def _match_sub_category(main_category: str, value: Any) -> str:
    if not main_category:
        return ""
    subs = PORTFOLIO_TAXONOMY.get(main_category, [])
    if value is None:
        return subs[0] if subs else ""
    text = str(value).strip()
    if not text:
        return subs[0] if subs else ""
    if text in subs:
        return text
    lower = text.lower()
    for sub in subs:
        if sub.lower() == lower:
            return sub
    for sub in subs:
        if lower in sub.lower() or sub.lower() in lower:
            return sub
    return subs[0] if subs else ""


def _coerce_confidence(value: Any) -> int:
    if value is None:
        return 0
    try:
        score = int(float(value))
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, score))


def _coerce_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _coerce_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return normalize_tags([str(v) for v in value])
    if isinstance(value, str) and value.strip():
        return normalize_tags([part.strip() for part in value.split(",")])
    return []


def normalize_analyze_result(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Map Gemini output to a safe response; snap categories to the fixed taxonomy."""
    source = raw if isinstance(raw, dict) else {}
    main = _match_main_category(source.get("main_category"))
    sub = _match_sub_category(main, source.get("sub_category"))

    return {
        "main_category": main,
        "sub_category": sub,
        "industry_tags": _coerce_str_list(source.get("industry_tags")),
        "skill_tags": _coerce_str_list(source.get("skill_tags")),
        "style_tags": _coerce_str_list(source.get("style_tags")),
        "tools_tags": _coerce_str_list(source.get("tools_tags")),
        "best_for_jobs": _coerce_str_list(source.get("best_for_jobs")),
        "short_summary": _coerce_str(source.get("short_summary")),
        "confidence_score": _coerce_confidence(source.get("confidence_score")),
    }


def analyze_portfolio_item(
    session: Session,
    *,
    user_id: int,
    title: str,
    url: str,
    description: str | None = None,
    source_type: str | None = None,
    router: LLMRouter | None = None,
) -> dict[str, Any]:
    """
    Suggest taxonomy-aligned categories and tags for a portfolio item.

    Never raises — returns an empty/low-confidence result on any failure.
    """
    title = (title or "").strip()
    url = (url or "").strip()
    description = (description or "").strip()

    if not title and not url:
        return _empty_result()

    taxonomy_json = json.dumps(PORTFOLIO_TAXONOMY, indent=2)
    prompt = (
        f"Allowed taxonomy (main_category -> sub_categories):\n{taxonomy_json}\n\n"
        f"Portfolio item to analyze:\n"
        f"Title: {title or 'Untitled'}\n"
        f"URL: {url or 'N/A'}\n"
        f"Source type: {source_type or 'unknown'}\n"
        f"Description: {description or 'No description provided.'}\n"
    )

    llm = router or get_llm_router(session, user_id)
    try:
        raw = llm.analyze(ANALYZE_SYSTEM, prompt, ANALYZE_SCHEMA_HINT)
        return normalize_analyze_result(raw)
    except Exception:
        logger.exception("Portfolio AI analyze failed")
        return _empty_result()
