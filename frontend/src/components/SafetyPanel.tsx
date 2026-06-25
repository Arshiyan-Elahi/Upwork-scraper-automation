import { ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const SAFETY_POINTS = [
  'No auto-apply',
  'No browser automation',
  'No Upwork login',
  'No cookies',
  'No scraping from your account',
  'Manual submission only',
] as const

import { SAFETY_DISMISS_KEY } from '../constants/branding'

interface SafetyPanelProps {
  dismissible?: boolean
  className?: string
}

export function SafetyPanel({ dismissible = true, className = '' }: SafetyPanelProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (dismissible && localStorage.getItem(SAFETY_DISMISS_KEY) === 'true') {
      setDismissed(true)
    }
  }, [dismissible])

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(SAFETY_DISMISS_KEY, 'true')
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-semantic-success/30 bg-semantic-success-light/50 p-4 dark:border-semantic-success/20 dark:bg-semantic-success-dark/15 ${className}`}
      role="note"
      aria-label="Safety and compliance notice"
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-semantic-success/15 text-semantic-success-dark dark:bg-semantic-success/20 dark:text-semantic-success-light">
          <ShieldCheck className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-semantic-success-dark dark:text-semantic-success-light">
            Your account stays yours — always manual, always safe
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {SAFETY_POINTS.map((point) => (
              <li
                key={point}
                className="text-xs text-semantic-success-dark/90 dark:text-semantic-success-light/90"
              >
                · {point}
              </li>
            ))}
          </ul>
        </div>
        {dismissible && (
          <button
            type="button"
            aria-label="Dismiss safety notice"
            className="shrink-0 rounded-lg p-1 text-semantic-success-dark/70 hover:bg-semantic-success/10 dark:text-semantic-success-light/70"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
