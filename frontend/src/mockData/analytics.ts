import { dashboardMetrics } from './dashboardMetrics'
import type { AnalyticsInsight, AnalyticsTimePoint, AnalyticsVerdictPoint } from '../types'

export const jobsOverTime: AnalyticsTimePoint[] = [
  { date: 'Jun 1', jobs: 1, revenue: 0 },
  { date: 'Jun 3', jobs: 2, revenue: 950 },
  { date: 'Jun 5', jobs: 1, revenue: 0 },
  { date: 'Jun 7', jobs: 2, revenue: 1800 },
  { date: 'Jun 9', jobs: 2, revenue: 2400 },
  { date: 'Jun 11', jobs: 3, revenue: 0 },
  { date: 'Jun 13', jobs: 3, revenue: 1200 },
  { date: 'Jun 14', jobs: 1, revenue: 4500 },
]

export const verdictChartData: AnalyticsVerdictPoint[] = [
  { name: 'Apply', value: dashboardMetrics.applyJobs, fill: '#10b981' },
  { name: 'Maybe', value: dashboardMetrics.maybeJobs, fill: '#f59e0b' },
  { name: 'Skip', value: dashboardMetrics.skippedJobs, fill: '#94a3b8' },
]

export const pipelineMetrics = {
  proposalsDrafted: dashboardMetrics.proposalsDrafted,
  submitted: dashboardMetrics.submitted,
  replyRate: dashboardMetrics.replyRate,
  interviewRate:
    dashboardMetrics.submitted > 0
      ? Math.round((dashboardMetrics.interviews / dashboardMetrics.submitted) * 100)
      : 0,
  hireRate: dashboardMetrics.hireRate,
  revenueWon: dashboardMetrics.revenueWon,
}

export const bestPerformingNiche: AnalyticsInsight = {
  label: 'Best-performing niche',
  value: 'CPG packaging',
  detail: '3 wins · 67% reply rate on packaging jobs',
}

export const bestProposalStyle: AnalyticsInsight = {
  label: 'Best proposal style',
  value: 'Premium',
  detail: 'Highest hire rate when leading with case study + process',
}

export const bestPortfolioLinks: AnalyticsInsight[] = [
  {
    label: 'Luma Sparkling Water',
    value: '4 hires',
    detail: 'Referenced in 6 proposals · 50% reply rate',
  },
  {
    label: 'Northline Coffee',
    value: '3 hires',
    detail: 'Strong fit for F&B and hospitality jobs',
  },
  {
    label: 'Verdant Botanicals',
    value: '2 hires',
    detail: 'Top performer for wellness / organic brands',
  },
]
