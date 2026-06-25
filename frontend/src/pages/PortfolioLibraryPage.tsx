import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { listProfiles } from '../api/profiles'
import {
  analyzePortfolioItem,
  createPortfolioItem,
  deletePortfolioItem,
  getPortfolioTaxonomy,
  listPortfolioItems,
  updatePortfolioItem,
  type PortfolioItemPayload,
} from '../api/portfolio'
import type { FreelancerProfile, PortfolioItem, PortfolioSourceType } from '../types'
import { PageEmpty, PageError, PageLoading } from '../components/PageStates'
import { Badge, Button, Card } from '../components/ui'
import { inputClassName, labelClassName, selectClassName, textareaClassName } from '../utils/form'

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function joinTags(tags: string[]): string {
  return tags.join(', ')
}

const emptyForm = (): PortfolioItemPayload & { id?: number } => ({
  title: '',
  url: '',
  sourceType: 'manual',
  mainCategory: '',
  subCategory: '',
  industryTags: [],
  skillTags: [],
  styleTags: [],
  toolsTags: [],
  description: '',
  priorityScore: 0,
})

export function PortfolioLibraryPage() {
  const [profiles, setProfiles] = useState<FreelancerProfile[]>([])
  const [taxonomy, setTaxonomy] = useState<Record<string, string[]>>({})
  const [sourceTypes, setSourceTypes] = useState<string[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [industryInput, setIndustryInput] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [styleInput, setStyleInput] = useState('')
  const [toolsInput, setToolsInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeMeta, setAnalyzeMeta] = useState<{
    bestForJobs: string[]
    shortSummary: string
    confidenceScore: number
  } | null>(null)

  const [filterMain, setFilterMain] = useState('')
  const [filterSub, setFilterSub] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  const mainCategories = useMemo(() => Object.keys(taxonomy), [taxonomy])
  const formSubCategories = form.mainCategory ? taxonomy[form.mainCategory] ?? [] : []
  const filterSubCategories = filterMain ? taxonomy[filterMain] ?? [] : []

  const loadInitial = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [profileRows, tax] = await Promise.all([listProfiles(), getPortfolioTaxonomy()])
      setProfiles(profileRows)
      setTaxonomy(tax.taxonomy)
      setSourceTypes(tax.source_types)
      const active = profileRows.find((p) => p.isActive) ?? profileRows[0]
      setSelectedProfileId(active?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio library.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadItems = useCallback(async () => {
    if (selectedProfileId == null) {
      setItems([])
      return
    }
    setError(null)
    try {
      const rows = await listPortfolioItems(selectedProfileId, {
        mainCategory: filterMain || undefined,
        subCategory: filterSub || undefined,
        sourceType: filterSource || undefined,
        tag: filterTag || undefined,
        search: filterSearch || undefined,
      })
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio items.')
    }
  }, [selectedProfileId, filterMain, filterSub, filterSource, filterTag, filterSearch])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  useEffect(() => {
    if (!loading) void loadItems()
  }, [loadItems, loading])

  const openCreateForm = () => {
    const firstMain = mainCategories[0] ?? ''
    setForm({
      ...emptyForm(),
      mainCategory: firstMain,
      subCategory: taxonomy[firstMain]?.[0] ?? '',
    })
    setIndustryInput('')
    setSkillInput('')
    setStyleInput('')
    setToolsInput('')
    setAnalyzeMeta(null)
    setShowForm(true)
  }

  const openEditForm = (item: PortfolioItem) => {
    setForm({
      id: item.id,
      title: item.title,
      url: item.url,
      sourceType: item.sourceType,
      mainCategory: item.mainCategory,
      subCategory: item.subCategory,
      industryTags: item.industryTags,
      skillTags: item.skillTags,
      styleTags: item.styleTags,
      toolsTags: item.toolsTags,
      description: item.description ?? '',
      priorityScore: item.priorityScore,
    })
    setIndustryInput(joinTags(item.industryTags))
    setSkillInput(joinTags(item.skillTags))
    setStyleInput(joinTags(item.styleTags))
    setToolsInput(joinTags(item.toolsTags))
    setAnalyzeMeta(null)
    setShowForm(true)
  }

  const handleAnalyze = async () => {
    if (!form.title.trim() && !form.url.trim()) {
      setError('Enter a title or URL before analyzing.')
      return
    }
    setAnalyzing(true)
    setError(null)
    try {
      const result = await analyzePortfolioItem(
        {
          title: form.title.trim() || undefined,
          url: form.url.trim() || undefined,
          description: form.description?.trim() || undefined,
          sourceType: form.sourceType,
        },
        form.id,
      )
      setForm((prev) => ({
        ...prev,
        mainCategory: result.mainCategory || prev.mainCategory,
        subCategory: result.subCategory || prev.subCategory,
        description: result.shortSummary || prev.description,
      }))
      setIndustryInput(joinTags(result.industryTags))
      setSkillInput(joinTags(result.skillTags))
      setStyleInput(joinTags(result.styleTags))
      setToolsInput(joinTags(result.toolsTags))
      setAnalyzeMeta({
        bestForJobs: result.bestForJobs,
        shortSummary: result.shortSummary,
        confidenceScore: result.confidenceScore,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI analysis failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedProfileId == null || !form.title.trim() || !form.url.trim()) return
    if (!form.mainCategory || !form.subCategory) {
      setError('Main and sub category are required.')
      return
    }

    setSaving(true)
    setError(null)
    const payload: PortfolioItemPayload = {
      title: form.title.trim(),
      url: form.url.trim(),
      sourceType: form.sourceType,
      mainCategory: form.mainCategory,
      subCategory: form.subCategory,
      industryTags: parseTags(industryInput),
      skillTags: parseTags(skillInput),
      styleTags: parseTags(styleInput),
      toolsTags: parseTags(toolsInput),
      description: form.description?.trim() || undefined,
      priorityScore: form.priorityScore ?? 0,
    }

    try {
      if (form.id != null) {
        await updatePortfolioItem(form.id, payload)
      } else {
        await createPortfolioItem(selectedProfileId, payload)
      }
      setShowForm(false)
      setForm(emptyForm())
      await loadItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save portfolio item.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: PortfolioItem) => {
    if (!window.confirm(`Remove "${item.title}" from the library?`)) return
    setSaving(true)
    setError(null)
    try {
      await deletePortfolioItem(item.id)
      await loadItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoading label="Loading portfolio library..." />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
            Portfolio Library
          </h1>
          <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
            Case studies and assets linked to each freelancer profile.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={selectedProfileId == null}
          onClick={openCreateForm}
        >
          <Plus className="h-4 w-4" />
          Add portfolio item
        </Button>
      </div>

      {error && <PageError message={error} onRetry={() => setError(null)} />}

      <Card variant="glass" padding="md" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <label className={labelClassName}>Profile</label>
          <select
            value={selectedProfileId ?? ''}
            onChange={(e) => setSelectedProfileId(Number(e.target.value))}
            className={selectClassName}
          >
            {profiles.length === 0 ? (
              <option value="">No profiles — create one first</option>
            ) : (
              profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.isActive ? ' (active)' : ''}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className={labelClassName}>Main category</label>
          <select
            value={filterMain}
            onChange={(e) => {
              setFilterMain(e.target.value)
              setFilterSub('')
            }}
            className={selectClassName}
          >
            <option value="">All</option>
            {mainCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClassName}>Sub category</label>
          <select
            value={filterSub}
            onChange={(e) => setFilterSub(e.target.value)}
            className={selectClassName}
            disabled={!filterMain}
          >
            <option value="">All</option>
            {filterSubCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClassName}>Source</label>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className={selectClassName}>
            <option value="">All</option>
            {sourceTypes.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClassName}>Tag</label>
          <input
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            placeholder="e.g. branding"
            className={inputClassName}
          />
        </div>
        <div>
          <label className={labelClassName}>Search</label>
          <input
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Title or description"
            className={inputClassName}
          />
        </div>
      </Card>

      {showForm && (
        <Card variant="glass" padding="md">
          <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-content dark:text-content-dark-default">
                {form.id != null ? 'Edit portfolio item' : 'New portfolio item'}
              </h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={analyzing || saving}
                onClick={() => void handleAnalyze()}
              >
                <Sparkles className={`h-4 w-4 ${analyzing ? 'animate-pulse' : ''}`} />
                {analyzing ? 'Analyzing...' : 'Analyze with AI'}
              </Button>
            </div>

            {analyzeMeta && (
              <div className="sm:col-span-2 rounded-xl border border-brand/30 bg-brand-muted/30 p-3 dark:border-brand-light/20 dark:bg-brand-muted-dark/20">
                <p className="text-xs font-medium text-content-secondary dark:text-content-dark-secondary">
                  AI suggestions — review and edit before saving
                  {analyzeMeta.confidenceScore > 0 && (
                    <span className="ml-2 text-content-muted dark:text-content-dark-muted">
                      Confidence: {analyzeMeta.confidenceScore}%
                    </span>
                  )}
                </p>
                {analyzeMeta.shortSummary && (
                  <p className="mt-2 text-sm text-content dark:text-content-dark-default">
                    {analyzeMeta.shortSummary}
                  </p>
                )}
                {analyzeMeta.bestForJobs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {analyzeMeta.bestForJobs.map((job) => (
                      <Badge key={job} variant="info" size="sm">
                        Best for: {job}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={labelClassName}>Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputClassName}
                required
              />
            </div>
            <div>
              <label className={labelClassName}>URL</label>
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className={inputClassName}
                placeholder="https://"
                required
              />
            </div>
            <div>
              <label className={labelClassName}>Source type</label>
              <select
                value={form.sourceType}
                onChange={(e) => setForm({ ...form, sourceType: e.target.value as PortfolioSourceType })}
                className={selectClassName}
              >
                {sourceTypes.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Main category</label>
              <select
                value={form.mainCategory}
                onChange={(e) => {
                  const main = e.target.value
                  setForm({
                    ...form,
                    mainCategory: main,
                    subCategory: taxonomy[main]?.[0] ?? '',
                  })
                }}
                className={selectClassName}
                required
              >
                <option value="">Select...</option>
                {mainCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Sub category</label>
              <select
                value={form.subCategory}
                onChange={(e) => setForm({ ...form, subCategory: e.target.value })}
                className={selectClassName}
                required
                disabled={!form.mainCategory}
              >
                <option value="">Select...</option>
                {formSubCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClassName}>Description</label>
              <textarea
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className={textareaClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>Industry tags (comma-separated)</label>
              <input value={industryInput} onChange={(e) => setIndustryInput(e.target.value)} className={inputClassName} />
            </div>
            <div>
              <label className={labelClassName}>Skill tags</label>
              <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} className={inputClassName} />
            </div>
            <div>
              <label className={labelClassName}>Style tags</label>
              <input value={styleInput} onChange={(e) => setStyleInput(e.target.value)} className={inputClassName} />
            </div>
            <div>
              <label className={labelClassName}>Tools tags</label>
              <input value={toolsInput} onChange={(e) => setToolsInput(e.target.value)} className={inputClassName} />
            </div>
            <div>
              <label className={labelClassName}>Priority score</label>
              <input
                type="number"
                value={form.priorityScore ?? 0}
                onChange={(e) => setForm({ ...form, priorityScore: Number(e.target.value) })}
                className={inputClassName}
              />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" variant="primary-gradient" size="sm" disabled={saving}>
                {saving ? 'Saving...' : 'Save item'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {profiles.length === 0 ? (
        <PageEmpty
          title="No profiles yet"
          description="Create a freelancer profile on Profile Intelligence before adding portfolio items."
        />
      ) : items.length === 0 ? (
        <PageEmpty
          title="No portfolio items"
          description="Add your first case study or adjust filters."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} variant="default" padding="md" className="flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-content dark:text-content-dark-default">{item.title}</h3>
                <Badge variant="neutral" size="sm" className="shrink-0 capitalize">
                  {item.sourceType.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="mb-1 text-xs text-content-muted dark:text-content-dark-muted">
                {item.mainCategory} · {item.subCategory}
              </p>
              {item.description && (
                <p className="mb-3 flex-1 text-sm text-content-secondary dark:text-content-dark-secondary">
                  {item.description}
                </p>
              )}
              <div className="mb-3 flex flex-wrap gap-1">
                {[...item.industryTags, ...item.skillTags, ...item.styleTags, ...item.toolsTags].map((tag) => (
                  <Badge key={`${item.id}-${tag}`} variant="info" size="sm">{tag}</Badge>
                ))}
              </div>
              <p className="mb-3 text-xs text-content-muted dark:text-content-dark-muted">
                Priority: {item.priorityScore}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-3">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand dark:text-brand-light"
                >
                  View project
                  <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-content-secondary hover:text-brand dark:text-content-dark-secondary"
                  onClick={() => openEditForm(item)}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-semantic-danger hover:underline"
                  onClick={() => void handleDelete(item)}
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
