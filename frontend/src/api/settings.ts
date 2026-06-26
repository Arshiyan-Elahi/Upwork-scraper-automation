import { apiFetch } from './client'
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
  return apiFetch<ProposalRulesResponse>('/settings/proposal-rules')
}

export async function saveProposalRules(text: string): Promise<ProposalRulesResponse> {
  return apiFetch<ProposalRulesResponse>('/settings/proposal-rules', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export async function uploadProposalRulesFile(file: File): Promise<ProposalRulesResponse> {
  const form = new FormData()
  form.append('file', file)

  // No Content-Type header: the browser sets the multipart boundary itself.
  return apiFetch<ProposalRulesResponse>('/settings/proposal-rules', {
    method: 'PUT',
    body: form,
  })
}

export interface LlmKeySaveResponse {
  provider: string
  last4: string
  configured: boolean
}

export async function getLlmSettings(): Promise<LlmSettings> {
  return apiFetch<LlmSettings>('/settings/llm')
}

export async function saveLlmKey(provider: string, apiKey: string): Promise<LlmKeySaveResponse> {
  return apiFetch<LlmKeySaveResponse>('/settings/llm-keys', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, api_key: apiKey }),
  })
}

export async function deleteLlmKey(provider: string): Promise<void> {
  await apiFetch<unknown>(`/settings/llm-keys/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
  })
}

export async function setLlmGenerationProvider(provider: string): Promise<LlmSettings> {
  return apiFetch<LlmSettings>('/settings/llm-provider', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  })
}
