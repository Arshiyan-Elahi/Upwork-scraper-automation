import type { ExtractedProfile, ProfileFingerprint, FreelancerProfile } from '../types'
import { apiFetch } from './client'

export interface BackendProfileExtracted {
  niches: string[]
  skills: string[]
  services: string[]
  strengths: string[]
  ideal_clients: string
  writing_tone: string
  best_fit_job_types: string[]
  avoid_job_types: string[]
  headline: string
  summary: string
}

export interface BackendProfile {
  id: number
  name: string
  raw_input: string
  extracted: BackendProfileExtracted
  upwork_profile_url: string | null
  behance_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export function mapExtractedProfile(raw: BackendProfileExtracted): ExtractedProfile {
  return {
    niches: raw.niches ?? [],
    skills: raw.skills ?? [],
    services: raw.services ?? [],
    strengths: raw.strengths ?? [],
    idealClients: raw.ideal_clients ?? '',
    writingTone: raw.writing_tone ?? '',
    bestFitJobTypes: raw.best_fit_job_types ?? [],
    avoidJobTypes: raw.avoid_job_types ?? [],
    headline: raw.headline ?? '',
    summary: raw.summary ?? '',
  }
}

export function mapProfile(raw: BackendProfile): FreelancerProfile {
  return {
    id: raw.id,
    name: raw.name,
    rawInput: raw.raw_input,
    extracted: mapExtractedProfile(raw.extracted),
    upworkProfileUrl: raw.upwork_profile_url,
    behanceUrl: raw.behance_url,
    isActive: raw.is_active,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

export function extractedToFingerprint(extracted: ExtractedProfile): ProfileFingerprint {
  return {
    primaryNiche: extracted.headline || extracted.niches[0] || 'Not detected',
    secondaryNiches:
      extracted.niches.length > 1 ? extracted.niches.slice(1) : extracted.niches,
    strongestServices: extracted.services,
    portfolioStrengths: extracted.strengths,
    idealClients: extracted.idealClients ? [extracted.idealClients] : [],
    writingTone: extracted.writingTone,
    bestFitJobTypes: extracted.bestFitJobTypes,
    avoidJobTypes: extracted.avoidJobTypes,
  }
}

export async function listProfiles(): Promise<FreelancerProfile[]> {
  const rows = await apiFetch<BackendProfile[]>('/profiles')
  return rows.map(mapProfile)
}

export async function getProfile(id: number): Promise<FreelancerProfile> {
  const row = await apiFetch<BackendProfile>(`/profiles/${id}`)
  return mapProfile(row)
}

export async function createProfile(payload: {
  name: string
  rawText: string
  upworkProfileUrl?: string
  behanceUrl?: string
}): Promise<FreelancerProfile> {
  const row = await apiFetch<BackendProfile>('/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      raw_text: payload.rawText,
      upwork_profile_url: payload.upworkProfileUrl ?? null,
      behance_url: payload.behanceUrl ?? null,
    }),
  })
  return mapProfile(row)
}

export async function updateProfile(
  id: number,
  payload: {
    name?: string
    rawText?: string
    upworkProfileUrl?: string | null
    behanceUrl?: string | null
  },
): Promise<FreelancerProfile> {
  const row = await apiFetch<BackendProfile>(`/profiles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      raw_text: payload.rawText,
      upwork_profile_url: payload.upworkProfileUrl,
      behance_url: payload.behanceUrl,
    }),
  })
  return mapProfile(row)
}

export async function deleteProfile(id: number): Promise<void> {
  await apiFetch(`/profiles/${id}`, { method: 'DELETE' })
}

export async function activateProfile(id: number): Promise<FreelancerProfile> {
  const row = await apiFetch<BackendProfile>(`/profiles/${id}/activate`, { method: 'PUT' })
  return mapProfile(row)
}

/** @deprecated Use listProfiles — kept for imports during transition */
export async function getProfileLegacy(): Promise<BackendProfile | null> {
  const profiles = await apiFetch<BackendProfile[]>('/profiles')
  return profiles.find((p) => p.is_active) ?? profiles[0] ?? null
}

export async function saveProfile(rawText: string): Promise<BackendProfile> {
  const active = await getProfileLegacy()
  if (active) {
    return apiFetch<BackendProfile>(`/profiles/${active.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: rawText }),
    })
  }
  return apiFetch<BackendProfile>('/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Default Profile', raw_text: rawText }),
  })
}
