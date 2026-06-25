from datetime import datetime

from pydantic import BaseModel, ConfigDict


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: str | None
    title: str
    description: str | None
    budget: str | None
    budget_type: str | None
    skills: list[str] | None
    job_url: str | None
    posted_date: datetime | None
    source: str
    raw_email_id: str | None
    client_rating: float | None
    client_spend: str | None
    client_country: str | None
    payment_verified: bool | None
    stage: str
    outcome: str | None
    submitted_proposal_text: str | None = None
    submitted_variant_label: str | None = None
    fit_score: int | None = None
    fit_recommendation: str | None = None
    fit_reasons: list[str] | None = None
    fit_concerns: list[str] | None = None
    fit_angle: str | None = None
    fit_scored_at: datetime | None = None
    created_at: datetime


class JobFitResult(BaseModel):
    fit_score: int
    recommendation: str
    reasons: list[str]
    concerns: list[str]
    suggested_angle: str


class JobFitResponse(BaseModel):
    job_id: int
    profile_id: int
    fit: JobFitResult
    job: JobRead


class JobFitBatchResponse(BaseModel):
    profile_id: int
    total: int
    scored: int
    failed: int
    errors: list[str] = []
    jobs: list[JobRead]


class JobStageUpdate(BaseModel):
    stage: str


class JobOutcomeUpdate(BaseModel):
    outcome: str | None


class JobSubmittedProposalUpdate(BaseModel):
    text: str
    variant_label: str | None = None


class JobMutationResponse(BaseModel):
    job: JobRead
    winning_proposal_created: bool = False


class HealthResponse(BaseModel):
    status: str


class IngestStatus(BaseModel):
    last_webhook_sync: datetime | None = None
    jobs_extracted: int
    failed_parses: int
    duplicates_skipped: int
    jobs_updated: int = 0
    webhook_jobs_added: int = 0


class EmailJobCleanupResult(BaseModel):
    deleted: int
    kept: int
    dry_run: bool = False


class WebhookIngestSummary(BaseModel):
    received: int
    added: int
    updated: int
    duplicates_skipped: int
    errors: list[str]
