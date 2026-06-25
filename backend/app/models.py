from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint("job_url", name="uq_jobs_job_url"),
        Index("ix_jobs_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    budget: Mapped[str | None] = mapped_column(String(255), nullable=True)
    budget_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    skills: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    job_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    posted_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="extension")
    raw_email_id: Mapped[str | None] = mapped_column(String(512), nullable=True, index=True)
    client_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    client_spend: Mapped[str | None] = mapped_column(String(100), nullable=True)
    client_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payment_verified: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    stage: Mapped[str] = mapped_column(String(32), nullable=False, default="found", index=True)
    outcome: Mapped[str | None] = mapped_column(String(32), nullable=True)
    submitted_proposal_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_variant_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # LLM-based job fit signal (separate from rule-based match_profile)
    fit_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fit_recommendation: Mapped[str | None] = mapped_column(String(16), nullable=True)
    fit_reasons: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    fit_concerns: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    fit_angle: Mapped[str | None] = mapped_column(Text, nullable=True)
    fit_scored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class ProcessedEmail(Base):
    __tablename__ = "processed_emails"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[str] = mapped_column(String(512), nullable=False, unique=True, index=True)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class IngestionRun(Base):
    """One row per ingestion execution — persists summary across restarts."""

    __tablename__ = "ingestion_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ran_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    emails_scanned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    jobs_added: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duplicates_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    parse_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    jobs_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    run_type: Mapped[str] = mapped_column(String(32), nullable=False, default="webhook")
    gmail_connected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
