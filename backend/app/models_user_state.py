"""Per-user state for a shared Job.

The Job row is shared across all users (objective data). Each user's personal
view of a job — pipeline stage, outcome, the proposal they submitted, and their
LLM fit scoring — lives here, one row per (user_id, job_id).
"""

from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class UserJobState(Base):
    __tablename__ = "user_job_state"
    __table_args__ = (
        UniqueConstraint("user_id", "job_id", name="uq_user_job_state_user_job"),
        Index("ix_user_job_state_user_id", "user_id"),
        Index("ix_user_job_state_job_id", "job_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )

    # Pipeline / tracker state (personal to this user)
    stage: Mapped[str] = mapped_column(String(32), nullable=False, default="found")
    outcome: Mapped[str | None] = mapped_column(String(32), nullable=True)
    submitted_proposal_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_variant_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # LLM-based job fit signal (per-user)
    fit_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fit_recommendation: Mapped[str | None] = mapped_column(String(16), nullable=True)
    fit_reasons: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    fit_concerns: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    fit_angle: Mapped[str | None] = mapped_column(Text, nullable=True)
    fit_scored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
