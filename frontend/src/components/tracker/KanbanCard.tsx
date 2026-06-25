import type { DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Job, PipelineStage } from '../../types'
import { KANBAN_STAGES, STAGE_LABELS } from '../../constants/pipeline'
import { ScoreBadge, StageBadge, VerdictBadge } from '../ui'

interface KanbanCardProps {
  job: Job
  onStageChange: (jobId: string, stage: PipelineStage) => void
}

export function KanbanCard({ job, onStageChange }: KanbanCardProps) {
  const navigate = useNavigate()

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/job-id', job.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="cursor-grab rounded-xl border border-border bg-surface p-3 shadow-soft transition-shadow active:cursor-grabbing hover:shadow-card dark:border-border-dark dark:bg-surface-dark-secondary"
    >
      <button
        type="button"
        className="mb-2 w-full text-left text-sm font-medium text-content hover:text-brand dark:text-content-dark-default dark:hover:text-brand-light"
        onClick={() => navigate(`/jobs/${job.id}`)}
      >
        {job.title}
      </button>

      <div className="mb-2 flex flex-wrap gap-1">
        <ScoreBadge score={job.matchScore} />
        <VerdictBadge verdict={job.verdict} />
        <StageBadge stage={job.stage} />
        {job.outcome && <StageBadge stage={job.outcome} />}
      </div>

      <select
        value={job.stage}
        onChange={(e) => onStageChange(job.id, e.target.value as PipelineStage)}
        className="mt-1 w-full rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs text-content focus:border-brand focus:outline-none dark:border-border-dark dark:bg-surface-dark-tertiary dark:text-content-dark-default"
        aria-label={`Move ${job.title} to stage`}
        onClick={(e) => e.stopPropagation()}
      >
        {KANBAN_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {STAGE_LABELS[stage]}
          </option>
        ))}
      </select>
    </div>
  )
}
