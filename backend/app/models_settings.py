"""Application settings persisted in the database (single default row)."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base

DEFAULT_SETTINGS_KEY = "default"


class AppSettings(Base):
    """Per-user application settings (proposal voice rules, generation provider)."""

    __tablename__ = "app_settings"
    __table_args__ = (
        UniqueConstraint("settings_key", name="uq_app_settings_settings_key"),
        Index("ix_app_settings_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    # Unique per row; for per-user rows we use "user:<id>" to satisfy the unique index.
    settings_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    proposal_voice_rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_generation_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class LLMCredential(Base):
    """Encrypted LLM API keys — per-user; never store plaintext."""

    __tablename__ = "llm_credentials"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_llm_credentials_user_provider"),
        Index("ix_llm_credentials_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    encrypted_key: Mapped[str] = mapped_column(Text, nullable=False)
    last4: Mapped[str] = mapped_column(String(4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
