import { type ButtonHTMLAttributes, forwardRef } from 'react'

type ButtonVariant = 'primary-gradient' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  'primary-gradient':
    'bg-gradient-brand text-white shadow-card hover:opacity-95 hover:shadow-glow focus-visible:ring-brand-light',
  secondary:
    'bg-surface border border-border text-content shadow-soft hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:border-border-dark dark:text-content-dark-default dark:hover:bg-surface-dark-tertiary',
  ghost:
    'bg-transparent text-content-secondary hover:bg-surface-tertiary hover:text-content dark:text-content-dark-secondary dark:hover:bg-surface-dark-tertiary dark:hover:text-content-dark-default',
  danger:
    'bg-semantic-danger text-white shadow-soft hover:bg-semantic-danger-dark focus-visible:ring-semantic-danger-light',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      className = '',
      type = 'button',
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={`inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-secondary disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-surface-dark-default ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
