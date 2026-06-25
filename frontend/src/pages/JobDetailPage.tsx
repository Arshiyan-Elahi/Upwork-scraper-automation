import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ExternalLink, Sparkles, Target } from 'lucide-react'
import { scoreJobFit } from '../api/jobs'
import { listProfiles } from '../api/profiles'
import { listPortfolioItems } from '../api/portfolio'
import type { PortfolioItem } from '../types'
import { useJobs } from '../context/JobsContext'
import { buildVerdictExplanation } from '../utils/proposals'
import { AnalysisPanels } from '../components/jobs/AnalysisPanels'
import { FitBreakdown } from '../components/jobs/FitBreakdown'
import { PortfolioMatchList } from '../components/jobs/PortfolioMatchList'
import { ScoreBreakdownChart } from '../components/jobs/ScoreBreakdownChart'
import { VerdictExplanation } from '../components/jobs/VerdictExplanation'
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
} from '../components/ui'

const fitRecommendationLabel: Record<'apply' | 'maybe' | 'skip', string> = {
  apply: 'Apply',
  maybe: 'Maybe',
  skip: 'Skip',
}

function fitScoreColorClass(score: number): string {
  if (score >= 75) return 'text-semantic-success'
  if (score >= 45) return 'text-semantic-warning'
  return 'text-semantic-danger'
}

