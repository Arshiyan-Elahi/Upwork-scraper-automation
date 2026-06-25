import type { Verdict } from '../../types'
import { Badge } from './Badge'

interface VerdictBadgeProps {
  verdict: Verdict | null
  className?: string
}

const verdictConfig: Record<Verdict, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  apply: { label: 'Apply', variant: 'success' },
  maybe: { label: 'Maybe', variant: 'warning' },
  skip: { label: 'Skip', variant: 'neutral' },
}

export function VerdictBadge({ verdict, className = '' }: VerdictBadgeProps) {
  if (verdict === null) {
    return (
      <Badge variant="neutral" size="sm" className={className}>
        Unscored
      </Badge>
    )
  }

  const { label, variant } = verdictConfig[verdict]

  return (
    <Badge variant={variant} size="sm" className={className}>
      {label}
    </Badge>
  )
}
