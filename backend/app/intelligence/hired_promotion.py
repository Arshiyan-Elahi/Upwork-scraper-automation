"""Auto-promote hired jobs with captured proposals to winning examples."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.intelligence.profile import get_active_profile
from app.models import Job
from app.models_intelligence import WinningProposal


def derive_job_niche(job: Job, session: Session) -> str:
    """Pick a niche label from job skills, profile niches, or fall back to 'general'."""
    skills = [str(s).strip() for s in (job.skills or []) if str(s).strip()]
    if skills:
        return skills[0]

    profile_row = get_active_profile(session)
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


def maybe_create_winning_from_hired_job(job: Job, session: Session) -> bool:
    """
    Create a WinningProposal when a job is hired and has captured submission text.

    Returns True if a new row was created. Skips silently when text is missing
    or a winning proposal already exists for this job.
    """
    text = (job.submitted_proposal_text or "").strip()
    if not text:
        return False

    existing = (
        session.query(WinningProposal)
        .filter(WinningProposal.source_job_id == job.id)
        .first()
    )
    if existing is not None:
        return False

    row = WinningProposal(
        job_title=job.title,
        text=text,
        niche=derive_job_niche(job, session),
        outcome="hired",
        revenue=0.0,
        notes=f"auto-added from hired job #{job.id}",
        source_job_id=job.id,
    )
    session.add(row)
    return True
