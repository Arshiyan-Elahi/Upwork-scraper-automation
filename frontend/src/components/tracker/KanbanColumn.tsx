import type { DragEvent } from 'react'
import type { Job, PipelineStage } from '../../types'
import { STAGE_LABELS } from '../../constants/pipeline'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
  stage: PipelineStage
  jobs: Job[]
  onStageChange: (jobId: string, stage: PipelineStage) => void
  onDrop: (jobId: string, stage: PipelineStage) => void
}

export function KanbanColumn({ stage, jobs, onStageChange, onDrop }: KanbanColumnProps) {
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    const jobId = e.dataTransfer.getData('text/job-id')
    if (jobId) onDrop(jobId, stage)
  }

  return (
    <div
      className="flex w-64 shrink-0 flex-col rounded-2xl border border-border/60 bg-surface-secondary/50 dark:border-border-dark/60 dark:bg-surface-dark-default/50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5 dark:border-border-dark/60">
        <h3 className="text-sm font-semibold text-content dark:text-content-dark-default">
          {STAGE_LABELS[stage]}
        </h3>
        <span className="rounded-lg bg-surface-tertiary px-2 py-0.5 text-xs font-medium tabular-nums text-content-secondary dark:bg-surface-dark-tertiary dark:text-content-dark-secondary">
          {jobs.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ minHeight: '120px' }}>
        {jobs.length === 0 ? (
          <p className="py-4 text-center text-xs italic text-content-muted dark:text-content-dark-muted">
            Drop jobs here
          </p>
        ) : (
          jobs.map((job) => (
            <KanbanCard key={job.id} job={job} onStageChange={onStageChange} />
          ))
        )}
      </div>
    </div>
  )
}
