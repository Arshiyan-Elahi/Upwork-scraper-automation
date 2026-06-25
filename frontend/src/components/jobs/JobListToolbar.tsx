import { Search, SlidersHorizontal } from 'lucide-react'
import type { ClientQuality, JobSource, Verdict } from '../../types'
import type { JobListFilters, JobSortField } from '../../utils/jobs'
import { Card } from '../ui'

interface JobListToolbarProps {
  filters: JobListFilters
  onFiltersChange: (filters: JobListFilters) => void
  resultCount: number
  totalCount: number
  hideVerdictFilter?: boolean
}

const sourceOptions: { value: JobSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'extension', label: 'Extension' },
  { value: 'apify', label: 'Apify' },
  { value: 'manual', label: 'Manual' },
]

const verdictOptions: { value: Verdict | 'all'; label: string }[] = [
  { value: 'all', label: 'All verdicts' },
  { value: 'apply', label: 'Apply' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'skip', label: 'Skip' },
]

const recommendationOptions: { value: Verdict | 'all'; label: string }[] = [
  { value: 'all', label: 'All fit recs' },
  { value: 'apply', label: 'Fit: Apply' },
  { value: 'maybe', label: 'Fit: Maybe' },
  { value: 'skip', label: 'Fit: Skip' },
]

const qualityOptions: { value: ClientQuality | 'all'; label: string }[] = [
  { value: 'all', label: 'All clients' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'unknown', label: 'Unknown' },
]

const sortOptions: { value: JobSortField; label: string }[] = [
  { value: 'fitScore', label: 'Fit score' },
  { value: 'score', label: 'Match score' },
  { value: 'receivedDate', label: 'Received date' },
  { value: 'budget', label: 'Budget' },
]

const selectClassName =
  'h-9 rounded-xl border border-border bg-surface px-3 text-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-border-dark dark:bg-surface-dark-tertiary dark:text-content-dark-default dark:focus:border-brand-light'

export function JobListToolbar({
  filters,
  onFiltersChange,
  resultCount,
  totalCount,
  hideVerdictFilter = false,
}: JobListToolbarProps) {
  const update = (partial: Partial<JobListFilters>) => {
    onFiltersChange({ ...filters, ...partial })
  }

  return (
    <Card variant="glass" padding="md" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-content-secondary dark:text-content-dark-secondary">
          <SlidersHorizontal className="h-4 w-4" />
          <span>
            Showing <strong className="text-content dark:text-content-dark-default">{resultCount}</strong>{' '}
            of {totalCount} jobs
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="relative sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted dark:text-content-dark-muted" />
          <input
            type="search"
            placeholder="Search title or skills..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className={`${selectClassName} w-full pl-10`}
            aria-label="Search jobs"
          />
        </div>

        <select
          value={filters.source}
          onChange={(e) => update({ source: e.target.value as JobSource | 'all' })}
          className={selectClassName}
          aria-label="Filter by source"
        >
          {sourceOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {!hideVerdictFilter && (
          <select
            value={filters.verdict}
            onChange={(e) => update({ verdict: e.target.value as Verdict | 'all' })}
            className={selectClassName}
            aria-label="Filter by verdict"
          >
            {verdictOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        <select
          value={filters.recommendation}
          onChange={(e) => update({ recommendation: e.target.value as Verdict | 'all' })}
          className={selectClassName}
          aria-label="Filter by fit recommendation"
        >
          {recommendationOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filters.clientQuality}
          onChange={(e) => update({ clientQuality: e.target.value as ClientQuality | 'all' })}
          className={selectClassName}
          aria-label="Filter by client quality"
        >
          {qualityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filters.sortBy}
          onChange={(e) => update({ sortBy: e.target.value as JobSortField })}
          className={selectClassName}
          aria-label="Sort by"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filters.sortDirection}
          onChange={(e) => update({ sortDirection: e.target.value as 'asc' | 'desc' })}
          className={selectClassName}
          aria-label="Sort direction"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>
    </Card>
  )
}
