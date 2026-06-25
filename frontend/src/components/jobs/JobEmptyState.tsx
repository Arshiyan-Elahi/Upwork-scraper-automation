import { Inbox, RotateCcw } from 'lucide-react'
import { Button, Card } from '../ui'

interface JobEmptyStateProps {
  onResetFilters?: () => void
}

export function JobEmptyState({ onResetFilters }: JobEmptyStateProps) {
  return (
    <Card variant="glass" padding="lg" className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-tertiary dark:bg-surface-dark-tertiary">
        <Inbox className="h-7 w-7 text-content-muted dark:text-content-dark-muted" strokeWidth={1.75} />
      </div>
      <h3 className="text-lg font-medium text-content dark:text-content-dark-default">
        No jobs match your filters
      </h3>
      <p className="mt-2 max-w-sm text-sm text-content-muted dark:text-content-dark-muted">
        Try adjusting your search or filter criteria to see more opportunities.
      </p>
      {onResetFilters && (
        <Button variant="secondary" size="sm" className="mt-6" onClick={onResetFilters}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset filters
        </Button>
      )}
    </Card>
  )
}
