from datetime import datetime

from sqlalchemy import Boolean, DateTime, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Profile(Base):
    """Freelancer profile — multiple rows, one active at a time."""

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_input: Mapped[str] = mapped_column(Text, nullable=False)
    extracted: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    upwork_profile_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    behance_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
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

    portfolio_items = relationship(
        "PortfolioItem",
        back_populates="profile",
        cascade="all, delete-orphan",
    )
