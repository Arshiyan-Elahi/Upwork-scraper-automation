import type { JobSource } from '../../types'
import { Bot, Globe, Mail, PenLine, Puzzle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface SourceBadgeProps {
  source: JobSource
  className?: string
}

interface SourceConfig {
  label: string
  icon: LucideIcon
  classes: string
}

const sourceConfig: Record<JobSource, SourceConfig> = {
  email: {
    label: 'Email',
    icon: Mail,
    classes:
      'bg-semantic-info-light text-semantic-info-dark dark:bg-semantic-info-dark/30 dark:text-semantic-info-light',
  },
  apify: {
    label: 'Apify',
    icon: Bot,
    classes:
      'bg-brand-muted text-brand-dark dark:bg-brand-muted-dark/40 dark:text-brand-light',
  },
  api: {
    label: 'API',
    icon: Globe,
    classes:
      'bg-semantic-success-light text-semantic-success-dark dark:bg-semantic-success-dark/30 dark:text-semantic-success-light',
  },
  manual: {
    label: 'Manual',
    icon: PenLine,
    classes:
      'bg-surface-tertiary text-content-secondary dark:bg-surface-dark-tertiary dark:text-content-dark-secondary',
  },
  extension: {
    label: 'Extension',
    icon: Puzzle,
    classes:
      'bg-brand-muted text-brand-dark dark:bg-brand-muted-dark/40 dark:text-brand-light',
  },
}

export function SourceBadge({ source, className = '' }: SourceBadgeProps) {
  const { label, icon: Icon, classes } = sourceConfig[source]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium ${classes} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      {label}
    </span>
  )
}
