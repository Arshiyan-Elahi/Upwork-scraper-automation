from fastapi import APIRouter, Depends

from app.models_intelligence import WinningProposal
from app.schemas_proposals import WinningProposalCreate, WinningProposalRead
from app.security.scoping import UserScope, get_scope

router = APIRouter(prefix="/winning-proposals", tags=["winning-proposals"])


@router.get("", response_model=list[WinningProposalRead])
def list_winning_proposals(scope: UserScope = Depends(get_scope)) -> list[WinningProposal]:
    return (
        scope.query(WinningProposal)
        .order_by(WinningProposal.created_at.desc())
        .all()
    )


@router.post("", response_model=WinningProposalRead, status_code=201)
def create_winning_proposal(
    body: WinningProposalCreate,
    scope: UserScope = Depends(get_scope),
) -> WinningProposal:
    row = WinningProposal(
        job_title=body.job_title.strip(),
        text=body.text.strip(),
        niche=body.niche.strip() if body.niche else None,
        outcome=body.outcome.strip() if body.outcome else None,
        revenue=body.revenue,
        notes=body.notes.strip() if body.notes else None,
    )
    scope.add(row)
    scope.session.commit()
    scope.session.refresh(row)
    return row


@router.delete("/{proposal_id}", status_code=204)
def delete_winning_proposal(
    proposal_id: int,
    scope: UserScope = Depends(get_scope),
) -> None:
    row = scope.get_or_404(WinningProposal, proposal_id, detail="Winning proposal not found")
    scope.session.delete(row)
    scope.session.commit()
