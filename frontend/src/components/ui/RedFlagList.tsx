import { AlertTriangle } from 'lucide-react'

interface RedFlagListProps {
  flags: string[]
  className?: string
}

export function RedFlagList({ flags, className = '' }: RedFlagListProps) {
  if (flags.length === 0) {
    return null
  }

  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} role="list">
      {flags.map((flag) => (
        <li key={flag}>
          <span className="inline-flex items-center gap-1 rounded-lg bg-semantic-danger-light px-2 py-0.5 text-xs font-medium text-semantic-danger-dark dark:bg-semantic-danger-dark/30 dark:text-semantic-danger-light">
            <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2} />
            {flag}
          </span>
        </li>
      ))}
    </ul>
  )
}
