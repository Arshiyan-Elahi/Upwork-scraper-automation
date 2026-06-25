import { JobList } from '../components/jobs'

/** DATA SOURCE: live backend API (GET /jobs) — not mock data. */
export function JobInboxPage() {
  return (
    <JobList
      title="Job Inbox"
      description="Review incoming job opportunities matched to your profile."
      dataSource="api"
    />
  )
}
