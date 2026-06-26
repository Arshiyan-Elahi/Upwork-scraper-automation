/**
 * Auth token storage.
 *
 * The token is kept in memory (fast, primary source of truth) and mirrored to
 * localStorage so the session survives a page refresh. localStorage is a simple
 * approach and is readable by JS on this origin — acceptable for this app.
 */

const STORAGE_KEY = 'upwork-ai-intelligence-auth-token'

let inMemoryToken: string | null = null

export function getToken(): string | null {
  if (inMemoryToken) return inMemoryToken
  try {
    inMemoryToken = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    inMemoryToken = null
  }
  return inMemoryToken
}

export function setToken(token: string): void {
  inMemoryToken = token
  try {
    window.localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // ignore storage failures (e.g. private mode) — in-memory token still works
  }
}

export function clearToken(): void {
  inMemoryToken = null
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Called when an authenticated request is rejected with 401 (token invalid/expired). */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

export function handleUnauthorized(): void {
  clearToken()
  onUnauthorized?.()
}
