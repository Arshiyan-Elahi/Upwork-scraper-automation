import { API_BASE_URL, ApiError } from './client'
import type { LlmSettings } from '../types'

export interface ProposalRulesResponse {
  text: string
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']

export function isRejectedRulesImageFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export const PROPOSAL_RULES_ACCEPT = '.md,.txt,.skills,.pdf'

export async function getProposalRules(): Promise<ProposalRulesResponse> {
  const response = await fetch(`${API_BASE_URL}/settings/proposal-rules`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      // ignore
    }
    throw new ApiError(detail, response.status)
  }
  return (await response.json()) as ProposalRulesResponse
}

export async function saveProposalRules(text: string): Promise<ProposalRulesResponse> {
  const response = await fetch(`${API_BASE_URL}/settings/proposal-rules`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      // ignore
    }
    throw new ApiError(detail, response.status)
  }
  return (await response.json()) as ProposalRulesResponse
}

export async function uploadProposalRulesFile(file: File): Promise<ProposalRulesResponse> {
  const form = new FormData()
  form.append('file', file)

  const response = await fetch(`${API_BASE_URL}/settings/proposal-rules`, {
    method: 'PUT',
    headers: { Accept: 'application/json' },
    body: form,
  })
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      // ignore
    }
    throw new ApiError(detail, response.status)
  }
  return (await response.json()) as ProposalRulesResponse
}

export interface LlmKeySaveResponse {
  provider: string
  last4: string
  configured: boolean
}

async function parseSettingsError(response: Response): Promise<never> {
  let detail = `Request failed (${response.status})`
  try {
    const body = (await response.json()) as { detail?: string }
    if (body.detail) detail = typeof body.detail === 'string' ? body.detail : detail
  } catch {
    // ignore
  }
  throw new ApiError(detail, response.status)
}

export async function getLlmSettings(): Promise<LlmSettings> {
  const response = await fetch(`${API_BASE_URL}/settings/llm`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) await parseSettingsError(response)
  return (await response.json()) as LlmSettings
}

export async function saveLlmKey(provider: string, apiKey: string): Promise<LlmKeySaveResponse> {
  const response = await fetch(`${API_BASE_URL}/settings/llm-keys`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider, api_key: apiKey }),
  })
  if (!response.ok) await parseSettingsError(response)
  return (await response.json()) as LlmKeySaveResponse
}

export async function deleteLlmKey(provider: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/settings/llm-keys/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) await parseSettingsError(response)
}

export async function setLlmGenerationProvider(provider: string): Promise<LlmSettings> {
  const response = await fetch(`${API_BASE_URL}/settings/llm-provider`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider }),
  })
  if (!response.ok) await parseSettingsError(response)
  return (await response.json()) as LlmSettings
}
