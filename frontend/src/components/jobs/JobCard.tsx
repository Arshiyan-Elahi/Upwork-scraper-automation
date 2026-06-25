import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Eye,
  FolderOpen,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import type { ClientQuality, CompetitionLevel, Job } from '../../types'
import {
  Badge,
  BudgetBadge,
  Button,
  Card,
  FitBadge,
  RedFlagList,
  ScoreBadge,
  SourceBadge,
  StageBadge,
  VerdictBadge,
} from '../ui'
import { FitBreakdown } from './FitBreakdown'

interface JobCardProps {
  job: Job
  /** When provided, renders a "Score Fit" action that runs LLM fit scoring. */
  onScoreFit?: () => Promise<void>
}

const clientQualityVariant: Record<
  ClientQuality,
  'success' | 'info' | 'warning' | 'neutral'
> = {
  high: 'success',
  medium: 'info',
  low: 'warning',
  unknown: 'neutral',
}

const competitionVariant: Record<CompetitionLevel, 'success' | 'warning' | 'danger' | 'neutral'> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  unknown: 'neutral',
}

function portfolioMatchLabel(count: number): string {
  if (count === 0) return 'No match'
  if (count === 1) return '1 portfolio match'
  return `${count} portfolio matches`
}

export function JobCard({ job, onScoreFit }: JobCardProps) {
  const navigate = useNavigate()
  const matchCount = job.portfolioMatchIds.length
  const [scoring, setScoring] = useState(false)
  const [scoreError, setScoreError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const hasFit = job.fitScoredAt != null || job.fitScore != null
  const reasons = job.fitReasons ?? []
  const concerns = job.fitConcerns ?? []
  const hasFitDetails = reasons.length > 0 || concerns.length > 0 || (job.fitAngle ?? '').trim().length > 0

  const handleScoreFit = async () => {
    if (!onScoreFit || scoring) return
    setScoring(true)
    setScoreError(null)
    try {
      await onScoreFit()
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : 'Fit scoring failed.')
    } finally {
      setScoring(false)
    }
  }

  return (
    <Card variant="default" padding="md" className="transition-shadow hover:shadow-elevated">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start gap-2">
            <h3 className="text-base font-semibold text-content dark:text-content-dark-default">
              {job.title}
            </h3>
            <ScoreBadge score={job.matchScore} />
            <VerdictBadge verdict={job.verdict} />
            <FitBadge score={job.fitScore} recommendation={job.fitRecommendation} />
            <StageBadge stage={job.stage} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={job.source} />
            <BudgetBadge budget={job.budget} type={job.budgetType} />
            <Badge variant={clientQualityVariant[job.clientQuality]} size="sm">
              <Users className="mr-1 inline h-3 w-3" strokeWidth={2} />
              {job.clientQuality} client
            </Badge>
            <Badge variant={competitionVariant[job.competition]} size="sm">
              {job.competition} competition
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                matchCount > 0
                  ? 'text-brand dark:text-brand-light'
                  : 'text-content-muted dark:text-content-dark-muted'
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" strokeWidth={2} />
              {portfolioMatchLabel(matchCount)}
            </span>
          </div>

          <RedFlagList flags={job.redFlags} />

          {hasFit && hasFitDetails && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark dark:text-brand-light"
                aria-expanded={expanded}
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                {expanded ? 'Hide fit details' : 'Why this fit?'}
              </button>
              {expanded && (
                <div className="rounded-lg border border-border bg-surface-secondary/50 p-3 dark:border-border-dark dark:bg-surface-dark-tertiary/40">
                  <FitBreakdown reasons={reasons} concerns={concerns} angle={job.fitAngle} />
                </div>
              )}
            </div>
          )}

          {scoreError && (
            <p className="text-xs text-semantic-danger dark:text-semantic-danger-light">{scoreError}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/jobs/${job.id}`)}>
            <Eye className="h-3.5 w-3.5" />
            View
          </Button>
          <Button
            variant="primary-gradient"
            size="sm"
            onClick={() => navigate(`/proposal-studio/${job.id}`)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Proposal
          </Button>
          {onScoreFit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleScoreFit()}
              disabled={scoring}
            >
              <Target className="h-3.5 w-3.5" />
              {scoring ? 'Scoring…' : hasFit ? 'Re-score Fit' : 'Score Fit'}
            </Button>
          )}
          <Button variant="ghost" size="sm">
            <Bookmark className="h-3.5 w-3.5" />
            Save
          </Button>
          <Button variant="ghost" size="sm">
            <Archive className="h-3.5 w-3.5" />
            Archive
          </Button>
        </div>
      </div>
    </Card>
  )
}
