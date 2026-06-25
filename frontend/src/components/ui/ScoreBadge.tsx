import { Badge } from './Badge'

interface ScoreBadgeProps {
  score: number | null
  className?: string
}

type ScoreTier = 'high' | 'mid' | 'low'

function getScoreTier(score: number): ScoreTier {
  if (score >= 70) return 'high'
  if (score >= 40) return 'mid'
  return 'low'
}

const tierVariant: Record<ScoreTier, 'success' | 'warning' | 'danger'> = {
  high: 'success',
  mid: 'warning',
  low: 'danger',
}

export function ScoreBadge({ score, className = '' }: ScoreBadgeProps) {
  if (score === null) {
    return null
  }

  const clamped = Math.max(0, Math.min(100, score))
  const variant = tierVariant[getScoreTier(clamped)]

  return (
    <Badge variant={variant} size="sm" className={`tabular-nums ${className}`}>
      {clamped}
    </Badge>
  )
}
