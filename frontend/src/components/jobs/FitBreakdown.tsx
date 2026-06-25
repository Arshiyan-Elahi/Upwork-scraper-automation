import { AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react'

interface FitBreakdownProps {
  reasons?: string[]
  concerns?: string[]
  angle?: string
  className?: string
}

/** Renders the LLM fit reasons, concerns, and suggested pitch angle. */
export function FitBreakdown({ reasons = [], concerns = [], angle = '', className = '' }: FitBreakdownProps) {
  const hasContent = reasons.length > 0 || concerns.length > 0 || angle.trim().length > 0

  if (!hasContent) {
    return (
      <p className={`text-xs text-content-muted dark:text-content-dark-muted ${className}`}>
        No fit details available.
      </p>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {angle.trim() && (
        <div className="flex items-start gap-2 rounded-lg bg-brand-muted px-3 py-2 dark:bg-brand-muted-dark/30">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand dark:text-brand-light" strokeWidth={2} />
          <p className="text-xs text-content-secondary dark:text-content-dark-secondary">
            <span className="font-semibold text-content dark:text-content-dark-default">
              Suggested angle:{' '}
            </span>
            {angle}
          </p>
        </div>
      )}

      {reasons.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-content-dark-muted">
            Why it fits
          </h4>
          <ul className="space-y-1">
            {reasons.map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-1.5 text-xs text-content-secondary dark:text-content-dark-secondary"
              >
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-semantic-success" strokeWidth={2} />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {concerns.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-content-muted dark:text-content-dark-muted">
            Concerns
          </h4>
          <ul className="space-y-1">
            {concerns.map((concern) => (
              <li
                key={concern}
                className="flex items-start gap-1.5 text-xs text-content-secondary dark:text-content-dark-secondary"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-semantic-warning" strokeWidth={2} />
                <span>{concern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
