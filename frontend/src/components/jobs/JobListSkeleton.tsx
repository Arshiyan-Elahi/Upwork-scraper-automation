import { Card } from '../ui'

interface JobListSkeletonProps {
  count?: number
}

export function JobListSkeleton({ count = 4 }: JobListSkeletonProps) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading jobs">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} variant="default" padding="md" className="animate-pulse">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="h-5 flex-1 rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary" />
              <div className="h-5 w-10 rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary" />
              <div className="h-5 w-14 rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary" />
              <div className="h-6 w-24 rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary" />
              <div className="h-6 w-20 rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary" />
            </div>
            <div className="h-4 w-32 rounded-lg bg-surface-tertiary dark:bg-surface-dark-tertiary" />
          </div>
        </Card>
      ))}
    </div>
  )
}
