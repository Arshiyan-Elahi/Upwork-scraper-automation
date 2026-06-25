import type { PipelineStage, ScoreBreakdown } from '../types'

export const KANBAN_STAGES: PipelineStage[] = [
  'found',
  'drafted',
  'submitted',
  'viewed',
  'replied',
  'interview',
  'hired',
  'rejected',
  'archived',
]

export const STAGE_LABELS: Record<PipelineStage, string> = {
  found: 'Found',
  drafted: 'Drafted',
  submitted: 'Submitted',
  viewed: 'Viewed',
  replied: 'Replied',
  interview: 'Interview',
  hired: 'Hired',
  rejected: 'Rejected',
  archived: 'Archived',
}

export const SCORE_DIMENSIONS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'nicheMatch', label: 'Niche Match' },
  { key: 'budgetQuality', label: 'Budget Quality' },
  { key: 'clientQuality', label: 'Client Quality' },
  { key: 'competition', label: 'Competition' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'urgency', label: 'Urgency' },
  { key: 'portfolioMatch', label: 'Portfolio Match' },
  { key: 'conversionChance', label: 'Conversion Chance' },
]

export const PROPOSAL_OUTCOMES = ['replied', 'interview', 'hired', 'rejected'] as const

export type ProposalOutcome = (typeof PROPOSAL_OUTCOMES)[number]

export const PROPOSAL_RULES: string[] = [
  'No generic intro — open with something specific to the job.',
  'No AI-sounding language or filler phrases.',
  'No fake claims or exaggerated promises.',
  'Never say "perfect fit" or "ideal candidate".',
  'Do not lead with "years of experience".',
  'Avoid "my process would include" — show the process, don\'t announce it.',
  'Include relevant portfolio links when they strengthen the pitch.',
  'End with one smart discovery question, not a generic close.',
]
