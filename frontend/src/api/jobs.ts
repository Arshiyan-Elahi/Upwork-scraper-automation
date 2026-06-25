import { KANBAN_STAGES, PROPOSAL_OUTCOMES } from '../constants/pipeline'
import type {
  BudgetType,
  ClientQuality,
  Job,
  JobOutcome,
  JobSource,
  PipelineStage,
  Verdict,
} from '../types'
import { apiFetch } from './client'

/** Shape returned by GET /jobs (FastAPI snake_case). */
export interface BackendJob {
  id: number
  external_id: string | null
  title: string
  description: string | null
  budget: string | null
  budget_type: string | null
  skills: string[] | null
  job_url: string | null
  posted_date: string | null
  source: string
  raw_email_id: string | null
  client_rating: number | null
  client_spend: string | null
  client_country: string | null
  payment_verified: boolean | null
  stage: string
  outcome: string | null
  submitted_proposal_text?: string | null
  submitted_variant_label?: string | null
  fit_score?: number | null
  fit_recommendation?: string | null
  fit_reasons?: string[] | null
  fit_concerns?: string[] | null
  fit_angle?: string | null
  fit_scored_at?: string | null
  created_at: string
}

interface BackendJobFitResponse {
  job_id: number
  profile_id: number
  fit: {
    fit_score: number
    recommendation: string
    reasons: string[]
    concerns: string[]
    suggested_angle: string
  }
  job: BackendJob
}

export interface BackendJobFitBatchResponse {
  profile_id: number
  total: number
  scored: number
  failed: number
  errors: string[]
  jobs: BackendJob[]
}

interface BackendJobMutationResponse {
  job: BackendJob
  winning_proposal_created: boolean
}

function mapBudgetType(raw: string | null | undefined): BudgetType {
  if (raw === 'fixed' || raw === 'hourly') return raw
  return 'unknown'
}

function mapSource(raw: string): JobSource {
  if (
    raw === 'email' ||
    raw === 'apify' ||
    raw === 'api' ||
    raw === 'manual' ||
    raw === 'extension'
  ) {
    return raw
  }
  return 'extension'
}

function deriveClientQuality(rating: number | null | undefined): ClientQuality {
  if (rating == null) return 'unknown'
  if (rating >= 4.8) return 'high'
  if (rating >= 4.5) return 'medium'
  if (rating >= 4.0) return 'low'
  return 'unknown'
}

