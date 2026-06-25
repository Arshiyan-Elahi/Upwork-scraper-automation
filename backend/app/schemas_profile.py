from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProfileExtracted(BaseModel):
    niches: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    services: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    ideal_clients: str = ""
    writing_tone: str = ""
    best_fit_job_types: list[str] = Field(default_factory=list)
    avoid_job_types: list[str] = Field(default_factory=list)
    headline: str = ""
    summary: str = ""


class ProfileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    raw_text: str = Field(..., min_length=1)
    upwork_profile_url: str | None = None
    behance_url: str | None = None


class ProfileUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    raw_text: str | None = Field(None, min_length=1)
    upwork_profile_url: str | None = None
    behance_url: str | None = None


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    raw_input: str
    extracted: ProfileExtracted
    upwork_profile_url: str | None
    behance_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProfileSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_active: bool
    upwork_profile_url: str | None
    behance_url: str | None
    created_at: datetime
    updated_at: datetime
