import { apiFetch } from './client'

export interface AuthUser {
  id: number
  email: string
  createdAt: string
}

interface BackendUser {
  id: number
  email: string
  created_at: string
}

interface TokenResponse {
  access_token: string
  token_type: string
  user: BackendUser
}

function mapUser(user: BackendUser): AuthUser {
  return { id: user.id, email: user.email, createdAt: user.created_at }
}

export async function signup(email: string, password: string): Promise<AuthUser> {
  const user = await apiFetch<BackendUser>('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return mapUser(user)
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const res = await apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return { token: res.access_token, user: mapUser(res.user) }
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const user = await apiFetch<BackendUser>('/auth/me')
  return mapUser(user)
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<{ message: string }>('/auth/logout', { method: 'POST' })
  } catch {
    // Logout is best-effort; the client clears its token regardless.
  }
}
