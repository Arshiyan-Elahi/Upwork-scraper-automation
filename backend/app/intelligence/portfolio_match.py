"""Score portfolio items against a job for proposal link attachment."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from app.constants.portfolio_taxonomy import PORTFOLIO_TAXONOMY
from app.models import Job
from app.models_portfolio import PortfolioItem
from app.portfolio.utils import normalize_tags

# Minimum best score to attach portfolio links (out of 100).
MATCH_THRESHOLD = 30

_STYLE_KEYWORDS = (
    "luxury",
    "minimal",
    "minimalist",
    "modern",
    "bold",
    "corporate",
    "playful",
    "elegant",
    "vintage",
    "clean",
    "professional",
    "premium",
    "classic",
    "contemporary",
)

_INDUSTRY_KEYWORDS = (
    "hotel",
    "hospitality",
    "luxury",
    "saas",
    "ecommerce",
    "e-commerce",
    "healthcare",
    "fintech",
    "restaurant",
    "retail",
    "startup",
    "real estate",
    "fitness",
    "beauty",
    "fashion",
    "travel",
    "education",
    "nonprofit",
    "automotive",
    "food",
    "beverage",
)


def _tokenize(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 2}


def _match_main_category(text: str) -> str:
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


def _match_sub_category(main_category: str, text: str) -> str:
    if not main_category:
        return ""
    subs = PORTFOLIO_TAXONOMY.get(main_category, [])
    if not text:
        return ""
    if text in subs:
        return text
    lower = text.lower()
    for sub in subs:
        if sub.lower() == lower:
            return sub
    for sub in subs:
        if lower in sub.lower() or sub.lower() in lower:
            return sub
    return ""


def _infer_category_from_text(text_lower: str) -> tuple[str, str]:
    """Pick main/sub category by scanning taxonomy labels in job text."""
    best_main = ""
    best_sub = ""
    best_len = 0
    for main, subs in PORTFOLIO_TAXONOMY.items():
        for sub in subs:
            sub_lower = sub.lower()
            if sub_lower in text_lower and len(sub_lower) > best_len:
                best_main = main
                best_sub = sub
                best_len = len(sub_lower)
    if best_main:
        return best_main, best_sub
    for main in PORTFOLIO_TAXONOMY:
        main_lower = main.lower()
        if main_lower in text_lower:
            return main, ""
    return "", ""


def _extract_keywords(text: str, vocabulary: tuple[str, ...]) -> list[str]:
    lower = text.lower()
    found: list[str] = []
    for word in vocabulary:
        if word in lower and word not in {f.lower() for f in found}:
            found.append(word.title() if word.isalpha() else word)
    return normalize_tags(found)


def derive_job_attributes(job: Job, requirements: dict[str, Any]) -> dict[str, Any]:
    """
    Derive match facets from extract_requirements output and job fields.

    Reuses requirements skills/deliverables/summary; infers categories from taxonomy.
    """
    skills = normalize_tags(
        list(requirements.get("skills") or [])
        + list(job.skills or [])
    )
    deliverables = [str(d) for d in (requirements.get("deliverables") or [])]
    summary = str(requirements.get("summary") or "")
    tone = str(requirements.get("tone") or "")
    blob = " ".join(
        [
            job.title or "",
            summary,
            " ".join(deliverables),
            " ".join(skills),
            job.description or "",
            tone,
        ]
    )
    blob_lower = blob.lower()

    job_main, job_sub = _infer_category_from_text(blob_lower)
    if not job_main:
        job_main = _match_main_category(job.title or "")
    if job_main and not job_sub:
        job_sub = _match_sub_category(job_main, job.title or "") or _match_sub_category(
            job_main, " ".join(deliverables)
        )

    industry = _extract_keywords(blob, _INDUSTRY_KEYWORDS)
    style = _extract_keywords(blob, _STYLE_KEYWORDS)
    if tone:
        style = normalize_tags(style + [tone])

    return {
        "job_main_category": job_main,
        "job_sub_category": job_sub,
        "required_skills": skills,
        "industry": industry,
        "style": style,
        "keywords": sorted(_tokenize(blob)),
    }


def _tag_overlap_score(
    job_tags: set[str],
    item_tags: list[str],
    max_points: float,
) -> tuple[float, list[str]]:
    if not job_tags or not item_tags:
        return 0.0, []
    matched: list[str] = []
    item_lower = [t.lower() for t in item_tags]
    for jt in job_tags:
        for idx, it in enumerate(item_lower):
            if jt == it or jt in it or it in jt:
                matched.append(item_tags[idx])
                break
    if not matched:
        return 0.0, []
    ratio = len(matched) / max(len(job_tags), 1)
    return round(max_points * min(1.0, ratio), 1), matched


def _score_portfolio_item(
    item: PortfolioItem,
    job_attrs: dict[str, Any],
    max_priority: int,
) -> tuple[float, str, list[str]]:
    score = 0.0
    reasons: list[str] = []
    matched_tags: list[str] = []

    job_main = job_attrs.get("job_main_category") or ""
    job_sub = job_attrs.get("job_sub_category") or ""

    if job_main and item.main_category and item.main_category == job_main:
        score += 25
        reasons.append(f"main category ({job_main})")
    if job_sub and item.sub_category and item.sub_category == job_sub:
        score += 25
        reasons.append(f"sub-category ({job_sub})")

    skill_set = _tokenize(" ".join(job_attrs.get("required_skills") or []))
    skill_pts, skill_matched = _tag_overlap_score(
        skill_set, item.skill_tags or [], 20
    )
    score += skill_pts
    if skill_matched:
        reasons.append(f"skills ({', '.join(skill_matched[:3])})")
        matched_tags.extend(skill_matched)

    industry_set = set(t.lower() for t in (job_attrs.get("industry") or []))
    industry_pts, industry_matched = _tag_overlap_score(
        industry_set, item.industry_tags or [], 15
    )
    score += industry_pts
    if industry_matched:
        reasons.append(f"industry ({', '.join(industry_matched[:3])})")
        matched_tags.extend(industry_matched)

    style_set = set(t.lower() for t in (job_attrs.get("style") or []))
    style_pts, style_matched = _tag_overlap_score(
        style_set, item.style_tags or [], 10
    )
    score += style_pts
    if style_matched:
        reasons.append(f"style ({', '.join(style_matched[:3])})")
        matched_tags.extend(style_matched)

    if max_priority > 0 and (item.priority_score or 0) > 0:
        score += round(5 * ((item.priority_score or 0) / max_priority), 1)

    reason = "; ".join(reasons) if reasons else "general relevance"
    return score, reason, normalize_tags(matched_tags)


def match_portfolio(
    session: Session,
    job: Job,
    profile_id: int,
    requirements: dict[str, Any],
    *,
    limit: int = 3,
    min_score: int = MATCH_THRESHOLD,
) -> list[dict[str, Any]]:
    """
    Score active portfolio items for a profile against a job.

    Returns top 1-3 matches above min_score, or empty list if none qualify.
    """
    items = (
        session.query(PortfolioItem)
        .filter(
            PortfolioItem.profile_id == profile_id,
            PortfolioItem.is_active.is_(True),
        )
        .all()
    )
    if not items:
        return []

    job_attrs = derive_job_attributes(job, requirements)
    max_priority = max((i.priority_score or 0 for i in items), default=0)

    scored: list[tuple[float, PortfolioItem, str, list[str]]] = []
    for item in items:
        pts, reason, matched_tags = _score_portfolio_item(item, job_attrs, max_priority)
        if pts > 0:
            scored.append((pts, item, reason, matched_tags))

    scored.sort(key=lambda row: (-row[0], -(row[1].priority_score or 0)))
    if not scored or scored[0][0] < min_score:
        return []

    results: list[dict[str, Any]] = []
    for pts, item, reason, matched_tags in scored[:limit]:
        results.append(
            {
                "portfolio_item_id": item.id,
                "title": item.title,
                "url": item.url,
                "match_score": int(round(min(100, pts))),
                "reason": reason,
                "matched_tags": matched_tags,
            }
        )
    return results
