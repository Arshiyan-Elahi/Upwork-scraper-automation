from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.ingestion.cleanup import cleanup_stale_email_jobs
from app.schemas import EmailJobCleanupResult

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.post("/cleanup-email-jobs", response_model=EmailJobCleanupResult)
def cleanup_email_jobs(
    db: Session = Depends(get_db),
    dry_run: bool = Query(False, description="Preview counts without deleting rows"),
) -> EmailJobCleanupResult:
    """
    Delete jobs where source='email' and not enriched by the Chrome extension.

    Does not run automatically — invoke once when you are ready to clean up legacy data.
    """
    result = cleanup_stale_email_jobs(db, dry_run=dry_run)
    return EmailJobCleanupResult(**result)
