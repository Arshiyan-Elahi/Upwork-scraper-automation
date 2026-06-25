import type { BudgetType } from '../../types'
import { Badge } from './Badge'

interface BudgetBadgeProps {
  budget: string | null
  type: BudgetType
  className?: string
}

const typeLabels: Record<BudgetType, string> = {
  fixed: 'Fixed',
  hourly: 'Hourly',
  unknown: 'TBD',
}

export function BudgetBadge({ budget, type, className = '' }: BudgetBadgeProps) {
  const displayBudget = budget ?? '—'

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Badge variant="neutral" size="sm">
        {displayBudget}
      </Badge>
      <Badge variant="info" size="sm">
        {typeLabels[type]}
      </Badge>
    </span>
  )
}
