import { ExternalLink } from 'lucide-react'
import type { PortfolioItem } from '../../types'
import { Badge, Card } from '../ui'

interface PortfolioMatchListProps {
  items: PortfolioItem[]
}

export function PortfolioMatchList({ items }: PortfolioMatchListProps) {
  return (
    <Card variant="default" padding="md">
      <h2 className="mb-4 text-base font-semibold text-content dark:text-content-dark-default">
        Portfolio matches
      </h2>

      {items.length === 0 ? (
        <p className="text-sm italic text-content-muted dark:text-content-dark-muted">
          No portfolio matches identified for this job.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-border p-4 dark:border-border-dark"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-content dark:text-content-dark-default">
                    {item.title}
                  </h3>
                  <Badge variant="neutral" size="sm" className="mt-1">
                    {item.subCategory}
                  </Badge>
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark dark:text-brand-light"
                >
                  View
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {item.description && (
                <p className="mt-2 text-sm text-content-secondary dark:text-content-dark-secondary">
                  {item.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
