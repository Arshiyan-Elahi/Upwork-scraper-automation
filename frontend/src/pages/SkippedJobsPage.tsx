import { JobList } from '../components/jobs'

/** DATA SOURCE: mock only — filters mock jobs by skip verdict. */
export function SkippedJobsPage() {
  return (
    <JobList
      title="Skipped Jobs"
      description="Jobs you've passed on, with reasons and learnings."
      verdictFilter="skip"
    />
  )
}
