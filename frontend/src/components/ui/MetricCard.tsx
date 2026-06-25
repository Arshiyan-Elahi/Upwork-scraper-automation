import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from './Card'

interface MetricCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: number
  accent?: 'brand' | 'success' | 'warning' | 'info' | 'danger' | 'neutral'
  className?: string
}

const accentClasses: Record<NonNullable<MetricCardProps['accent']>, string> = {
  brand: 'bg-gradient-brand-subtle text-brand dark:text-brand-light',
  success: 'bg-semantic-success-light text-semantic-success-dark dark:bg-semantic-success-dark/30 dark:text-semantic-success-light',
  warning: 'bg-semantic-warning-light text-semantic-warning-dark dark:bg-semantic-warning-dark/30 dark:text-semantic-warning-light',
  info: 'bg-semantic-info-light text-semantic-info-dark dark:bg-semantic-info-dark/30 dark:text-semantic-info-light',
  danger: 'bg-semantic-danger-light text-semantic-danger-dark dark:bg-semantic-danger-dark/30 dark:text-semantic-danger-light',
  neutral: 'bg-surface-tertiary text-content-secondary dark:bg-surface-dark-tertiary dark:text-content-dark-secondary',
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  accent = 'brand',
  className = '',
}: MetricCardProps) {
  const hasTrend = trend !== undefined && trend !== 0
  const trendUp = trend !== undefined && trend > 0

  return (
    <Card variant="default" padding="md" className={`relative overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary">
            {title}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
            {value}
          </p>
          {hasTrend && (
            <div
              className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${
                trendUp
                  ? 'text-semantic-success dark:text-semantic-success-light'
                  : 'text-semantic-danger dark:text-semantic-danger-light'
              }`}
            >
              {trendUp ? (
                <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {trendUp ? '+' : ''}
              {trend}%
            </div>
          )}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentClasses[accent]}`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  )
}
