"""
LLM-based job fit scoring.

Separate, job-level signal (shown in the UI) that evaluates how well a job fits
the ACTIVE freelancer profile using Gemini structured JSON. This is independent of
the rule-based `match_profile` used inside the proposal pipeline.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session

from app.intelligence.profile import get_active_profile, normalize_extracted
from app.llm.router import LLMRouter, get_llm_router
from app.models import Job

if TYPE_CHECKING:
    from app.models_profile import Profile

logger = logging.getLogger(__name__)

VALID_RECOMMENDATIONS = ("apply", "maybe", "skip")

FIT_SCHEMA_HINT = """{
  "fit_score": 0-100,
  "recommendation": "apply | maybe | skip",
  "reasons": ["short bullet string — why this job fits the freelancer"],
  "concerns": ["short string — risks, mismatches, or red flags"],
  "suggested_angle": "one line on how to pitch if applying"
}"""

FIT_SYSTEM = (
    "You evaluate how well a freelance job posting fits a specific freelancer's profile. "
    "Consider the full job description, required skills, budget, and client signals against the "
    "freelancer's niches, skills, services, best-fit job types, and job types they avoid.\n"
    "Scoring guide (fit_score 0-100):\n"
    " - 80-100: strong alignment with the freelancer's niche/skills and no serious red flag.\n"
    " - 50-79: partial alignment or some uncertainty.\n"
    " - 0-49: weak alignment or a serious red flag (e.g. matches an 'avoid' type, unrealistic budget).\n"
    "Derive 'recommendation' consistently from the score and concerns:\n"
    " - 'apply' for a high fit_score with no major concern.\n"
    " - 'maybe' for a mid fit_score, or a high score with a notable concern.\n"
    " - 'skip' for a low fit_score or any serious red flag (even if the score is otherwise decent).\n"
    "Keep reasons and concerns short. Return ONLY valid JSON matching the requested shape."
)


def _job_fit_context(job: Job) -> str:
    skills = ", ".join(job.skills or []) or "none listed"
    return (
        f"Title: {job.title}\n"
        f"Budget: {job.budget or 'unknown'} ({job.budget_type or 'unknown'})\n"
        f"Skills: {skills}\n"
        f"Client rating: {job.client_rating if job.client_rating is not None else 'unknown'}\n"
        f"Client total spend: {job.client_spend or 'unknown'}\n"
        f"Client country: {job.client_country or 'unknown'}\n"
        f"Payment verified: {job.payment_verified if job.payment_verified is not None else 'unknown'}\n"
        f"Full description:\n{job.description or 'No description available.'}\n"
    )


def _profile_fit_context(profile: dict[str, Any]) -> str:
    normalized = normalize_extracted(profile)

    def _join(field: str) -> str:
        return ", ".join(normalized.get(field) or []) or "none specified"

    return (
        f"Niches: {_join('niches')}\n"
        f"Skills: {_join('skills')}\n"
        f"Services: {_join('services')}\n"
        f"Strengths: {_join('strengths')}\n"
        f"Best-fit job types: {_join('best_fit_job_types')}\n"
        f"Job types to AVOID: {_join('avoid_job_types')}\n"
        f"Ideal clients: {normalized.get('ideal_clients') or 'not specified'}\n"
    )


def _coerce_str_list(value: Any, *, limit: int = 6) -> list[str]:
    if not isinstance(value, list):
        if isinstance(value, str) and value.strip():
            return [value.strip()]
        return []
    items = [str(item).strip() for item in value if str(item).strip()]
    return items[:limit]


def _derive_recommendation(score: int, concerns: list[str], raw_recommendation: str) -> str:
    """
    Keep the recommendation within consistent bounds derived from score + concerns,
    while letting the LLM choose inside those bounds.
    """
    rec = (raw_recommendation or "").strip().lower()
    if rec not in VALID_RECOMMENDATIONS:
        rec = ""

    has_concerns = len(concerns) > 0

    if score >= 75:
        allowed = {"apply", "maybe"} if has_concerns else {"apply", "maybe", "skip"}
        return rec if rec in allowed else ("maybe" if has_concerns else "apply")
    if score >= 45:
        allowed = {"maybe", "skip"} if has_concerns else {"apply", "maybe", "skip"}
        return rec if rec in allowed else "maybe"
    # Low fit — never recommend a confident apply.
    allowed = {"maybe", "skip"}
    return rec if rec in allowed else "skip"


def score_job_fit(
    job: Job,
    profile: dict[str, Any],
    *,
    router: LLMRouter,
) -> dict[str, Any]:
    """
    [Gemini] Evaluate how well a job fits the given profile.

    Returns a normalized dict:
      { fit_score, recommendation, reasons, concerns, suggested_angle }

    Raises on total LLM failure so callers can degrade per-job in batches.
    """
    prompt = (
        "Evaluate how well this job fits the freelancer below.\n\n"
        f"JOB:\n{_job_fit_context(job)}\n\n"
        f"FREELANCER PROFILE:\n{_profile_fit_context(profile)}\n\n"
        "Score the fit and recommend whether to apply, maybe, or skip."
    )

    raw = router.analyze(FIT_SYSTEM, prompt, FIT_SCHEMA_HINT)

    try:
        score = int(round(float(raw.get("fit_score", 0))))
    except (TypeError, ValueError):
        score = 0
    score = max(0, min(100, score))

    reasons = _coerce_str_list(raw.get("reasons"))
    concerns = _coerce_str_list(raw.get("concerns"))
    recommendation = _derive_recommendation(
        score, concerns, str(raw.get("recommendation", ""))
    )
    suggested_angle = str(raw.get("suggested_angle") or "").strip()

    return {
        "fit_score": score,
        "recommendation": recommendation,
        "reasons": reasons,
        "concerns": concerns,
        "suggested_angle": suggested_angle,
    }


def _apply_fit_to_job(job: Job, fit: dict[str, Any]) -> None:
    job.fit_score = fit["fit_score"]
    job.fit_recommendation = fit["recommendation"]
    job.fit_reasons = fit["reasons"]
    job.fit_concerns = fit["concerns"]
    job.fit_angle = fit["suggested_angle"]
    job.fit_scored_at = datetime.now(timezone.utc)


def score_and_save_job_fit(
    session: Session,
    job: Job,
    profile: dict[str, Any],
    *,
    router: LLMRouter | None = None,
    commit: bool = True,
) -> dict[str, Any]:
    """Score a single job, persist the fit fields, and return the fit dict."""
    llm = router or get_llm_router(session)
    fit = score_job_fit(job, profile, router=llm)
    _apply_fit_to_job(job, fit)
    if commit:
        session.commit()
        session.refresh(job)
    return fit


def score_fit_for_jobs(
    session: Session,
    jobs: list[Job],
    profile: dict[str, Any],
    *,
    router: LLMRouter | None = None,
    pause_seconds: float = 0.4,
) -> dict[str, Any]:
    """
    Score a batch of jobs sequentially, degrading gracefully per job.

    One failure does not stop the batch. Runs sequentially with a small pause to
    respect Gemini rate limits. Commits once at the end.
    """
    llm = router or get_llm_router(session)
    scored = 0
    failed = 0
    errors: list[str] = []

    for index, job in enumerate(jobs):
        try:
            fit = score_job_fit(job, profile, router=llm)
            _apply_fit_to_job(job, fit)
            scored += 1
        except Exception as exc:  # noqa: BLE001 — degrade per job
            failed += 1
            logger.exception("Job fit scoring failed for job_id=%s", job.id)
            errors.append(f"job {job.id}: {exc}")
        # Gentle pacing between calls so we don't blast the rate limit.
        if pause_seconds and index < len(jobs) - 1:
            time.sleep(pause_seconds)

    if scored:
        try:
            session.commit()
        except Exception as exc:  # noqa: BLE001
            session.rollback()
            logger.exception("Batch fit commit failed")
            errors.append(f"commit failed: {exc}")
            scored = 0
            failed = len(jobs)

    return {"scored": scored, "failed": failed, "errors": errors}


def auto_score_new_jobs(session: Session, jobs: list[Job]) -> None:
    """
    Best-effort fit scoring for freshly ingested jobs.

    Never raises: if there is no active profile, no Gemini key, or scoring fails,
    the jobs simply remain unscored. Runs sequentially to respect rate limits.
    """
    if not jobs:
        return

    try:
        profile_row: Profile | None = get_active_profile(session)
    except Exception:
        logger.exception("auto_score_new_jobs: failed to load active profile")
        return

    if profile_row is None:
        logger.info("auto_score_new_jobs: no active profile — skipping fit scoring")
        return

    profile = normalize_extracted(profile_row.extracted)

    try:
        result = score_fit_for_jobs(session, jobs, profile)
        logger.info(
            "auto_score_new_jobs: scored=%s failed=%s",
            result["scored"],
            result["failed"],
        )
    except Exception:
        logger.exception("auto_score_new_jobs: batch scoring failed")
