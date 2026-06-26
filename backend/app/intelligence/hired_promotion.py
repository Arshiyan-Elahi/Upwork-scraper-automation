"""Auto-promote hired jobs with captured proposals to winning examples."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.intelligence.profile import get_active_profile
from app.models import Job
from app.models_intelligence import WinningProposal
from app.models_user_state import UserJobState


def derive_job_niche(job: Job, session: Session, user_id: int) -> str:
    """Pick a niche label from job skills, profile niches, or fall back to 'general'."""
    skills = [str(s).strip() for s in (job.skills or []) if str(s).strip()]
    if skills:
        return skills[0]

    profile_row = get_active_profile(session, user_id)
    if profile_row and profile_row.extracted:
        title_lower = (job.title or "").lower()
        for niche in profile_row.extracted.get("niches") or []:
            niche_str = str(niche).strip()
            if not niche_str:
                continue
            niche_lower = niche_str.lower()
            if niche_lower in title_lower:
                return niche_str
            if any(len(token) > 3 and token in title_lower for token in niche_lower.split()):
                return niche_str

    return "general"


def maybe_create_winning_from_hired_job(
    job: Job, session: Session, *, user_id: int, state: UserJobState
) -> bool:
    """
    Create a WinningProposal for THIS user when their job is hired and has
    captured submission text.

    Returns True if a new row was created. Skips silently when text is missing
    or this user already has a winning proposal for this job.
    """
    text = (state.submitted_proposal_text or "").strip()
    if not text:
        return False

    existing = (
        session.query(WinningProposal)
        .filter(
            WinningProposal.user_id == user_id,
            WinningProposal.source_job_id == job.id,
        )
        .first()
    )
    if existing is not None:
        return False

    row = WinningProposal(
        user_id=user_id,
        job_title=job.title,
        text=text,
        niche=derive_job_niche(job, session, user_id),
        outcome="hired",
        revenue=0.0,
        notes=f"auto-added from hired job #{job.id}",
        source_job_id=job.id,
    )
    session.add(row)
    return True
