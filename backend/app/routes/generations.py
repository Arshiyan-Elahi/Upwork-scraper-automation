from fastapi import APIRouter, Depends

from app.models_intelligence import GenerationLog
from app.schemas_proposals import GenerationLogRead, GenerationLogSummary
from app.security.scoping import UserScope, get_scope

router = APIRouter(prefix="/generations", tags=["generations"])


@router.get("", response_model=list[GenerationLogSummary])
def list_generations(scope: UserScope = Depends(get_scope)) -> list[GenerationLog]:
    return (
        scope.query(GenerationLog)
        .order_by(GenerationLog.ran_at.desc())
        .all()
    )


@router.get("/{generation_id}", response_model=GenerationLogRead)
def get_generation(
    generation_id: int,
    scope: UserScope = Depends(get_scope),
) -> GenerationLog:
    return scope.get_or_404(GenerationLog, generation_id, detail="Generation not found")
