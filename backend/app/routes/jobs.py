import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.constants.pipeline import JOB_OUTCOMES, PIPELINE_STAGES
from app.intelligence.hired_promotion import maybe_create_winning_from_hired_job
from app.intelligence.job_fit import score_and_save_job_fit, score_fit_for_jobs
from app.intelligence.pipeline import extract_requirements, PipelineTracker
from app.intelligence.portfolio_match import derive_job_attributes, match_portfolio
from app.intelligence.portfolio_outcome_learning import (
    LEARNING_OUTCOMES,
    apply_portfolio_outcome_boost,
)
from app.intelligence.profile import normalize_extracted, resolve_profile_for_pipeline
from app.llm.errors import LLMError
from app.llm.router import get_llm_router
from app.models import Job
from app.models_user_state import UserJobState
from app.schemas import (
    JobFitBatchResponse,
    JobFitResponse,
    JobMutationResponse,
    JobOutcomeUpdate,
    JobRead,
    JobStageUpdate,
    JobSubmittedProposalUpdate,
)
from app.schemas_proposals import PortfolioMatchResponse
from app.security.scoping import UserScope, get_scope
from app.services.job_state import (
    get_or_create_state,
    states_by_job_id,
    to_job_read,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _get_shared_job_or_404(db: Session, job_id: int) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _mutation_response(job: Job, state: UserJobState, *, winning_created: bool = False) -> JobMutationResponse:
    return JobMutationResponse(
        job=to_job_read(job, state), winning_proposal_created=winning_created
    )


def _maybe_promote_hired(job: Job, state: UserJobState, scope: UserScope) -> bool:
    if state.stage != "hired" and state.outcome != "hired":
        return False
    return maybe_create_winning_from_hired_job(
        job, scope.session, user_id=scope.user_id, state=state
    )


def _maybe_boost_portfolio(scope: UserScope, job_id: int, outcome: str) -> None:
    if outcome not in LEARNING_OUTCOMES:
        return
    try:
        apply_portfolio_outcome_boost(scope.session, job_id, outcome, user_id=scope.user_id)
    except Exception:
        logger.exception(
            "Portfolio outcome boost failed for job_id=%s outcome=%s", job_id, outcome
        )


@router.get("", response_model=list[JobRead])
def list_jobs(scope: UserScope = Depends(get_scope)) -> list[JobRead]:
    """Shared job list (same for everyone) merged with THIS user's personal state."""
    jobs = scope.session.query(Job).order_by(Job.created_at.desc()).all()
    states = states_by_job_id(scope.session, scope.user_id, [j.id for j in jobs])
    return [to_job_read(job, states.get(job.id)) for job in jobs]


@router.post("/score-fit-batch", response_model=JobFitBatchResponse)
def score_fit_batch(
    profile_id: int | None = Query(default=None),
    only_unscored: bool = Query(default=True),
    limit: int | None = Query(default=None, ge=1),
    scope: UserScope = Depends(get_scope),
) -> JobFitBatchResponse:
    """
    Bulk LLM fit scoring for the current user. Scores jobs this user has not yet
    scored by default. Degrades gracefully per job; writes to user_job_state.
    """
    db = scope.session
    try:
        profile_row = resolve_profile_for_pipeline(db, scope.user_id, profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    query = db.query(Job)
    if only_unscored:
        scored_subq = (
            db.query(UserJobState.job_id)
            .filter(
                UserJobState.user_id == scope.user_id,
                UserJobState.fit_scored_at.isnot(None),
            )
            .subquery()
        )
        query = query.filter(Job.id.notin_(scored_subq))
    query = query.order_by(Job.created_at.desc())
    if limit is not None:
        query = query.limit(limit)
    jobs = query.all()

    profile = normalize_extracted(profile_row.extracted)
    result = score_fit_for_jobs(db, scope.user_id, jobs, profile)

    states = states_by_job_id(db, scope.user_id, [j.id for j in jobs])
    return JobFitBatchResponse(
        profile_id=profile_row.id,
        total=len(jobs),
        scored=result["scored"],
        failed=result["failed"],
        errors=result["errors"],
        jobs=[to_job_read(job, states.get(job.id)) for job in jobs],
    )


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: int, scope: UserScope = Depends(get_scope)) -> JobRead:
    job = _get_shared_job_or_404(scope.session, job_id)
    state = (
        scope.session.query(UserJobState)
        .filter(UserJobState.user_id == scope.user_id, UserJobState.job_id == job_id)
        .first()
    )
    return to_job_read(job, state)


@router.post("/{job_id}/match-portfolio", response_model=PortfolioMatchResponse)
def match_portfolio_for_job(
    job_id: int,
    profile_id: int | None = Query(default=None),
    scope: UserScope = Depends(get_scope),
) -> PortfolioMatchResponse:
    """Preview portfolio matches for a job against the current user's library."""
    db = scope.session
    job = _get_shared_job_or_404(db, job_id)

    try:
        profile_row = resolve_profile_for_pipeline(db, scope.user_id, profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    tracker = PipelineTracker()
    llm = get_llm_router(db, scope.user_id)
    requirements = extract_requirements(job, router=llm, tracker=tracker)
    job_attrs = derive_job_attributes(job, requirements)
    matches = match_portfolio(db, job, profile_row.id, requirements, user_id=scope.user_id)

    return PortfolioMatchResponse(
        job_id=job_id,
        profile_id=profile_row.id,
        job_attributes=job_attrs,
        matches=matches,
    )


@router.post("/{job_id}/score-fit", response_model=JobFitResponse)
def score_fit_for_job(
    job_id: int,
    profile_id: int | None = Query(default=None),
    scope: UserScope = Depends(get_scope),
) -> JobFitResponse:
    """Run LLM job fit scoring for a single job and persist it on the user's state."""
    db = scope.session
    job = _get_shared_job_or_404(db, job_id)

    try:
        profile_row = resolve_profile_for_pipeline(db, scope.user_id, profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    profile = normalize_extracted(profile_row.extracted)
    try:
        fit = score_and_save_job_fit(db, scope.user_id, job, profile)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"Fit scoring failed: {exc}") from exc

    state = get_or_create_state(db, scope.user_id, job_id)
    return JobFitResponse(
        job_id=job.id,
        profile_id=profile_row.id,
        fit=fit,
        job=to_job_read(job, state),
    )


@router.patch("/{job_id}/submitted-proposal", response_model=JobRead)
def save_submitted_proposal(
    job_id: int,
    body: JobSubmittedProposalUpdate,
    scope: UserScope = Depends(get_scope),
) -> JobRead:
    db = scope.session
    job = _get_shared_job_or_404(db, job_id)

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Proposal text is required")

    state = get_or_create_state(db, scope.user_id, job_id)
    state.submitted_proposal_text = text
    state.submitted_variant_label = body.variant_label.strip() if body.variant_label else None
    state.stage = "submitted"
    db.commit()
    db.refresh(state)
    return to_job_read(job, state)


@router.patch("/{job_id}/stage", response_model=JobMutationResponse)
def update_job_stage(
    job_id: int,
    body: JobStageUpdate,
    scope: UserScope = Depends(get_scope),
) -> JobMutationResponse:
    db = scope.session
    job = _get_shared_job_or_404(db, job_id)

    stage = body.stage.strip().lower()
    if stage not in PIPELINE_STAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid stage. Must be one of: {', '.join(sorted(PIPELINE_STAGES))}",
        )

    state = get_or_create_state(db, scope.user_id, job_id)
    state.stage = stage
    winning_created = _maybe_promote_hired(job, state, scope)
    if stage in LEARNING_OUTCOMES:
        _maybe_boost_portfolio(scope, job_id, stage)
    db.commit()
    db.refresh(state)
    return _mutation_response(job, state, winning_created=winning_created)


@router.patch("/{job_id}/outcome", response_model=JobMutationResponse)
def update_job_outcome(
    job_id: int,
    body: JobOutcomeUpdate,
    scope: UserScope = Depends(get_scope),
) -> JobMutationResponse:
    db = scope.session
    job = _get_shared_job_or_404(db, job_id)

    state = get_or_create_state(db, scope.user_id, job_id)
    if body.outcome is not None:
        outcome = body.outcome.strip().lower()
        if outcome not in JOB_OUTCOMES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid outcome. Must be one of: {', '.join(sorted(JOB_OUTCOMES))} or null",
            )
        state.outcome = outcome
    else:
        state.outcome = None

    winning_created = _maybe_promote_hired(job, state, scope)
    if state.outcome and state.outcome in LEARNING_OUTCOMES:
        _maybe_boost_portfolio(scope, job_id, state.outcome)
    db.commit()
    db.refresh(state)
    return _mutation_response(job, state, winning_created=winning_created)
