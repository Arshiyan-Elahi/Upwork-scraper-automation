"""Proposal pipeline tracking and winning proposal examples."""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class WinningProposal(Base):
    """Past winning proposals used as style references for generation."""

    __tablename__ = "winning_proposals"
    __table_args__ = (
        UniqueConstraint("source_job_id", name="uq_winning_proposals_source_job_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_title: Mapped[str] = mapped_column(String(500), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    niche: Mapped[str | None] = mapped_column(String(255), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(64), nullable=True)
    revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_job_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class GenerationLog(Base):
    """One row per proposal pipeline run — replaces external experiment tracking."""

    __tablename__ = "generation_logs"
    __table_args__ = (Index("ix_generation_logs_job_id", "job_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, nullable=False)
    ran_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    providers_used: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    overall_proposal_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    n_variants: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    custom_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ProposalPortfolioLink(Base):
    """Portfolio links attached during a proposal generation run."""

    __tablename__ = "proposal_portfolio_links"
    __table_args__ = (
        Index("ix_proposal_portfolio_links_generation_id", "generation_id"),
        Index("ix_proposal_portfolio_links_portfolio_item_id", "portfolio_item_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    generation_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("generation_logs.id", ondelete="CASCADE"),
        nullable=False,
    )
    portfolio_item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("portfolio_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    match_score: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class PortfolioOutcomeBoost(Base):
    """Tracks idempotent priority boosts from job outcomes."""

    __tablename__ = "portfolio_outcome_boosts"
    __table_args__ = (
        UniqueConstraint(
            "job_id",
            "outcome",
            "portfolio_item_id",
            name="uq_portfolio_outcome_boost",
        ),
        Index("ix_portfolio_outcome_boosts_job_id", "job_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, nullable=False)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    portfolio_item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("portfolio_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    boost_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
