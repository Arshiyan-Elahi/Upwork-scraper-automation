import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.intelligence.pipeline import run_proposal_pipeline
from app.intelligence.profile import normalize_extracted, resolve_profile_for_pipeline
from app.llm.errors import LLMConfigurationError
from app.models import Job
from app.schemas_proposals import GenerateProposalOptions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/{job_id}/generate-proposal")
def generate_proposal_for_job(
    job_id: int,
    body: GenerateProposalOptions | None = None,
    db: Session = Depends(get_db),
) -> dict:
    """Run the full proposal pipeline for an ingested job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    body = body or GenerateProposalOptions()
    custom_instructions = (body.custom_instructions or "").strip()
    options = {
        "n_variants": body.n_variants,
        "custom_instructions": custom_instructions,
    }

    try:
        profile_row = resolve_profile_for_pipeline(db, body.profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    profile = normalize_extracted(profile_row.extracted)

    try:
        return run_proposal_pipeline(
            db,
            job_id,
            profile,
            options,
            profile_id=profile_row.id,
        )
    except LLMConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Proposal pipeline failed for job_id=%s", job_id)
        raise HTTPException(status_code=500, detail="Proposal pipeline failed.") from exc
