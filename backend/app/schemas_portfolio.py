from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PortfolioItemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    url: str = Field(..., min_length=1, max_length=2048)
    source_type: str = Field(..., min_length=1, max_length=32)
    main_category: str = Field(..., min_length=1, max_length=255)
    sub_category: str = Field(..., min_length=1, max_length=255)
    industry_tags: list[str] = Field(default_factory=list)
    skill_tags: list[str] = Field(default_factory=list)
    style_tags: list[str] = Field(default_factory=list)
    tools_tags: list[str] = Field(default_factory=list)
    description: str | None = None
    priority_score: int = 0


class PortfolioItemUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    url: str | None = Field(None, min_length=1, max_length=2048)
    source_type: str | None = Field(None, min_length=1, max_length=32)
    main_category: str | None = Field(None, min_length=1, max_length=255)
    sub_category: str | None = Field(None, min_length=1, max_length=255)
    industry_tags: list[str] | None = None
    skill_tags: list[str] | None = None
    style_tags: list[str] | None = None
    tools_tags: list[str] | None = None
    description: str | None = None
    priority_score: int | None = None
    is_active: bool | None = None


class PortfolioItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    title: str
    url: str
    source_type: str
    main_category: str
    sub_category: str
    industry_tags: list[str]
    skill_tags: list[str]
    style_tags: list[str]
    tools_tags: list[str]
    description: str | None
    priority_score: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PortfolioTaxonomyRead(BaseModel):
    taxonomy: dict[str, list[str]]
    source_types: list[str]


class PortfolioAnalyzeInput(BaseModel):
    title: str | None = None
    url: str | None = None
    description: str | None = None
    source_type: str | None = None


class PortfolioAnalyzeResult(BaseModel):
    main_category: str = ""
    sub_category: str = ""
    industry_tags: list[str] = Field(default_factory=list)
    skill_tags: list[str] = Field(default_factory=list)
    style_tags: list[str] = Field(default_factory=list)
    tools_tags: list[str] = Field(default_factory=list)
    best_for_jobs: list[str] = Field(default_factory=list)
    short_summary: str = ""
    confidence_score: int = 0
