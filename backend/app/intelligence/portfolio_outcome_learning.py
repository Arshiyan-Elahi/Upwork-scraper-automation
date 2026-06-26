"""Boost portfolio priority when attached links correlate with positive job outcomes."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models_intelligence import GenerationLog, PortfolioOutcomeBoost, ProposalPortfolioLink
from app.models_portfolio import PortfolioItem

logger = logging.getLogger(__name__)

# Bigger bump for stronger outcomes (viewed < replied < hired).
OUTCOME_PRIORITY_BOOSTS: dict[str, int] = {
    "viewed": 3,
    "replied": 8,
    "interview": 8,
    "hired": 15,
}

LEARNING_OUTCOMES = frozenset(OUTCOME_PRIORITY_BOOSTS.keys())


def record_proposal_portfolio_links(
    session: Session,
    generation_id: int,
    matches: list[dict],
    *,
    user_id: int,
) -> None:
    """Persist one row per attached portfolio link for a generation run."""
    for match in matches:
        item_id = match.get("portfolio_item_id")
        if not item_id:
            continue
        session.add(
            ProposalPortfolioLink(
                user_id=user_id,
                generation_id=generation_id,
                portfolio_item_id=int(item_id),
                match_score=float(match.get("match_score") or 0),
                reason=str(match.get("reason") or ""),
            )
        )


def apply_portfolio_outcome_boost(
    session: Session,
    job_id: int,
    outcome: str,
    *,
    user_id: int,
) -> int:
    """
    Raise priority_score for the current user's portfolio items linked to this
    job's proposals.

    Idempotent per (user_id, job_id, outcome, portfolio_item_id). Returns count boosted.
    """
    outcome_key = (outcome or "").strip().lower()
    if outcome_key not in LEARNING_OUTCOMES:
        return 0

    boost = OUTCOME_PRIORITY_BOOSTS[outcome_key]
    links = (
        session.query(ProposalPortfolioLink)
        .join(GenerationLog, ProposalPortfolioLink.generation_id == GenerationLog.id)
        .filter(GenerationLog.job_id == job_id, GenerationLog.user_id == user_id)
        .all()
    )
    if not links:
        return 0

    item_ids = {link.portfolio_item_id for link in links}
    boosted = 0
    for item_id in item_ids:
        already = (
            session.query(PortfolioOutcomeBoost)
            .filter(
                PortfolioOutcomeBoost.user_id == user_id,
                PortfolioOutcomeBoost.job_id == job_id,
                PortfolioOutcomeBoost.outcome == outcome_key,
                PortfolioOutcomeBoost.portfolio_item_id == item_id,
            )
            .first()
        )
        if already:
            continue

        item = (
            session.query(PortfolioItem)
            .filter(PortfolioItem.id == item_id, PortfolioItem.user_id == user_id)
            .first()
        )
        if item is None:
            continue

        item.priority_score = (item.priority_score or 0) + boost
        session.add(
            PortfolioOutcomeBoost(
                user_id=user_id,
                job_id=job_id,
                outcome=outcome_key,
                portfolio_item_id=item_id,
                boost_amount=boost,
            )
        )
        boosted += 1
        logger.info(
            "Portfolio outcome boost +%s for item_id=%s job_id=%s outcome=%s",
            boost,
            item_id,
            job_id,
            outcome_key,
        )

    return boosted
