import { Link } from 'react-router-dom'
import type { Job } from '../../types'
import { formatRelativeDate } from '../../utils/jobs'
import { Card, ScoreBadge, SourceBadge, VerdictBadge } from '../ui'

interface RecentJobsListProps {
  jobs: Job[]
}

export function RecentJobsList({ jobs }: RecentJobsListProps) {
  return (
    <Card variant="default" padding="md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-content dark:text-content-dark-default">
          Recent jobs
        </h2>
        <Link
          to="/job-inbox"
          className="text-xs font-medium text-brand hover:text-brand-dark dark:text-brand-light dark:hover:text-brand"
        >
          View all
        </Link>
      </div>

      <ul className="divide-y divide-border dark:divide-border-dark">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              to={`/jobs/${job.id}`}
              className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-surface-secondary/80 dark:hover:bg-surface-dark-tertiary/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content dark:text-content-dark-default">
                  {job.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <SourceBadge source={job.source} />
                  <span className="text-xs text-content-muted dark:text-content-dark-muted">
                    {formatRelativeDate(job.receivedDate)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ScoreBadge score={job.matchScore} />
                <VerdictBadge verdict={job.verdict} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
