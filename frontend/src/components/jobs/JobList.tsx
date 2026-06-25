import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Target } from 'lucide-react'
import { getJobs, scoreFitBatch, scoreJobFit } from '../../api/jobs'
import { useJobs } from '../../context/JobsContext'
import type { Verdict } from '../../types'
import {
  defaultJobListFilters,
  filterJobs,
  sortJobs,
  type JobListFilters,
} from '../../utils/jobs'
import { PageEmpty, PageError } from '../PageStates'
import { Button } from '../ui'
import { JobCard } from './JobCard'
import { JobEmptyState } from './JobEmptyState'
import { JobListSkeleton } from './JobListSkeleton'
import { JobListToolbar } from './JobListToolbar'

/** 'mock' = JobsContext mock data; 'api' = live GET /jobs (Job Inbox only). */
export type JobListDataSource = 'mock' | 'api'

interface JobListProps {
  title: string
  description?: string
  verdictFilter?: Verdict
  dataSource?: JobListDataSource
}

export function JobList({
  title,
  description,
  verdictFilter,
  dataSource = 'mock',
}: JobListProps) {
  const { jobs: mockJobs, inboxJobs, setInboxJobs, syncInboxJob } = useJobs()
  const [filters, setFilters] = useState<JobListFilters>(() => ({
    ...defaultJobListFilters,
    verdict: verdictFilter ?? 'all',
  }))
  const [loading, setLoading] = useState(dataSource === 'api')
  const [error, setError] = useState<string | null>(null)
  const [batchScoring, setBatchScoring] = useState(false)
  const [scoreNotice, setScoreNotice] = useState<string | null>(null)

  const loadApiJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const jobs = await getJobs()
      setInboxJobs(jobs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs from the backend.')
    } finally {
      setLoading(false)
    }
  }, [setInboxJobs])

  useEffect(() => {
    if (dataSource !== 'api') {
      const timer = window.setTimeout(() => setLoading(false), 450)
      return () => window.clearTimeout(timer)
    }
    void loadApiJobs()
  }, [dataSource, loadApiJobs])

  const handleScoreFit = useCallback(
    async (jobId: string) => {
      const updated = await scoreJobFit(jobId)
      syncInboxJob(updated)
    },
    [syncInboxJob],
  )

  const handleScoreAll = useCallback(async () => {
    setBatchScoring(true)
    setScoreNotice(null)
    try {
      const result = await scoreFitBatch({ onlyUnscored: true })
      result.jobs.forEach((job) => syncInboxJob(job))
      const failedNote = result.failed > 0 ? `, ${result.failed} failed` : ''
      setScoreNotice(
        result.total === 0
          ? 'All jobs already have a fit score.'
          : `Scored ${result.scored} of ${result.total} jobs${failedNote}.`,
      )
    } catch (err) {
      setScoreNotice(err instanceof Error ? err.message : 'Bulk fit scoring failed.')
    } finally {
      setBatchScoring(false)
    }
  }, [syncInboxJob])

  const allJobs = dataSource === 'api' ? inboxJobs : mockJobs

  const baseJobs = useMemo(
    () => (verdictFilter ? allJobs.filter((job) => job.verdict === verdictFilter) : allJobs),
    [allJobs, verdictFilter],
  )

  const filteredJobs = useMemo(() => {
    const filtered = filterJobs(baseJobs, filters, verdictFilter)
    return sortJobs(filtered, filters.sortBy, filters.sortDirection)
  }, [baseJobs, filters, verdictFilter])

  const handleResetFilters = () => {
    setFilters({
      ...defaultJobListFilters,
      verdict: verdictFilter ?? 'all',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
              {description}
            </p>
          )}
        </div>
        {dataSource === 'api' && !loading && !error && (
          <div className="flex flex-wrap items-center gap-2">
            {scoreNotice && (
              <span className="text-xs text-content-secondary dark:text-content-dark-secondary">
                {scoreNotice}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleScoreAll()}
              disabled={batchScoring}
            >
              <Target className="h-4 w-4" />
              {batchScoring ? 'Scoring fit…' : 'Score All Fit'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadApiJobs()}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        )}
      </div>

      <JobListToolbar
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={filteredJobs.length}
        totalCount={baseJobs.length}
        hideVerdictFilter={verdictFilter !== undefined}
      />

      {loading ? (
        <JobListSkeleton count={4} />
      ) : error ? (
        <PageError
          title="Could not load jobs"
          message={error}
          onRetry={dataSource === 'api' ? () => void loadApiJobs() : undefined}
        />
      ) : filteredJobs.length === 0 ? (
        baseJobs.length === 0 ? (
          <PageEmpty
            title={dataSource === 'api' ? 'No jobs in inbox yet' : 'No jobs to show'}
            description={
              dataSource === 'api'
                ? 'Send jobs from the Chrome extension webhook to populate the inbox, then refresh this page.'
                : undefined
            }
            action={
              dataSource === 'api' ? (
                <button
                  type="button"
                  className="text-sm font-medium text-brand hover:text-brand-dark dark:text-brand-light"
                  onClick={() => void loadApiJobs()}
                >
                  Refresh
                </button>
              ) : undefined
            }
          />
        ) : (
          <JobEmptyState onResetFilters={handleResetFilters} />
        )
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onScoreFit={dataSource === 'api' ? () => handleScoreFit(job.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
