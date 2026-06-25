import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { jobs as initialJobs } from '../mockData'
import type { Job, PipelineStage } from '../types'

interface JobsContextValue {
  /** Mock jobs — used by Dashboard, verdict queues, tracker, etc. */
  jobs: Job[]
  /** Live jobs from GET /jobs — populated by Job Inbox only. */
  inboxJobs: Job[]
  setInboxJobs: (jobs: Job[]) => void
  syncInboxJob: (updated: Job) => void
  getJobById: (id: string) => Job | undefined
  updateJobStage: (id: string, stage: PipelineStage) => void
}

const JobsContext = createContext<JobsContextValue | null>(null)

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(() => initialJobs)
  const [inboxJobs, setInboxJobs] = useState<Job[]>([])

  const getJobById = useCallback(
    (id: string) => inboxJobs.find((job) => job.id === id) ?? jobs.find((job) => job.id === id),
    [inboxJobs, jobs],
  )

  const syncInboxJob = useCallback((updated: Job) => {
    setInboxJobs((prev) => prev.map((job) => (job.id === updated.id ? updated : job)))
  }, [])

  const updateJobStage = useCallback((id: string, stage: PipelineStage) => {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, stage } : job)))
    setInboxJobs((prev) => prev.map((job) => (job.id === id ? { ...job, stage } : job)))
  }, [])

  const value = useMemo(
    () => ({ jobs, inboxJobs, setInboxJobs, syncInboxJob, getJobById, updateJobStage }),
    [jobs, inboxJobs, getJobById, updateJobStage, syncInboxJob],
  )

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>
}

export function useJobs(): JobsContextValue {
  const context = useContext(JobsContext)
  if (!context) {
    throw new Error('useJobs must be used within a JobsProvider')
  }
  return context
}
