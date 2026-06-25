import type { PipelineStage } from '../../types'
import { Badge } from './Badge'

interface StageBadgeProps {
  stage: PipelineStage
  className?: string
}

const stageConfig: Record<
  PipelineStage,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  found: { label: 'Found', variant: 'neutral' },
  drafted: { label: 'Drafted', variant: 'info' },
  submitted: { label: 'Submitted', variant: 'info' },
  viewed: { label: 'Viewed', variant: 'info' },
  replied: { label: 'Replied', variant: 'warning' },
  interview: { label: 'Interview', variant: 'warning' },
  hired: { label: 'Hired', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  archived: { label: 'Archived', variant: 'neutral' },
}

export function StageBadge({ stage, className = '' }: StageBadgeProps) {
  const { label, variant } = stageConfig[stage]

  return (
    <Badge variant={variant} size="sm" className={className}>
      {label}
    </Badge>
  )
}
