import type { Verdict } from '../../types'
import { Card } from '../ui'

interface VerdictExplanationProps {
  title: string
  body: string
  verdict: Verdict
}

const accentBorder: Record<Verdict, string> = {
  apply: 'border-l-semantic-success',
  maybe: 'border-l-semantic-warning',
  skip: 'border-l-content-muted dark:border-l-content-dark-muted',
}

export function VerdictExplanation({ title, body, verdict }: VerdictExplanationProps) {
  return (
    <Card
      variant="glass"
      padding="md"
      className={`border-l-4 ${accentBorder[verdict]}`}
    >
      <h2 className="text-base font-semibold text-content dark:text-content-dark-default">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-content-secondary dark:text-content-dark-secondary">
        {body}
      </p>
    </Card>
  )
}
