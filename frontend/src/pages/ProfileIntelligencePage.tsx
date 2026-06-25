import { useCallback, useEffect, useState } from 'react'
import { Plus, Sparkles, Trash2, UserCheck } from 'lucide-react'
import {
  activateProfile,
  createProfile,
  deleteProfile,
  extractedToFingerprint,
  listProfiles,
  updateProfile,
} from '../api/profiles'
import type { ExtractedProfile, FreelancerProfile } from '../types'
import { FingerprintCard } from '../components/profile/FingerprintCard'
import { PageEmpty, PageError, PageLoading } from '../components/PageStates'
import { Badge, Button, Card } from '../components/ui'
import { inputClassName, labelClassName, textareaClassName } from '../utils/form'

export function ProfileIntelligencePage() {
  const [profiles, setProfiles] = useState<FreelancerProfile[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [profileText, setProfileText] = useState('')
  const [upworkUrl, setUpworkUrl] = useState('')
  const [behanceUrl, setBehanceUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  const selected = profiles.find((p) => p.id === selectedId) ?? null

  const loadProfiles = useCallback(async () => {
    setError(null)
    try {
      const rows = await listProfiles()
      setProfiles(rows)
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev
        return rows.find((r) => r.isActive)?.id ?? rows[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    if (selected) {
      setName(selected.name)
      setProfileText(selected.rawInput)
      setUpworkUrl(selected.upworkProfileUrl ?? '')
      setBehanceUrl(selected.behanceUrl ?? '')
      setShowNewForm(false)
    }
  }, [selected])

  const handleSelect = (id: number) => {
    setSelectedId(id)
    setError(null)
  }

  const handleCreate = async () => {
    if (!name.trim() || !profileText.trim()) {
      setError('Name and profile text are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await createProfile({
        name: name.trim(),
        rawText: profileText.trim(),
        upworkProfileUrl: upworkUrl.trim() || undefined,
        behanceUrl: behanceUrl.trim() || undefined,
      })
      await loadProfiles()
      setSelectedId(created.id)
      setShowNewForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!selected) return
    if (!profileText.trim()) {
      setError('Profile text must not be empty.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateProfile(selected.id, {
        name: name.trim() || selected.name,
        rawText: profileText.trim(),
        upworkProfileUrl: upworkUrl.trim() || null,
        behanceUrl: behanceUrl.trim() || null,
      })
      await loadProfiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile extraction failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await activateProfile(selected.id)
      await loadProfiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected || !window.confirm(`Delete profile "${selected.name}"?`)) return
    setSaving(true)
    setError(null)
    try {
      await deleteProfile(selected.id)
      setSelectedId(null)
      await loadProfiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoading label="Loading profile intelligence..." />

  const extracted: ExtractedProfile | null = selected?.extracted ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
          Profile Intelligence
        </h1>
        <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
          Manage multiple freelancer profiles — Gemini extracts a structured fingerprint for matching and proposals.
        </p>
      </div>

      {error && (
        <PageError message={error} onRetry={() => setError(null)} />
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <Card variant="default" padding="md" className="lg:w-72 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-content dark:text-content-dark-default">Profiles</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNewForm(true)
                setSelectedId(null)
                setName('')
                setProfileText('')
                setUpworkUrl('')
                setBehanceUrl('')
              }}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {profiles.length === 0 ? (
            <p className="text-sm text-content-muted dark:text-content-dark-muted">No profiles yet.</p>
          ) : (
            <ul className="space-y-1">
              {profiles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(p.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === p.id && !showNewForm
                        ? 'bg-brand-muted text-brand-dark dark:bg-brand-muted-dark/40 dark:text-brand-light'
                        : 'hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary'
                    }`}
                  >
                    <span className="font-medium truncate">{p.name}</span>
                    {p.isActive && (
                      <Badge variant="success" size="sm">
                        Active
                      </Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="min-w-0 flex-1 space-y-6">
          {(showNewForm || profiles.length === 0) ? (
            <Card variant="default" padding="md" className="space-y-4">
              <h2 className="text-base font-semibold text-content dark:text-content-dark-default">
                New profile
              </h2>
              <div>
                <label className={labelClassName}>Profile name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Logo Design"
                  className={inputClassName}
                />
              </div>
              <div>
                <label className={labelClassName}>Upwork profile text</label>
                <textarea
                  rows={8}
                  value={profileText}
                  onChange={(e) => setProfileText(e.target.value)}
                  placeholder="Paste your full Upwork profile overview..."
                  className={textareaClassName}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClassName}>Upwork profile URL (optional)</label>
                  <input
                    value={upworkUrl}
                    onChange={(e) => setUpworkUrl(e.target.value)}
                    className={inputClassName}
                    placeholder="https://www.upwork.com/..."
                  />
                </div>
                <div>
                  <label className={labelClassName}>Behance URL (optional)</label>
                  <input
                    value={behanceUrl}
                    onChange={(e) => setBehanceUrl(e.target.value)}
                    className={inputClassName}
                    placeholder="https://www.behance.net/..."
                  />
                </div>
              </div>
              <Button variant="primary-gradient" disabled={saving} onClick={() => void handleCreate()}>
                <Sparkles className={`h-4 w-4 ${saving ? 'animate-pulse' : ''}`} />
                {saving ? 'Extracting...' : 'Create & extract fingerprint'}
              </Button>
            </Card>
          ) : selected ? (
            <>
              <Card variant="default" padding="md" className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-content dark:text-content-dark-default">
                    {selected.name}
                  </h2>
                  {selected.isActive ? (
                    <Badge variant="success" size="sm">Active for proposals</Badge>
                  ) : (
                    <Button variant="secondary" size="sm" disabled={saving} onClick={() => void handleActivate()}>
                      <UserCheck className="h-4 w-4" />
                      Set active
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" disabled={saving} onClick={() => void handleDelete()}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
                <div>
                  <label className={labelClassName}>Profile name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} />
                </div>
                <div>
                  <label className={labelClassName}>Upwork profile text</label>
                  <textarea
                    rows={8}
                    value={profileText}
                    onChange={(e) => setProfileText(e.target.value)}
                    className={textareaClassName}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClassName}>Upwork profile URL</label>
                    <input value={upworkUrl} onChange={(e) => setUpworkUrl(e.target.value)} className={inputClassName} />
                  </div>
                  <div>
                    <label className={labelClassName}>Behance URL</label>
                    <input value={behanceUrl} onChange={(e) => setBehanceUrl(e.target.value)} className={inputClassName} />
                  </div>
                </div>
                <Button variant="primary-gradient" disabled={saving} onClick={() => void handleSave()}>
                  <Sparkles className={`h-4 w-4 ${saving ? 'animate-pulse' : ''}`} />
                  {saving ? 'Re-extracting...' : 'Save & re-extract fingerprint'}
                </Button>
              </Card>

              {extracted && (
                <FingerprintCard
                  fingerprint={extractedToFingerprint(extracted)}
                  extracted={extracted}
                />
              )}
            </>
          ) : (
            <PageEmpty title="Select a profile" description="Choose a profile from the list or add a new one." />
          )}
        </div>
      </div>
    </div>
  )
}
