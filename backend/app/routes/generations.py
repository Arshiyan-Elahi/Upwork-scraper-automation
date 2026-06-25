from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models_intelligence import GenerationLog
from app.schemas_proposals import GenerationLogRead, GenerationLogSummary

router = APIRouter(prefix="/generations", tags=["generations"])


@router.get("", response_model=list[GenerationLogSummary])
def list_generations(db: Session = Depends(get_db)) -> list[GenerationLog]:
    return (
        db.query(GenerationLog)
        .order_by(GenerationLog.ran_at.desc())
        .all()
    )


@router.get("/{generation_id}", response_model=GenerationLogRead)
def get_generation(
    generation_id: int,
    db: Session = Depends(get_db),
) -> GenerationLog:
    row = db.query(GenerationLog).filter(GenerationLog.id == generation_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    return row
