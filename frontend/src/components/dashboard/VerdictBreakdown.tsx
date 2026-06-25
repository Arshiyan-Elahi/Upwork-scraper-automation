import { Link } from 'react-router-dom'
import { Card } from '../ui'

interface VerdictBreakdownProps {
  apply: number
  maybe: number
  skipped: number
  total: number
}

export function VerdictBreakdown({ apply, maybe, skipped, total }: VerdictBreakdownProps) {
  const segments = [
    {
      key: 'apply',
      label: 'Apply',
      count: apply,
      href: '/apply-queue',
      barClass: 'bg-semantic-success',
      textClass: 'text-semantic-success-dark dark:text-semantic-success-light',
    },
    {
      key: 'maybe',
      label: 'Maybe',
      count: maybe,
      href: '/maybe-jobs',
      barClass: 'bg-semantic-warning',
      textClass: 'text-semantic-warning-dark dark:text-semantic-warning-light',
    },
    {
      key: 'skip',
      label: 'Skip',
      count: skipped,
      href: '/skipped-jobs',
      barClass: 'bg-content-muted dark:bg-content-dark-muted',
      textClass: 'text-content-secondary dark:text-content-dark-secondary',
    },
  ] as const

  return (
    <Card variant="default" padding="md">
      <h2 className="mb-4 text-base font-semibold text-content dark:text-content-dark-default">
        Verdict breakdown
      </h2>

      <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary">
        {segments.map((seg) => {
          const width = total > 0 ? (seg.count / total) * 100 : 0
          if (width === 0) return null
          return (
            <div
              key={seg.key}
              className={`${seg.barClass} transition-all`}
              style={{ width: `${width}%` }}
              title={`${seg.label}: ${seg.count}`}
            />
          )
        })}
      </div>

      <ul className="space-y-3">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0
          return (
            <li key={seg.key}>
              <Link
                to={seg.href}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${seg.barClass}`} />
                  <span className={`text-sm font-medium ${seg.textClass}`}>{seg.label}</span>
                </div>
                <div className="text-sm tabular-nums text-content-secondary dark:text-content-dark-secondary">
                  {seg.count}{' '}
                  <span className="text-content-muted dark:text-content-dark-muted">({pct}%)</span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
