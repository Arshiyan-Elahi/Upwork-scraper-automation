"""Helpers for per-user job state and building the (shared job + user state) view.

The API still returns the ``JobRead`` shape the frontend expects, but the
per-user fields (stage, outcome, submitted proposal, fit_*) are sourced from the
current user's ``UserJobState`` rather than the shared ``Job``.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Job
from app.models_user_state import UserJobState
from app.schemas import JobRead


def get_state(session: Session, user_id: int, job_id: int) -> UserJobState | None:
    return (
        session.query(UserJobState)
        .filter(UserJobState.user_id == user_id, UserJobState.job_id == job_id)
        .first()
    )


def get_or_create_state(session: Session, user_id: int, job_id: int) -> UserJobState:
    state = get_state(session, user_id, job_id)
    if state is None:
        state = UserJobState(user_id=user_id, job_id=job_id, stage="found")
        session.add(state)
        session.flush()
    return state


def states_by_job_id(session: Session, user_id: int, job_ids: list[int]) -> dict[int, UserJobState]:
    if not job_ids:
        return {}
    rows = (
        session.query(UserJobState)
        .filter(UserJobState.user_id == user_id, UserJobState.job_id.in_(job_ids))
        .all()
    )
    return {row.job_id: row for row in rows}


def to_job_read(job: Job, state: UserJobState | None) -> JobRead:
    """Merge shared job data with this user's personal state into a JobRead."""
    return JobRead(
        id=job.id,
        external_id=job.external_id,
        title=job.title,
        description=job.description,
        budget=job.budget,
        budget_type=job.budget_type,
        skills=job.skills,
        job_url=job.job_url,
        posted_date=job.posted_date,
        source=job.source,
        raw_email_id=job.raw_email_id,
        client_rating=job.client_rating,
        client_spend=job.client_spend,
        client_country=job.client_country,
        payment_verified=job.payment_verified,
        created_at=job.created_at,
        # Per-user state (defaults when this user has not acted on the job yet)
        stage=state.stage if state else "found",
        outcome=state.outcome if state else None,
        submitted_proposal_text=state.submitted_proposal_text if state else None,
        submitted_variant_label=state.submitted_variant_label if state else None,
        fit_score=state.fit_score if state else None,
        fit_recommendation=state.fit_recommendation if state else None,
        fit_reasons=state.fit_reasons if state else None,
        fit_concerns=state.fit_concerns if state else None,
        fit_angle=state.fit_angle if state else None,
        fit_scored_at=state.fit_scored_at if state else None,
    )
