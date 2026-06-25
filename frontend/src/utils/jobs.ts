import type { ClientQuality, Job, JobSource, Verdict } from '../types'

export type JobSortField = 'score' | 'fitScore' | 'receivedDate' | 'budget'

export interface JobListFilters {
  search: string
  source: JobSource | 'all'
  verdict: Verdict | 'all'
  recommendation: Verdict | 'all'
  clientQuality: ClientQuality | 'all'
  sortBy: JobSortField
  sortDirection: 'asc' | 'desc'
}

export const defaultJobListFilters: JobListFilters = {
  search: '',
  source: 'all',
  verdict: 'all',
  recommendation: 'all',
  clientQuality: 'all',
  sortBy: 'receivedDate',
  sortDirection: 'desc',
}

export function parseBudgetValue(budget: string | null): number {
  if (!budget) return -1
  const match = budget.replace(/,/g, '').match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : -1
}

export function filterJobs(jobs: Job[], filters: JobListFilters, verdictPreset?: Verdict): Job[] {
  const searchLower = filters.search.trim().toLowerCase()

  return jobs.filter((job) => {
    if (verdictPreset && job.verdict !== verdictPreset) return false
    if (filters.verdict !== 'all') {
      if (job.verdict === null) return false
      if (job.verdict !== filters.verdict) return false
    }
    if (filters.recommendation !== 'all') {
      if (!job.fitRecommendation) return false
      if (job.fitRecommendation !== filters.recommendation) return false
    }
    if (filters.source !== 'all' && job.source !== filters.source) return false
    if (filters.clientQuality !== 'all' && job.clientQuality !== filters.clientQuality) return false

    if (searchLower) {
      const inTitle = job.title.toLowerCase().includes(searchLower)
      const inSkills = job.skills.some((skill) => skill.toLowerCase().includes(searchLower))
      if (!inTitle && !inSkills) return false
    }

    return true
  })
}

export function sortJobs(jobs: Job[], sortBy: JobSortField, direction: 'asc' | 'desc'): Job[] {
  const sorted = [...jobs].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'score':
        comparison = (a.matchScore ?? -1) - (b.matchScore ?? -1)
        break
      case 'fitScore':
        comparison = (a.fitScore ?? -1) - (b.fitScore ?? -1)
        break
      case 'receivedDate':
        comparison = new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime()
        break
      case 'budget':
        comparison = parseBudgetValue(a.budget) - parseBudgetValue(b.budget)
        break
    }

    return direction === 'asc' ? comparison : -comparison
  })

  return sorted
}

export function getRecentJobs(jobs: Job[], limit = 5): Job[] {
  return sortJobs(jobs, 'receivedDate', 'desc').slice(0, limit)
}

export function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}