function matchPortfolioToJob(items: PortfolioItem[], jobSkills: string[]): PortfolioItem[] {
  if (jobSkills.length === 0) {
    return items.slice(0, 3)
  }
  const skillSet = new Set(jobSkills.map((s) => s.toLowerCase()))
  const matched = items.filter((item) =>
    item.skillTags.some((tag) => skillSet.has(tag.toLowerCase())),
  )
  return (matched.length > 0 ? matched : items).slice(0, 3)
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getJobById, syncInboxJob } = useJobs()
  const job = id ? getJobById(id) : undefined
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([])
  const [scoring, setScoring] = useState(false)
  const [scoreError, setScoreError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const profiles = await listProfiles()
        const active = profiles.find((p) => p.isActive) ?? profiles[0]
        if (!active) return
        const items = await listPortfolioItems(active.id)
        setPortfolioItems(items)
      } catch {
        setPortfolioItems([])
      }
    })()
  }, [])

  if (!job) {
    return (
      <div className="space-y-6">
        <Link
          to="/job-inbox"
          className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand-dark dark:text-brand-light"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to inbox
        </Link>
        <Card variant="glass" padding="lg" className="flex flex-col items-center py-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-semantic-danger-light dark:bg-semantic-danger-dark/30">
            <AlertTriangle className="h-7 w-7 text-semantic-danger dark:text-semantic-danger-light" />
          </div>
          <h1 className="text-lg font-semibold text-content dark:text-content-dark-default">
            Job not found
          </h1>
          <p className="mt-2 max-w-sm text-sm text-content-muted dark:text-content-dark-muted">
            No job exists with id &quot;{id}&quot;. It may have been removed or the link is invalid.
          </p>
          <Button variant="secondary" size="sm" className="mt-6" onClick={() => navigate('/job-inbox')}>
            Go to Job Inbox
          </Button>
        </Card>
      </div>
    )
  }

  const matchedPortfolio = useMemo(
    () => matchPortfolioToJob(portfolioItems, job.skills),
    [portfolioItems, job.skills],
  )
  const isScored = job.verdict !== null && job.scoreBreakdown !== null
  const verdictExplanation = isScored ? buildVerdictExplanation(job) : null

  const hasFit = job.fitScoredAt != null || job.fitScore != null
  const canScoreFit = /^\d+$/.test(job.id)

  const handleScoreFit = async () => {
    if (!canScoreFit || scoring) return
    setScoring(true)
    setScoreError(null)
    try {
      const updated = await scoreJobFit(job.id)
      syncInboxJob(updated)
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : 'Fit scoring failed.')
    } finally {
      setScoring(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/job-inbox"
        className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand-dark dark:text-brand-light"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to inbox
      </Link>

      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
          {job.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge source={job.source} />
          <BudgetBadge budget={job.budget} type={job.budgetType} />
          <VerdictBadge verdict={job.verdict} />
          <ScoreBadge score={job.matchScore} />
          <FitBadge score={job.fitScore} recommendation={job.fitRecommendation} />
          <StageBadge stage={job.stage} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card variant="default" padding="md" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-brand dark:text-brand-light" strokeWidth={2} />
                <h2 className="text-base font-semibold text-content dark:text-content-dark-default">
                  Profile Fit
                </h2>
              </div>
              {canScoreFit && (
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
            </div>

            {hasFit ? (
              <>
                <div className="flex flex-wrap items-end gap-4">
                  {job.fitScore != null && (
                    <div>
                      <span
                        className={`text-4xl font-bold tabular-nums ${fitScoreColorClass(job.fitScore)}`}
                      >
                        {Math.max(0, Math.min(100, job.fitScore))}
                      </span>
                      <span className="text-sm text-content-muted dark:text-content-dark-muted">
                        {' '}
                        / 100
                      </span>
                    </div>
                  )}
                  {job.fitRecommendation && (
                    <Badge
                      variant={
                        job.fitRecommendation === 'apply'
                          ? 'success'
                          : job.fitRecommendation === 'maybe'
                            ? 'warning'
                            : 'danger'
                      }
                      size="md"
                    >
                      Recommendation: {fitRecommendationLabel[job.fitRecommendation]}
                    </Badge>
                  )}
                </div>
                <FitBreakdown
                  reasons={job.fitReasons}
                  concerns={job.fitConcerns}
                  angle={job.fitAngle}
                />
              </>
            ) : (
              <p className="text-sm text-content-secondary dark:text-content-dark-secondary">
                {canScoreFit
                  ? 'This job has not been scored for profile fit yet. Run a fit score to see an apply/maybe/skip recommendation with reasons and a suggested pitch angle.'
                  : 'Profile fit scoring is available for jobs ingested into the inbox.'}
              </p>
            )}

            {scoreError && (
              <p className="text-xs text-semantic-danger dark:text-semantic-danger-light">
                {scoreError}
              </p>
            )}
          </Card>

          <Card variant="default" padding="md">
            <h2 className="mb-3 text-base font-semibold text-content dark:text-content-dark-default">
              Description
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-content-secondary dark:text-content-dark-secondary">
              {job.description || 'No description available.'}
            </p>
          </Card>

          {job.skills.length > 0 && (
            <Card variant="default" padding="md">
              <h2 className="mb-3 text-base font-semibold text-content dark:text-content-dark-default">
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <Badge key={skill} variant="info" size="sm">
                    {skill}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {isScored && job.scoreBreakdown && (
            <ScoreBreakdownChart breakdown={job.scoreBreakdown} />
          )}

          {isScored && verdictExplanation && job.verdict && (
            <VerdictExplanation
              title={verdictExplanation.title}
              body={verdictExplanation.body}
              verdict={job.verdict}
            />
          )}

          {job.redFlags.length > 0 && <RedFlagList flags={job.redFlags} />}

          <AnalysisPanels job={job} />

          <PortfolioMatchList items={matchedPortfolio} />
        </div>

        <div className="space-y-4">
          <Card variant="glass" padding="md" className="space-y-4">
            <Button
              variant="primary-gradient"
              className="w-full"
              onClick={() => navigate(`/proposal-studio/${job.id}`)}
            >
              <Sparkles className="h-4 w-4" />
              Open in Proposal Studio
            </Button>
            {job.jobUrl && (
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand-muted dark:border-border-dark dark:text-brand-light dark:hover:bg-brand-muted-dark/30"
              >
                View on Upwork
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
