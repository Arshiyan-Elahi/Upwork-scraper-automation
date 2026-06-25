import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Tag,
} from 'lucide-react'
import { getJob, getJobs, patchJobOutcome, patchJobSubmittedProposal } from '../api/jobs'
import { listProfiles } from '../api/profiles'
import {
  generateProposal,
  previewPortfolioMatches,
  type GeneratedProposalVariant,
  type PortfolioMatchItem,
  type PortfolioMatchPreview,
  type ProposalPipelineResult,
} from '../api/proposals'
import { PROPOSAL_OUTCOMES, STAGE_LABELS } from '../constants/pipeline'
import { useJobs } from '../context/JobsContext'
import type { FreelancerProfile, Job, JobOutcome } from '../types'
import { ProposalRulesPanel } from '../components/proposals'
import { PageEmpty, PageError, PageLoading } from '../components/PageStates'
import { Badge, Button, Card, RedFlagList, StageBadge } from '../components/ui'
import { labelClassName, textareaClassName } from '../utils/form'

interface EditableVariant extends GeneratedProposalVariant {
  saved?: boolean
}

function connectsVariant(rec: string): 'success' | 'warning' | 'neutral' {
  if (rec === 'yes') return 'success'
  if (rec === 'maybe') return 'warning'
  return 'neutral'
}

function generationProviders(metadata: ProposalPipelineResult['metadata']): string {
  const providers = Object.entries(metadata.providers_used)
    .filter(([key]) => key.startsWith('generate_proposals') || key === 'generate_follow_up')
    .map(([, value]) => value.replace(':failed', ''))
  const unique = [...new Set(providers)]
  return unique.length > 0 ? unique.join(', ') : 'unknown'
}

