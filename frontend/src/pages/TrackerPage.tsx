import { useCallback, useEffect, useState } from 'react'
import { getJobs, patchJobStage } from '../api/jobs'
import { PageEmpty, PageError, PageLoading } from '../components/PageStates'
import { KanbanBoard } from '../components/tracker'
import type { Job, PipelineStage } from '../types'

/** DATA SOURCE: live backend API */
export function TrackerPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stageError, setStageError] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getJobs()
      setJobs(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const handleStageChange = async (jobId: string, stage: PipelineStage) => {
    const previous = jobs
    setStageError(null)
    setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, stage } : job)))
    try {
      const updated = await patchJobStage(jobId, stage)
      setJobs((prev) => prev.map((job) => (job.id === jobId ? updated.job : job)))
    } catch (err) {
      setJobs(previous)
      setStageError(err instanceof Error ? err.message : 'Failed to update stage.')
    }
  }

  if (loading) return <PageLoading label="Loading pipeline tracker..." />

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
            Pipeline Tracker
          </h1>
        </div>
        <PageError message={error} onRetry={() => void loadJobs()} />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
            Pipeline Tracker
          </h1>
          <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
            Drag jobs between stages or use the dropdown on each card to update pipeline status.
          </p>
        </div>
        <PageEmpty
          title="No jobs in pipeline yet"
          description="Send jobs from the Chrome extension webhook, then track them here as you draft and submit proposals."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
          Pipeline Tracker
        </h1>
        <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
          Drag jobs between stages or use the dropdown on each card to update pipeline status.
        </p>
      </div>

      {stageError && (
        <PageError message={stageError} onRetry={() => setStageError(null)} />
      )}

      <KanbanBoard jobs={jobs} onStageChange={handleStageChange} />
    </div>
  )
}
