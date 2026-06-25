import { Target } from 'lucide-react'
import type { Verdict } from '../../types'
import { Badge } from './Badge'

interface FitBadgeProps {
  score: number | null | undefined
  recommendation: Verdict | null | undefined
  className?: string
}

const recommendationConfig: Record<
  Verdict,
  { label: string; variant: 'success' | 'warning' | 'danger' }
> = {
  apply: { label: 'Apply', variant: 'success' },
  maybe: { label: 'Maybe', variant: 'warning' },
  skip: { label: 'Skip', variant: 'danger' },
}

function scoreVariant(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 75) return 'success'
  if (score >= 45) return 'warning'
  return 'danger'
}

/** Shows the LLM job-fit score and its apply/maybe/skip recommendation. */
export function FitBadge({ score, recommendation, className = '' }: FitBadgeProps) {
  if (score == null && recommendation == null) {
    return null
  }

  const rec = recommendation ? recommendationConfig[recommendation] : null
  const variant = rec?.variant ?? (score != null ? scoreVariant(score) : 'neutral')

  return (
    <Badge variant={variant} size="sm" className={`tabular-nums ${className}`}>
      <Target className="mr-1 inline h-3 w-3" strokeWidth={2} />
      Fit{score != null ? ` ${Math.max(0, Math.min(100, score))}` : ''}
      {rec ? ` · ${rec.label}` : ''}
    </Badge>
  )
}
