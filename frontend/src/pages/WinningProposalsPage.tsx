import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import {
  createWinningProposal,
  deleteWinningProposal,
  getWinningProposals,
} from '../api/proposals'
import type { WinningProposal } from '../types'
import { PageEmpty, PageError, PageLoading } from '../components/PageStates'
import { Badge, Button, Card } from '../components/ui'
import { formatCurrency } from '../utils/jobs'
import { inputClassName, labelClassName, textareaClassName } from '../utils/form'

const emptyForm = {
  jobTitle: '',
  text: '',
  niche: '',
  outcome: '',
  revenue: '',
  notes: '',
}

/** DATA SOURCE: live backend API (GET/POST/DELETE /winning-proposals). */
export function WinningProposalsPage() {
  const [proposals, setProposals] = useState<WinningProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const loadProposals = useCallback(async () => {
    setError(null)
    try {
      setProposals(await getWinningProposals())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load winning proposals.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProposals()
  }, [loadProposals])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.jobTitle.trim() || !form.text.trim()) return
    setSaving(true)
    setError(null)
    try {
      const created = await createWinningProposal({
        job_title: form.jobTitle.trim(),
        text: form.text.trim(),
        niche: form.niche.trim() || undefined,
        outcome: form.outcome.trim() || undefined,
        revenue: form.revenue ? Number.parseFloat(form.revenue) : undefined,
        notes: form.notes.trim() || undefined,
      })
      setProposals((prev) => [created, ...prev])
      setForm(emptyForm)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save proposal.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    try {
      await deleteWinningProposal(id)
      setProposals((prev) => prev.filter((p) => p.id !== id))
      if (expandedId === id) setExpandedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete proposal.')
    }
  }

  if (loading) return <PageLoading label="Loading winning proposals..." />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
            Winning Proposals
          </h1>
          <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
            Archive proposals that won jobs — used as style references when generating new ones.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowForm((p) => !p)}>
          <Plus className="h-4 w-4" />
          Add winning proposal
        </Button>
      </div>

      <Card variant="glass" padding="md">
        <p className="text-sm text-content-secondary dark:text-content-dark-secondary">
          These examples teach the AI your voice — structure, tone, and angles that converted. They are
          injected into Proposal Studio generations (not used for ML training).
        </p>
      </Card>

      {error && (
        <PageError message={error} onRetry={() => void loadProposals()} />
      )}

      {showForm && (
        <Card variant="default" padding="md">
          <form onSubmit={(e) => void handleAdd(e)} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClassName}>Job title</label>
              <input
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                className={inputClassName}
                required
              />
            </div>
            <div>
              <label className={labelClassName}>Niche</label>
              <input
                value={form.niche}
                onChange={(e) => setForm({ ...form, niche: e.target.value })}
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>Outcome</label>
              <input
                value={form.outcome}
                onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                placeholder="hired, interviewed, viewed..."
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>Revenue ($)</label>
              <input
                type="number"
                value={form.revenue}
                onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                className={inputClassName}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClassName}>Full proposal text</label>
              <textarea
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                rows={5}
                className={textareaClassName}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClassName}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className={textareaClassName}
              />
            </div>
            <Button type="submit" variant="primary-gradient" size="sm" disabled={saving}>
              {saving ? 'Saving...' : 'Save proposal'}
            </Button>
          </form>
        </Card>
      )}

      {proposals.length === 0 ? (
        <PageEmpty
          title="No winning proposals yet"
          description="Add proposals that won jobs to improve AI tone matching in Proposal Studio."
        />
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => {
            const isExpanded = expandedId === proposal.id
            return (
              <Card key={proposal.id} variant="default" padding="md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-content dark:text-content-dark-default">
                      {proposal.jobTitle}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {proposal.niche && (
                        <Badge variant="info" size="sm">
                          {proposal.niche}
                        </Badge>
                      )}
                      {proposal.outcome && (
                        <Badge variant="success" size="sm">
                          {proposal.outcome}
                        </Badge>
                      )}
                      {proposal.revenue > 0 && (
                        <Badge variant="neutral" size="sm">
                          {formatCurrency(proposal.revenue)}
                        </Badge>
                      )}
                    </div>
                    {proposal.notes && (
                      <p className="mt-2 text-sm text-content-muted dark:text-content-dark-muted">
                        {proposal.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : proposal.id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" /> Hide
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" /> Read full text
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(proposal.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <p className="mt-4 rounded-xl bg-surface-secondary p-4 text-sm leading-relaxed text-content-secondary dark:bg-surface-dark-tertiary dark:text-content-dark-secondary">
                    {proposal.text}
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
