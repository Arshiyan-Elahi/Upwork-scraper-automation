import { useMemo } from 'react'
import type { Job, PipelineStage } from '../../types'
import { KANBAN_STAGES } from '../../constants/pipeline'
import { KanbanColumn } from './KanbanColumn'

interface KanbanBoardProps {
  jobs: Job[]
  onStageChange: (jobId: string, stage: PipelineStage) => void
}

export function KanbanBoard({ jobs, onStageChange }: KanbanBoardProps) {
  const jobsByStage = useMemo(() => {
    const map = Object.fromEntries(KANBAN_STAGES.map((s) => [s, [] as Job[]])) as Record<
      PipelineStage,
      Job[]
    >
    for (const job of jobs) {
      map[job.stage].push(job)
    }
    return map
  }, [jobs])

  const handleDrop = (jobId: string, stage: PipelineStage) => {
    onStageChange(jobId, stage)
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4" style={{ minWidth: 'min-content' }}>
        {KANBAN_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            jobs={jobsByStage[stage]}
            onStageChange={onStageChange}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  )
}
