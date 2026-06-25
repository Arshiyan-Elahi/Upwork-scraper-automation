import { JobList } from '../components/jobs'

/** DATA SOURCE: mock only — filters mock jobs by maybe verdict. */
export function MaybeJobsPage() {
  return (
    <JobList
      title="Maybe Jobs"
      description="Opportunities saved for later review."
      verdictFilter="maybe"
    />
  )
}
