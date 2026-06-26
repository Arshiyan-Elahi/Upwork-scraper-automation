import { getToken, handleUnauthorized } from './authToken'

/** Backend API base URL — override with VITE_API_URL in .env */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  const token = getToken()
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...authHeaders,
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(
      `Cannot reach the backend at ${API_BASE_URL}. Make sure the server is running.`,
    )
  }

  // A 401 on a non-auth endpoint means the session is gone/expired: clear it and
  // let the app redirect to /login. Auth endpoints handle their own 401s inline.
  if (response.status === 401 && !path.startsWith('/auth/')) {
    handleUnauthorized()
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(detail, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  return JSON.parse(text) as T
}
