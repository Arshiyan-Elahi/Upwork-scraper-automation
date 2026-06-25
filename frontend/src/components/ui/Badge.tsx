import { type HTMLAttributes } from 'react'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
}

const variantClasses: Record<BadgeVariant, string> = {
  success:
    'bg-semantic-success-light text-semantic-success-dark dark:bg-semantic-success-dark/30 dark:text-semantic-success-light',
  warning:
    'bg-semantic-warning-light text-semantic-warning-dark dark:bg-semantic-warning-dark/30 dark:text-semantic-warning-light',
  danger:
    'bg-semantic-danger-light text-semantic-danger-dark dark:bg-semantic-danger-dark/30 dark:text-semantic-danger-light',
  info: 'bg-semantic-info-light text-semantic-info-dark dark:bg-semantic-info-dark/30 dark:text-semantic-info-light',
  neutral:
    'bg-surface-tertiary text-content-secondary dark:bg-surface-dark-tertiary dark:text-content-dark-secondary',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export function Badge({
  variant = 'neutral',
  size = 'sm',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-lg font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
