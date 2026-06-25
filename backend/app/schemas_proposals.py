from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WinningProposalCreate(BaseModel):
    job_title: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    niche: str | None = None
    outcome: str | None = None
    revenue: float | None = None
    notes: str | None = None


class WinningProposalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_title: str
    text: str
    niche: str | None
    outcome: str | None
    revenue: float | None
    notes: str | None
    source_job_id: int | None = None
    created_at: datetime


class GenerateProposalOptions(BaseModel):
    n_variants: int = Field(default=3, ge=1, le=5)
    custom_instructions: str | None = None
    profile_id: int | None = None


class PortfolioMatchItem(BaseModel):
    portfolio_item_id: int
    title: str
    url: str
    match_score: int
    reason: str
    matched_tags: list[str] = Field(default_factory=list)


class PortfolioMatchResponse(BaseModel):
    job_id: int
    profile_id: int
    job_attributes: dict[str, Any]
    matches: list[PortfolioMatchItem]


class GenerationLogSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    ran_at: datetime
    match_score: float | None
    prompt_version: str
    latency_ms: int | None
    overall_proposal_score: float | None
    n_variants: int
    custom_instructions: str | None = None


class GenerationLogRead(GenerationLogSummary):
    providers_used: dict[str, Any] | None
    result: dict[str, Any] | None
