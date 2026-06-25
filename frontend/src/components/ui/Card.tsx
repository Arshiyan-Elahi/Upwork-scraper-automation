import { type HTMLAttributes, forwardRef } from 'react'

type CardVariant = 'default' | 'glass' | 'elevated'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const variantClasses: Record<CardVariant, string> = {
  default:
    'bg-surface border border-border shadow-card dark:bg-surface-dark-secondary dark:border-border-dark',
  glass: 'glass shadow-soft dark:shadow-glow-dark',
  elevated:
    'bg-surface border border-border shadow-elevated dark:bg-surface-dark-secondary dark:border-border-dark',
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-2xl ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'