function toIsoDate(raw: string | null | undefined): string {
  if (!raw) return new Date().toISOString()
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function mapStage(raw: string | null | undefined): PipelineStage {
  if (raw && (KANBAN_STAGES as readonly string[]).includes(raw)) {
    return raw as PipelineStage
  }
  return 'found'
}

function mapOutcome(raw: string | null | undefined): JobOutcome | null {
  if (raw && (PROPOSAL_OUTCOMES as readonly string[]).includes(raw)) {
    return raw as JobOutcome
  }
  return null
}

function mapFitRecommendation(raw: string | null | undefined): Verdict | null {
  if (raw === 'apply' || raw === 'maybe' || raw === 'skip') {
    return raw
  }
  return null
}

/**
 * Map a backend job row to the frontend Job type.
 * Scoring fields are left null — real verdicts come later from the intelligence layer.
 */
export function mapBackendJob(backend: BackendJob): Job {
  const postedDate = toIsoDate(backend.posted_date ?? backend.created_at)
  const receivedDate = toIsoDate(backend.created_at)

  return {
    id: String(backend.id),
    title: backend.title,
    source: mapSource(backend.source),
    budget: backend.budget ?? null,
    budgetType: mapBudgetType(backend.budget_type),
    description: backend.description ?? '',
    skills: backend.skills ?? [],
    clientQuality: deriveClientQuality(backend.client_rating),
    clientInfo: {
      spend: backend.client_spend ?? undefined,
      rating: backend.client_rating ?? undefined,
      location: backend.client_country ?? undefined,
    },
    competition: 'unknown',
    matchScore: null,
    verdict: null,
    scoreBreakdown: null,
    redFlags: [],
    portfolioMatchIds: [],
    suggestedAngle: '',
    discoveryQuestion: '',
    postedDate,
    receivedDate,
    jobUrl: backend.job_url ?? null,
    stage: mapStage(backend.stage),
    outcome: mapOutcome(backend.outcome),
    fitScore: backend.fit_score ?? null,
    fitRecommendation: mapFitRecommendation(backend.fit_recommendation),
    fitReasons: backend.fit_reasons ?? [],
    fitConcerns: backend.fit_concerns ?? [],
    fitAngle: backend.fit_angle ?? '',
    fitScoredAt: backend.fit_scored_at ?? null,
  }
}

/** Fetch all jobs from the backend (live data — Job Inbox only for now). */
export async function getJobs(): Promise<Job[]> {
  const rows = await apiFetch<BackendJob[]>('/jobs')
  return rows.map(mapBackendJob)
}

/** Fetch a single job by id. */
export async function getJob(id: string): Promise<Job> {
  const row = await apiFetch<BackendJob>(`/jobs/${id}`)
  return mapBackendJob(row)
}

export interface JobMutationResult {
  job: Job
  winningProposalCreated: boolean
}

function mapJobMutation(response: BackendJobMutationResponse): JobMutationResult {
  return {
    job: mapBackendJob(response.job),
    winningProposalCreated: response.winning_proposal_created,
  }
}

/** Save the exact proposal text sent to the client and mark job submitted. */
export async function patchJobSubmittedProposal(
  id: string,
  text: string,
  variantLabel?: string,
): Promise<Job> {
  const row = await apiFetch<BackendJob>(`/jobs/${id}/submitted-proposal`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      variant_label: variantLabel ?? null,
    }),
  })
  return mapBackendJob(row)
}

/** Persist pipeline stage for a job. */
export async function patchJobStage(id: string, stage: PipelineStage): Promise<JobMutationResult> {
  const row = await apiFetch<BackendJobMutationResponse>(`/jobs/${id}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  })
  return mapJobMutation(row)
}

function profileQuery(profileId?: number): string {
  return profileId != null ? `?profile_id=${profileId}` : ''
}

/** Run LLM fit scoring for a single job and return the updated job. */
export async function scoreJobFit(id: string, profileId?: number): Promise<Job> {
  const response = await apiFetch<BackendJobFitResponse>(
    `/jobs/${id}/score-fit${profileQuery(profileId)}`,
    { method: 'POST' },
  )
  return mapBackendJob(response.job)
}

export interface JobFitBatchResult {
  total: number
  scored: number
  failed: number
  errors: string[]
  jobs: Job[]
}

/** Bulk LLM fit scoring (unscored jobs by default). */
export async function scoreFitBatch(
  options: { profileId?: number; onlyUnscored?: boolean } = {},
): Promise<JobFitBatchResult> {
  const params = new URLSearchParams()
  if (options.profileId != null) params.set('profile_id', String(options.profileId))
  if (options.onlyUnscored != null) params.set('only_unscored', String(options.onlyUnscored))
  const qs = params.toString()
  const response = await apiFetch<BackendJobFitBatchResponse>(
    `/jobs/score-fit-batch${qs ? `?${qs}` : ''}`,
    { method: 'POST' },
  )
  return {
    total: response.total,
    scored: response.scored,
    failed: response.failed,
    errors: response.errors,
    jobs: response.jobs.map(mapBackendJob),
  }
}

/** Persist job outcome (replied, interview, hired, rejected, or null to clear). */
export async function patchJobOutcome(
  id: string,
  outcome: JobOutcome | null,
): Promise<JobMutationResult> {
  const row = await apiFetch<BackendJobMutationResponse>(`/jobs/${id}/outcome`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome }),
  })
  return mapJobMutation(row)
}
