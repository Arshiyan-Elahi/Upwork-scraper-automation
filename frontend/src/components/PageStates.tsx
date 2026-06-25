import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card } from './ui'

interface PageLoadingProps {
  label?: string
}

export function PageLoading({ label = 'Loading...' }: PageLoadingProps) {
  return (
    <Card variant="glass" padding="lg" className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-brand dark:text-brand-light" aria-hidden="true" />
      <p className="mt-4 text-sm text-content-muted dark:text-content-dark-muted">{label}</p>
    </Card>
  )
}

interface PageEmptyProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function PageEmpty({ title, description, action }: PageEmptyProps) {
  return (
    <Card variant="glass" padding="lg" className="flex flex-col items-center justify-center py-12 text-center">
      <h3 className="text-lg font-medium text-content dark:text-content-dark-default">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-content-muted dark:text-content-dark-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  )
}

interface PageErrorProps {
  title?: string
  message: string
  onRetry?: () => void
}

export function PageError({ title = 'Something went wrong', message, onRetry }: PageErrorProps) {
  return (
    <Card variant="glass" padding="lg" className="flex flex-col items-center justify-center py-12 text-center">
      <h3 className="text-lg font-medium text-semantic-danger dark:text-semantic-danger-light">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-content-muted dark:text-content-dark-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          className="mt-4 text-sm font-medium text-brand hover:text-brand-dark dark:text-brand-light"
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </Card>
  )
}

export function usePageLoading(delayMs = 400): boolean {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs])
  return loading
}
