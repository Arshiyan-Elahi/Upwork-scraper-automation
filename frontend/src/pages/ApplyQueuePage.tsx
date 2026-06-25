import { JobList } from '../components/jobs'

/** DATA SOURCE: mock only — filters mock jobs by apply verdict. */
export function ApplyQueuePage() {
  return (
    <JobList
      title="Apply Queue"
      description="Jobs queued and ready for proposal submission."
      verdictFilter="apply"
    />
  )
}
