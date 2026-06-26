import { type ReactNode } from 'react'
import { APP_NAME } from '../../constants/branding'
import { AppLogo, Card } from '../ui'

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary p-4 dark:bg-surface-dark-default">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center gap-2">
            <AppLogo size="md" />
            <span className="text-base font-semibold text-content dark:text-content-dark-default">
              {APP_NAME}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-content dark:text-content-dark-default">
            {title}
          </h1>
          <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
            {subtitle}
          </p>
        </div>

        <Card variant="elevated" padding="lg">
          {children}
        </Card>

        {footer && (
          <p className="mt-5 text-center text-sm text-content-secondary dark:text-content-dark-secondary">
            {footer}
          </p>
        )}
      </div>
    </div>
  )
}

export const authInputClass =
  'h-10 w-full rounded-xl border border-border bg-surface/80 px-3.5 text-sm text-content placeholder:text-content-muted transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-border-dark dark:bg-surface-dark-tertiary/80 dark:text-content-dark-default dark:placeholder:text-content-dark-muted dark:focus:border-brand-light'

export const authInputErrorClass =
  'border-semantic-danger focus:border-semantic-danger focus:ring-semantic-danger/20 dark:border-semantic-danger-light'

export const authLabelClass =
  'mb-1.5 block text-sm font-medium text-content dark:text-content-dark-default'
