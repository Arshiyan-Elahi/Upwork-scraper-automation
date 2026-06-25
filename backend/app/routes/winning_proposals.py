from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models_intelligence import WinningProposal
from app.schemas_proposals import WinningProposalCreate, WinningProposalRead

router = APIRouter(prefix="/winning-proposals", tags=["winning-proposals"])


@router.get("", response_model=list[WinningProposalRead])
def list_winning_proposals(db: Session = Depends(get_db)) -> list[WinningProposal]:
    return (
        db.query(WinningProposal)
        .order_by(WinningProposal.created_at.desc())
        .all()
    )


@router.post("", response_model=WinningProposalRead, status_code=201)
def create_winning_proposal(
    body: WinningProposalCreate,
    db: Session = Depends(get_db),
) -> WinningProposal:
    row = WinningProposal(
        job_title=body.job_title.strip(),
        text=body.text.strip(),
        niche=body.niche.strip() if body.niche else None,
        outcome=body.outcome.strip() if body.outcome else None,
        revenue=body.revenue,
        notes=body.notes.strip() if body.notes else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{proposal_id}", status_code=204)
def delete_winning_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
) -> None:
    row = db.query(WinningProposal).filter(WinningProposal.id == proposal_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Winning proposal not found")
    db.delete(row)
    db.commit()
