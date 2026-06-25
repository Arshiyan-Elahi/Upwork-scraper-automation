import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.constants.pipeline import JOB_OUTCOMES, PIPELINE_STAGES
from app.db import get_db
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _job_mutation_response(job: Job, *, winning_created: bool = False) -> JobMutationResponse:
    return JobMutationResponse(job=JobRead.model_validate(job), winning_proposal_created=winning_created)


def _maybe_promote_hired(job: Job, session: Session) -> bool:
    if job.stage != "hired" and job.outcome != "hired":
        return False
    return maybe_create_winning_from_hired_job(job, session)


def _maybe_boost_portfolio(session: Session, job_id: int, outcome: str) -> None:
    if outcome not in LEARNING_OUTCOMES:
        return
    try:
        apply_portfolio_outcome_boost(session, job_id, outcome)
    except Exception:
        logger.exception(
            "Portfolio outcome boost failed for job_id=%s outcome=%s", job_id, outcome
        )


@router.get("", response_model=list[JobRead])
def list_jobs(db: Session = Depends(get_db)) -> list[Job]:
    return db.query(Job).order_by(Job.created_at.desc()).all()


@router.post("/score-fit-batch", response_model=JobFitBatchResponse)
def score_fit_batch(
    profile_id: int | None = Query(default=None),
    only_unscored: bool = Query(default=True),
    limit: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
) -> JobFitBatchResponse:
    """
    Bulk LLM fit scoring. Scores all unscored jobs by default (or all jobs when
    only_unscored=false). Degrades gracefully per job and runs sequentially to
    respect Gemini rate limits.
    """
    try:
        profile_row = resolve_profile_for_pipeline(db, profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    query = db.query(Job)
    if only_unscored:
        query = query.filter(Job.fit_scored_at.is_(None))
    query = query.order_by(Job.created_at.desc())
    if limit is not None:
        query = query.limit(limit)
    jobs = query.all()

    profile = normalize_extracted(profile_row.extracted)
    result = score_fit_for_jobs(db, jobs, profile)

    return JobFitBatchResponse(
        profile_id=profile_row.id,
        total=len(jobs),
        scored=result["scored"],
        failed=result["failed"],
        errors=result["errors"],
        jobs=[JobRead.model_validate(job) for job in jobs],
    )


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: int, db: Session = Depends(get_db)) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/{job_id}/match-portfolio", response_model=PortfolioMatchResponse)
def match_portfolio_for_job(
    job_id: int,
    profile_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> PortfolioMatchResponse:
    """Preview portfolio matches for a job against a profile's library."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        profile_row = resolve_profile_for_pipeline(db, profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    tracker = PipelineTracker()
    llm = get_llm_router(db)
    requirements = extract_requirements(job, router=llm, tracker=tracker)
    job_attrs = derive_job_attributes(job, requirements)
    matches = match_portfolio(db, job, profile_row.id, requirements)

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
    db: Session = Depends(get_db),
) -> JobFitResponse:
    """Run LLM job fit scoring for a single job against a profile and persist it."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        profile_row = resolve_profile_for_pipeline(db, profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    profile = normalize_extracted(profile_row.extracted)
    try:
        fit = score_and_save_job_fit(db, job, profile)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"Fit scoring failed: {exc}") from exc

    return JobFitResponse(
        job_id=job.id,
        profile_id=profile_row.id,
        fit=fit,
        job=JobRead.model_validate(job),
    )


@router.patch("/{job_id}/submitted-proposal", response_model=JobRead)
def save_submitted_proposal(
    job_id: int,
    body: JobSubmittedProposalUpdate,
    db: Session = Depends(get_db),
) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Proposal text is required")

    job.submitted_proposal_text = text
    job.submitted_variant_label = body.variant_label.strip() if body.variant_label else None
    job.stage = "submitted"
    db.commit()
    db.refresh(job)
    return job


@router.patch("/{job_id}/stage", response_model=JobMutationResponse)
def update_job_stage(
    job_id: int,
    body: JobStageUpdate,
    db: Session = Depends(get_db),
) -> JobMutationResponse:
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    stage = body.stage.strip().lower()
    if stage not in PIPELINE_STAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid stage. Must be one of: {', '.join(sorted(PIPELINE_STAGES))}",
        )

    job.stage = stage
    winning_created = _maybe_promote_hired(job, db)
    if stage in LEARNING_OUTCOMES:
        _maybe_boost_portfolio(db, job_id, stage)
    db.commit()
    db.refresh(job)
    return _job_mutation_response(job, winning_created=winning_created)


@router.patch("/{job_id}/outcome", response_model=JobMutationResponse)
def update_job_outcome(
    job_id: int,
    body: JobOutcomeUpdate,
    db: Session = Depends(get_db),
) -> JobMutationResponse:
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if body.outcome is not None:
        outcome = body.outcome.strip().lower()
        if outcome not in JOB_OUTCOMES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid outcome. Must be one of: {', '.join(sorted(JOB_OUTCOMES))} or null",
            )
        job.outcome = outcome
    else:
        job.outcome = None

    winning_created = _maybe_promote_hired(job, db)
    if job.outcome and job.outcome in LEARNING_OUTCOMES:
        _maybe_boost_portfolio(db, job_id, job.outcome)
    db.commit()
    db.refresh(job)
    return _job_mutation_response(job, winning_created=winning_created)
