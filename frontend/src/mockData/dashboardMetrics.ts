import type { DashboardMetrics, PipelineStage } from '../types'
import { jobs } from './jobs'
import { proposalDrafts } from './proposalDrafts'

const SUBMITTED_STAGES: PipelineStage[] = [
  'submitted',
  'viewed',
  'replied',
  'interview',
  'hired',
  'rejected',
]

function countByVerdict(verdict: 'apply' | 'maybe' | 'skip'): number {
  return jobs.filter((job) => job.verdict === verdict).length
}

function countByStage(stages: PipelineStage[]): number {
  return jobs.filter((job) => stages.includes(job.stage)).length
}

const submitted = countByStage(SUBMITTED_STAGES)
const replies = countByStage(['replied', 'interview', 'hired'])
const interviews = countByStage(['interview', 'hired'])
const hired = countByStage(['hired'])

export const dashboardMetrics: DashboardMetrics = {
  totalJobs: jobs.length,
  applyJobs: countByVerdict('apply'),
  maybeJobs: countByVerdict('maybe'),
  skippedJobs: countByVerdict('skip'),
  proposalsDrafted: proposalDrafts.length,
  submitted,
  replies,
  interviews,
  hired,
  revenueWon: 4500,
  replyRate: submitted > 0 ? Math.round((replies / submitted) * 100) : 0,
  hireRate: submitted > 0 ? Math.round((hired / submitted) * 100) : 0,
}
