import type { Job } from '../../types'
import { Badge, Card } from '../ui'

interface InfoRowProps {
  label: string
  value?: string | number
}

function InfoRow({ label, value }: InfoRowProps) {
  const display = value !== undefined && value !== null && value !== '' ? String(value) : null

  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-content-secondary dark:text-content-dark-secondary">{label}</dt>
      <dd
        className={
          display
            ? 'font-medium text-content dark:text-content-dark-default'
            : 'italic text-content-muted dark:text-content-dark-muted'
        }
      >
        {display ?? 'Not available'}
      </dd>
    </div>
  )
}

interface AnalysisPanelsProps {
  job: Job
}

export function AnalysisPanels({ job }: AnalysisPanelsProps) {
  const { clientInfo } = job
  const scored = job.scoreBreakdown !== null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card variant="default" padding="md">
        <h2 className="mb-3 text-base font-semibold text-content dark:text-content-dark-default">
          Budget analysis
        </h2>
        <dl className="divide-y divide-border dark:divide-border-dark">
          <InfoRow label="Budget range" value={job.budget ?? undefined} />
          <InfoRow label="Budget type" value={job.budgetType} />
          {scored && (
            <InfoRow
              label="Budget quality score"
              value={`${job.scoreBreakdown!.budgetQuality}/100`}
            />
          )}
          <InfoRow label="Competition" value={job.competition} />
        </dl>
      </Card>

      <Card variant="default" padding="md">
        <h2 className="mb-3 text-base font-semibold text-content dark:text-content-dark-default">
          Client analysis
        </h2>
        <dl className="divide-y divide-border dark:divide-border-dark">
          <InfoRow label="Client quality" value={job.clientQuality} />
          <InfoRow label="Total spend" value={clientInfo.spend} />
          <InfoRow label="Rating" value={clientInfo.rating} />
          <InfoRow label="Location" value={clientInfo.location} />
          <InfoRow label="Hire rate" value={clientInfo.hireRate} />
        </dl>
        {scored && (
          <div className="mt-3">
            <Badge variant="info" size="sm">
              Client quality score: {job.scoreBreakdown!.clientQuality}/100
            </Badge>
          </div>
        )}
      </Card>
    </div>
  )
}
