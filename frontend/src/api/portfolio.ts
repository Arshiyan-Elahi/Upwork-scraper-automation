import type { PortfolioItem, PortfolioSourceType } from '../types'
import { apiFetch } from './client'

export interface BackendPortfolioItem {
  id: number
  profile_id: number
  title: string
  url: string
  source_type: string
  main_category: string
  sub_category: string
  industry_tags: string[]
  skill_tags: string[]
  style_tags: string[]
  tools_tags: string[]
  description: string | null
  priority_score: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PortfolioTaxonomy {
  taxonomy: Record<string, string[]>
  source_types: string[]
}

export interface PortfolioFilters {
  mainCategory?: string
  subCategory?: string
  sourceType?: string
  tag?: string
  search?: string
}

export function mapPortfolioItem(raw: BackendPortfolioItem): PortfolioItem {
  return {
    id: raw.id,
    profileId: raw.profile_id,
    title: raw.title,
    url: raw.url,
    sourceType: raw.source_type as PortfolioSourceType,
    mainCategory: raw.main_category,
    subCategory: raw.sub_category,
    industryTags: raw.industry_tags ?? [],
    skillTags: raw.skill_tags ?? [],
    styleTags: raw.style_tags ?? [],
    toolsTags: raw.tools_tags ?? [],
    description: raw.description,
    priorityScore: raw.priority_score,
    isActive: raw.is_active,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

export async function getPortfolioTaxonomy(): Promise<PortfolioTaxonomy> {
  return apiFetch<PortfolioTaxonomy>('/portfolio/taxonomy')
}

export async function listPortfolioItems(
  profileId: number,
  filters: PortfolioFilters = {},
): Promise<PortfolioItem[]> {
  const params = new URLSearchParams()
  if (filters.mainCategory) params.set('main_category', filters.mainCategory)
  if (filters.subCategory) params.set('sub_category', filters.subCategory)
  if (filters.sourceType) params.set('source_type', filters.sourceType)
  if (filters.tag) params.set('tag', filters.tag)
  if (filters.search) params.set('search', filters.search)

  const qs = params.toString()
  const path = `/profiles/${profileId}/portfolio${qs ? `?${qs}` : ''}`
  const rows = await apiFetch<BackendPortfolioItem[]>(path)
  return rows.map(mapPortfolioItem)
}

export async function getPortfolioItem(id: number): Promise<PortfolioItem> {
  const row = await apiFetch<BackendPortfolioItem>(`/portfolio/${id}`)
  return mapPortfolioItem(row)
}

export interface PortfolioItemPayload {
  title: string
  url: string
  sourceType: PortfolioSourceType
  mainCategory: string
  subCategory: string
  industryTags?: string[]
  skillTags?: string[]
  styleTags?: string[]
  toolsTags?: string[]
  description?: string
  priorityScore?: number
}

function toBackendPayload(payload: PortfolioItemPayload) {
  return {
    title: payload.title,
    url: payload.url,
    source_type: payload.sourceType,
    main_category: payload.mainCategory,
    sub_category: payload.subCategory,
    industry_tags: payload.industryTags ?? [],
    skill_tags: payload.skillTags ?? [],
    style_tags: payload.styleTags ?? [],
    tools_tags: payload.toolsTags ?? [],
    description: payload.description ?? null,
    priority_score: payload.priorityScore ?? 0,
  }
}

export async function createPortfolioItem(
  profileId: number,
  payload: PortfolioItemPayload,
): Promise<PortfolioItem> {
  const row = await apiFetch<BackendPortfolioItem>(`/profiles/${profileId}/portfolio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toBackendPayload(payload)),
  })
  return mapPortfolioItem(row)
}

export async function updatePortfolioItem(
  id: number,
  payload: Partial<PortfolioItemPayload> & { isActive?: boolean },
): Promise<PortfolioItem> {
  const row = await apiFetch<BackendPortfolioItem>(`/portfolio/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: payload.title,
      url: payload.url,
      source_type: payload.sourceType,
      main_category: payload.mainCategory,
      sub_category: payload.subCategory,
      industry_tags: payload.industryTags,
      skill_tags: payload.skillTags,
      style_tags: payload.styleTags,
      tools_tags: payload.toolsTags,
      description: payload.description,
      priority_score: payload.priorityScore,
      is_active: payload.isActive,
    }),
  })
  return mapPortfolioItem(row)
}

export async function deletePortfolioItem(id: number): Promise<void> {
  await apiFetch(`/portfolio/${id}`, { method: 'DELETE' })
}

export interface PortfolioAnalyzeResult {
  main_category: string
  sub_category: string
  industry_tags: string[]
  skill_tags: string[]
  style_tags: string[]
  tools_tags: string[]
  best_for_jobs: string[]
  short_summary: string
  confidence_score: number
}

export interface PortfolioAnalyzeInput {
  title?: string
  url?: string
  description?: string
  sourceType?: string
}

function mapAnalyzeResult(raw: PortfolioAnalyzeResult) {
  return {
    mainCategory: raw.main_category ?? '',
    subCategory: raw.sub_category ?? '',
    industryTags: raw.industry_tags ?? [],
    skillTags: raw.skill_tags ?? [],
    styleTags: raw.style_tags ?? [],
    toolsTags: raw.tools_tags ?? [],
    bestForJobs: raw.best_for_jobs ?? [],
    shortSummary: raw.short_summary ?? '',
    confidenceScore: raw.confidence_score ?? 0,
  }
}

export async function analyzePortfolioItem(
  input: PortfolioAnalyzeInput,
  itemId?: number,
) {
  const path =
    itemId != null ? `/portfolio/${itemId}/analyze` : '/portfolio/analyze'
  const raw = await apiFetch<PortfolioAnalyzeResult>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      url: input.url,
      description: input.description,
      source_type: input.sourceType,
    }),
  })
  return mapAnalyzeResult(raw)
}
