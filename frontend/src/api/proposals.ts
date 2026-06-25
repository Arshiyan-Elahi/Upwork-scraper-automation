import type { WinningProposal } from '../types'
import { apiFetch } from './client'

export interface BackendWinningProposal {
  id: number
  job_title: string
  text: string
  niche: string | null
  outcome: string | null
  revenue: number | null
  notes: string | null
  created_at: string
}

export interface ProposalScores {
  personalization: number
  specificity: number
  value: number
  call_to_action: number
  overall: number
}

export interface PortfolioMatchItem {
  portfolio_item_id: number
  title: string
  url: string
  match_score: number
  reason: string
  matched_tags: string[]
}

export interface PortfolioMatchPreview {
  job_id: number
  profile_id: number
  job_attributes: Record<string, unknown>
  matches: PortfolioMatchItem[]
}

export interface GeneratedProposalVariant {
  variant_label: string
  text: string
  scores?: ProposalScores
  error?: string
}

export interface ProposalPipelineResult {
  job_id: number
  generation_id: number
  requirements: Record<string, unknown>
  match: {
    match_score: number
    matched_skills: string[]
    missing_skills: string[]
  }
  portfolio_matches: PortfolioMatchItem[]
  red_flags: string[]
  bid: {
    suggested_rate_or_range: string
    reasoning: string
    connects_recommendation: 'yes' | 'maybe' | 'no'
    connects_reason: string
  }
  proposals: GeneratedProposalVariant[]
  follow_up: string
  metadata: {
    prompt_version: string
    providers_used: Record<string, string>
    latency_ms: Record<string, number>
    total_latency_ms: number
    errors: Record<string, string>[]
    winning_examples_used: number[]
    n_variants: number
    custom_instructions?: string | null
    profile_id?: number | null
    portfolio_links_attached?: PortfolioMatchItem[]
  }
}

export interface GenerateProposalRequest {
  n_variants?: number
  custom_instructions?: string
  profile_id?: number
}

export function mapWinningProposal(row: BackendWinningProposal): WinningProposal {
  return {
    id: String(row.id),
    jobTitle: row.job_title,
    text: row.text,
    niche: row.niche ?? '',
    outcome: row.outcome ?? '',
    revenue: row.revenue ?? 0,
    notes: row.notes ?? '',
  }
}

/** Live winning proposals API — Winning Proposals page only. */
export async function getWinningProposals(): Promise<WinningProposal[]> {
  const rows = await apiFetch<BackendWinningProposal[]>('/winning-proposals')
  return rows.map(mapWinningProposal)
}

export async function createWinningProposal(data: {
  job_title: string
  text: string
  niche?: string
  outcome?: string
  revenue?: number
  notes?: string
}): Promise<WinningProposal> {
  const row = await apiFetch<BackendWinningProposal>('/winning-proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job_title: data.job_title,
      text: data.text,
      niche: data.niche || null,
      outcome: data.outcome || null,
      revenue: data.revenue ?? null,
      notes: data.notes || null,
    }),
  })
  return mapWinningProposal(row)
}

export async function deleteWinningProposal(id: string): Promise<void> {
  await apiFetch<void>(`/winning-proposals/${id}`, { method: 'DELETE' })
}

/** Run proposal pipeline — Proposal Studio page only. */
export async function generateProposal(
  jobId: string,
  options: GenerateProposalRequest = {},
): Promise<ProposalPipelineResult> {
  return apiFetch<ProposalPipelineResult>(`/jobs/${jobId}/generate-proposal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      n_variants: options.n_variants ?? 3,
      custom_instructions: options.custom_instructions ?? '',
      profile_id: options.profile_id ?? null,
    }),
  })
}

/** Preview portfolio matches before generating — Proposal Studio. */
export async function previewPortfolioMatches(
  jobId: string,
  profileId?: number,
): Promise<PortfolioMatchPreview> {
  const params = profileId != null ? `?profile_id=${profileId}` : ''
  return apiFetch<PortfolioMatchPreview>(`/jobs/${jobId}/match-portfolio${params}`, {
    method: 'POST',
  })
}