/** DATA SOURCE: live backend API — real jobs + POST /jobs/{id}/generate-proposal. */
export function ProposalStudioPage() {
  const { jobId: paramJobId } = useParams<{ jobId?: string }>()
  const navigate = useNavigate()
  const { syncInboxJob } = useJobs()

  const [jobs, setJobs] = useState<Job[]>([])
  const [profiles, setProfiles] = useState<FreelancerProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedJobId, setSelectedJobId] = useState(paramJobId ?? '')
  const [customInstructions, setCustomInstructions] = useState('')
  const [generating, setGenerating] = useState(false)
  const [previewingMatches, setPreviewingMatches] = useState(false)
  const [matchPreview, setMatchPreview] = useState<PortfolioMatchPreview | null>(null)
  const [attachedLinks, setAttachedLinks] = useState<PortfolioMatchItem[]>([])
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [showOutcomePicker, setShowOutcomePicker] = useState(false)
  const [savingStage, setSavingStage] = useState(false)
  const [result, setResult] = useState<ProposalPipelineResult | null>(null)
  const [variants, setVariants] = useState<EditableVariant[]>([])
  const [followUp, setFollowUp] = useState('')
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [submitVariantLabel, setSubmitVariantLabel] = useState('')
  const [hireNotice, setHireNotice] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    setLoadError(null)
    try {
      const [rows, profileRows] = await Promise.all([getJobs(), listProfiles()])
      setJobs(rows)
      setProfiles(profileRows)
      const active = profileRows.find((p) => p.isActive) ?? profileRows[0]
      if (active) {
        setSelectedProfileId((prev) => prev ?? active.id)
      }
      if (paramJobId && rows.some((j) => j.id === paramJobId)) {
        setSelectedJobId(paramJobId)
      } else if (rows.length > 0 && !selectedJobId) {
        setSelectedJobId(rows[0].id)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load jobs.')
    } finally {
      setLoadingJobs(false)
    }
  }, [paramJobId, selectedJobId])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  useEffect(() => {
    if (paramJobId && paramJobId !== selectedJobId && jobs.some((j) => j.id === paramJobId)) {
      setSelectedJobId(paramJobId)
    }
  }, [paramJobId, selectedJobId, jobs])

  const job = useMemo(
    () => jobs.find((j) => j.id === selectedJobId),
    [jobs, selectedJobId],
  )

  const updateLocalJob = useCallback(
    (updated: Job) => {
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)))
      syncInboxJob(updated)
    },
    [syncInboxJob],
  )

  const handleJobChange = (newJobId: string) => {
    setSelectedJobId(newJobId)
    setResult(null)
    setVariants([])
    setFollowUp('')
    setMatchPreview(null)
    setAttachedLinks([])
    navigate(`/proposal-studio/${newJobId}`, { replace: true })
  }

  const handleProfileChange = (profileId: number) => {
    setSelectedProfileId(profileId)
    setMatchPreview(null)
    setAttachedLinks([])
  }

  const runMatchPreview = async () => {
    if (!selectedJobId || selectedProfileId == null) return
    setPreviewingMatches(true)
    setGenerateError(null)
    try {
      const preview = await previewPortfolioMatches(selectedJobId, selectedProfileId)
      setMatchPreview(preview)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Portfolio match preview failed.')
    } finally {
      setPreviewingMatches(false)
    }
  }

  const runGeneration = async () => {
    if (!selectedJobId) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const pipelineResult = await generateProposal(selectedJobId, {
        n_variants: 3,
        custom_instructions: customInstructions.trim(),
        profile_id: selectedProfileId ?? undefined,
      })
      setResult(pipelineResult)
      const links =
        pipelineResult.portfolio_matches ??
        pipelineResult.metadata.portfolio_links_attached ??
        []
      setAttachedLinks(links)
      setMatchPreview(null)
      const nextVariants = pipelineResult.proposals.map((p) => ({ ...p }))
      setVariants(nextVariants)
      setSubmitVariantLabel(nextVariants[0]?.variant_label ?? '')
      setFollowUp(pipelineResult.follow_up)
      const refreshed = await getJob(selectedJobId)
      updateLocalJob(refreshed)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Proposal generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const updateVariantText = (label: string, text: string) => {
    setVariants((prev) =>
      prev.map((v) => (v.variant_label === label ? { ...v, text } : v)),
    )
  }

  const handleCopy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedLabel(label)
    window.setTimeout(() => setCopiedLabel(null), 2000)
  }

  const submitVariant = useMemo(
    () => variants.find((v) => v.variant_label === submitVariantLabel) ?? variants[0],
    [variants, submitVariantLabel],
  )

  const handleMarkSubmitted = async () => {
    if (!selectedJobId) return
    if (!submitVariant?.text.trim()) {
      setPipelineError('Generate proposals first, then select the variant you sent.')
      return
    }
    setPipelineError(null)
    setHireNotice(null)
    setSavingStage(true)
    try {
      const updated = await patchJobSubmittedProposal(
        selectedJobId,
        submitVariant.text.trim(),
        submitVariant.variant_label,
      )
      updateLocalJob(updated)
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Failed to mark as submitted.')
    } finally {
      setSavingStage(false)
    }
  }

  const handleOutcome = async (outcome: JobOutcome) => {
    if (!selectedJobId) return
    setPipelineError(null)
    setHireNotice(null)
    setSavingStage(true)
    try {
      const { job: updated, winningProposalCreated } = await patchJobOutcome(selectedJobId, outcome)
      updateLocalJob(updated)
      setShowOutcomePicker(false)
      if (outcome === 'hired' && winningProposalCreated) {
        setHireNotice('Added to Winning Proposals as a style reference for future generations.')
        window.setTimeout(() => setHireNotice(null), 6000)
      }
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Failed to save outcome.')
    } finally {
      setSavingStage(false)
    }
  }

  if (loadingJobs) return <PageLoading label="Loading proposal studio..." />

  if (loadError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-content dark:text-content-dark-default">
          Proposal Studio
        </h1>
        <PageError message={loadError} onRetry={() => void loadJobs()} />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <PageEmpty
        title="No ingested jobs yet"
        description="Send jobs from the Chrome extension webhook, then open a job from Job Inbox to generate proposals."
      />
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to={job ? `/jobs/${job.id}` : '/job-inbox'}
        className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand-dark dark:text-brand-light"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to job
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
            Proposal Studio
          </h1>
          <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
            Generate scored proposal variants from real ingested jobs.
          </p>
        </div>
        <div className="min-w-[280px]">
          <label htmlFor="job-select" className={labelClassName}>
            Job
          </label>
          <select
            id="job-select"
            value={selectedJobId}
            onChange={(e) => handleJobChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-border-dark dark:bg-surface-dark-tertiary dark:text-content-dark-default"
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
        {profiles.length > 0 && (
          <div className="min-w-[220px]">
            <label htmlFor="profile-select" className={labelClassName}>
              Profile
            </label>
            <select
              id="profile-select"
              value={selectedProfileId ?? ''}
              onChange={(e) => handleProfileChange(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-border-dark dark:bg-surface-dark-tertiary dark:text-content-dark-default"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isActive ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {job && (
        <Card variant="glass" padding="md" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-content dark:text-content-dark-default">{job.title}</p>
            <StageBadge stage={job.stage} />
            {job.outcome && <StageBadge stage={job.outcome} />}
          </div>
          <p className="text-xs text-content-muted dark:text-content-dark-muted">
            {job.budget ?? 'Budget unknown'} · {job.skills.slice(0, 4).join(', ')}
          </p>
          <div className="flex flex-wrap gap-2">
            {variants.length > 0 && (
              <div className="min-w-[200px]">
                <label htmlFor="submit-variant" className={labelClassName}>
                  Variant to submit
                </label>
                <select
                  id="submit-variant"
                  value={submitVariantLabel}
                  onChange={(e) => setSubmitVariantLabel(e.target.value)}
                  className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-border-dark dark:bg-surface-dark-tertiary dark:text-content-dark-default"
                >
                  {variants.map((v) => (
                    <option key={v.variant_label} value={v.variant_label}>
                      {v.variant_label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
            <Button
              variant="primary-gradient"
              size="sm"
              onClick={() => void handleMarkSubmitted()}
              disabled={savingStage || job.stage === 'submitted' || variants.length === 0}
            >
              <Send className="h-3.5 w-3.5" />
              {job.stage === 'submitted' ? 'Submitted' : 'Mark as Manually Submitted'}
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOutcomePicker((prev) => !prev)}
                disabled={savingStage}
              >
                <Tag className="h-3.5 w-3.5" />
                Add Outcome
              </Button>
              {showOutcomePicker && (
                <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-border bg-surface py-1 shadow-elevated dark:border-border-dark dark:bg-surface-dark-secondary">
                  {PROPOSAL_OUTCOMES.map((outcome) => (
                    <button
                      key={outcome}
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm text-content hover:bg-surface-tertiary dark:text-content-dark-default dark:hover:bg-surface-dark-tertiary"
                      onClick={() => void handleOutcome(outcome)}
                    >
                      {STAGE_LABELS[outcome]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
        </Card>
      )}

      {hireNotice && (
        <div className="rounded-xl border border-semantic-success/30 bg-semantic-success/10 px-4 py-3 text-sm text-semantic-success dark:border-semantic-success/40 dark:bg-semantic-success/15 dark:text-semantic-success-light">
          {hireNotice}
        </div>
      )}

      {pipelineError && (
        <PageError message={pipelineError} onRetry={() => setPipelineError(null)} />
      )}

      <ProposalRulesPanel />

      <Card variant="default" padding="md" className="space-y-4">
        <div>
          <label htmlFor="custom-instructions" className={labelClassName}>
            Custom instructions (optional)
          </label>
          <textarea
            id="custom-instructions"
            rows={3}
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g. keep it under 120 words, emphasize my packaging work, more casual tone…"
            className={textareaClassName}
          />
          <p className="mt-1 text-xs text-content-muted dark:text-content-dark-muted">
            Added on top of your saved voice rules and profile — not a replacement. Edit and
            regenerate anytime.
          </p>
        </div>

        <Button
          variant="primary-gradient"
          onClick={() => void runGeneration()}
          disabled={generating || !selectedJobId || selectedProfileId == null}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating… (~10s, multiple AI calls)
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {result ? 'Regenerate proposals' : 'Generate proposals'}
            </>
          )}
        </Button>

        <Button
          variant="secondary"
          onClick={() => void runMatchPreview()}
          disabled={previewingMatches || !selectedJobId || selectedProfileId == null}
        >
          {previewingMatches ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Previewing matches…
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Preview portfolio matches
            </>
          )}
        </Button>
      </Card>

      {matchPreview && (
        <Card variant="glass" padding="md" className="space-y-3">
          <h2 className="text-sm font-semibold text-content dark:text-content-dark-default">
            Portfolio match preview
          </h2>
          {matchPreview.matches.length === 0 ? (
            <p className="text-sm text-content-secondary dark:text-content-dark-secondary">
              No strong portfolio matches for this job. Proposals will use &quot;I can share
              relevant samples if needed&quot; instead of attaching links.
            </p>
          ) : (
            <ul className="space-y-2">
              {matchPreview.matches.map((match) => (
                <li
                  key={match.portfolio_item_id}
                  className="rounded-lg border border-border px-3 py-2 dark:border-border-dark"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-content dark:text-content-dark-default">
                      {match.title}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {match.match_score}%
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-content-muted dark:text-content-dark-muted">
                    {match.reason}
                    {match.matched_tags.length > 0 && ` · ${match.matched_tags.join(', ')}`}
                  </p>
                  <a
                    href={match.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-brand hover:underline dark:text-brand-light"
                  >
                    {match.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {generateError && (
        <PageError message={generateError} onRetry={() => void runGeneration()} />
      )}

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card variant="default" padding="md">
              <p className="text-xs font-medium uppercase text-content-muted dark:text-content-dark-muted">
                Match score
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-brand dark:text-brand-light">
                {result.match.match_score}
              </p>
              {result.match.matched_skills.length > 0 && (
                <p className="mt-2 text-xs text-content-secondary dark:text-content-dark-secondary">
                  Matched: {result.match.matched_skills.join(', ')}
                </p>
              )}
              {result.match.missing_skills.length > 0 && (
                <p className="mt-1 text-xs text-content-muted dark:text-content-dark-muted">
                  Missing: {result.match.missing_skills.join(', ')}
                </p>
              )}
            </Card>

            <Card variant="default" padding="md">
              <p className="text-xs font-medium uppercase text-content-muted dark:text-content-dark-muted">
                Bid recommendation
              </p>
              <p className="mt-1 text-sm font-semibold text-content dark:text-content-dark-default">
                {result.bid.suggested_rate_or_range || '—'}
              </p>
              <p className="mt-2 text-xs text-content-secondary dark:text-content-dark-secondary">
                {result.bid.reasoning}
              </p>
            </Card>

            <Card variant="default" padding="md">
              <p className="text-xs font-medium uppercase text-content-muted dark:text-content-dark-muted">
                Worth Connects?
              </p>
              <Badge
                variant={connectsVariant(result.bid.connects_recommendation)}
                size="md"
                className="mt-2"
              >
                {result.bid.connects_recommendation.toUpperCase()}
              </Badge>
              <p className="mt-2 text-xs text-content-secondary dark:text-content-dark-secondary">
                {result.bid.connects_reason}
              </p>
            </Card>

            <Card variant="default" padding="md">
              <p className="text-xs font-medium uppercase text-content-muted dark:text-content-dark-muted">
                Generation
              </p>
              <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
                {(result.metadata.total_latency_ms / 1000).toFixed(1)}s total
              </p>
              <p className="mt-1 text-xs text-content-muted dark:text-content-dark-muted">
                Providers: {generationProviders(result.metadata)}
              </p>
            </Card>
          </div>

          {result.red_flags.length > 0 && (
            <Card variant="default" padding="md">
              <h2 className="mb-2 text-sm font-semibold text-content dark:text-content-dark-default">
                Red flags
              </h2>
              <RedFlagList flags={result.red_flags} />
            </Card>
          )}

          <Card variant="default" padding="md" className="space-y-3">
            <h2 className="text-sm font-semibold text-content dark:text-content-dark-default">
              Portfolio links attached
            </h2>
            {attachedLinks.length === 0 ? (
              <p className="text-sm text-content-secondary dark:text-content-dark-secondary">
                No portfolio links were attached — the proposals should offer to share samples
                on request instead.
              </p>
            ) : (
              <ul className="space-y-2">
                {attachedLinks.map((link) => (
                  <li
                    key={link.portfolio_item_id}
                    className="rounded-lg border border-border px-3 py-2 dark:border-border-dark"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-content dark:text-content-dark-default">
                        {link.title}
                      </span>
                      <Badge variant="success" size="sm">
                        {link.match_score}%
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-content-muted dark:text-content-dark-muted">
                      {link.reason}
                    </p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-brand hover:underline dark:text-brand-light"
                    >
                      {link.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-4">
            {variants.map((variant) => (
              <Card key={variant.variant_label} variant="default" padding="md" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-content dark:text-content-dark-default">
                    {variant.variant_label}
                  </h3>
                  {variant.scores && (
                    <div className="flex flex-wrap gap-2 text-xs tabular-nums text-content-muted dark:text-content-dark-muted">
                      <span>P {variant.scores.personalization}</span>
                      <span>S {variant.scores.specificity}</span>
                      <span>V {variant.scores.value}</span>
                      <span>CTA {variant.scores.call_to_action}</span>
                      <span className="font-semibold text-brand dark:text-brand-light">
                        Overall {variant.scores.overall}
                      </span>
                    </div>
                  )}
                </div>
                <textarea
                  rows={8}
                  value={variant.text}
                  onChange={(e) => updateVariantText(variant.variant_label, e.target.value)}
                  onFocus={() => setSubmitVariantLabel(variant.variant_label)}
                  className={textareaClassName}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleCopy(variant.variant_label, variant.text)}
                  >
                    {copiedLabel === variant.variant_label ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setVariants((prev) =>
                        prev.map((v) =>
                          v.variant_label === variant.variant_label ? { ...v, saved: true } : v,
                        ),
                      )
                    }
                  >
                    <Save className="h-3.5 w-3.5" />
                    {variant.saved ? 'Draft saved' : 'Save draft'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void runGeneration()} disabled={generating}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {followUp && (
            <Card variant="glass" padding="md" className="space-y-2">
              <h2 className="text-sm font-semibold text-content dark:text-content-dark-default">
                3-day follow-up
              </h2>
              <textarea
                rows={4}
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className={textareaClassName}
              />
              <Button variant="secondary" size="sm" onClick={() => void handleCopy('follow-up', followUp)}>
                <Copy className="h-3.5 w-3.5" /> Copy follow-up
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
