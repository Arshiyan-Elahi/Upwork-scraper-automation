import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
  type AuthUser,
} from '../api/auth'
import {
  clearToken,
  getToken,
  setToken,
  setUnauthorizedHandler,
} from '../api/authToken'

interface AuthContextValue {
  user: AuthUser | null
  /** True while we resolve an existing token on first load. */
  initializing: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [initializing, setInitializing] = useState(true)

  // Resolve an existing token on mount (refresh / revisit).
  useEffect(() => {
    let active = true

    async function bootstrap() {
      if (!getToken()) {
        if (active) setInitializing(false)
        return
      }
      try {
        const current = await fetchCurrentUser()
        if (active) setUser(current)
      } catch {
        clearToken()
        if (active) setUser(null)
      } finally {
        if (active) setInitializing(false)
      }
    }

    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  // When any API call hits a 401, drop the user so guards send us to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: loggedIn } = await apiLogin(email, password)
    setToken(token)
    setUser(loggedIn)
  }, [])

  const signup = useCallback(
    async (email: string, password: string) => {
      // Signup, then immediately log in (as the flow requires).
      await apiSignup(email, password)
      await login(email, password)
    },
    [login],
  )

  const logout = useCallback(async () => {
    await apiLogout()
    clearToken()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      isAuthenticated: user !== null,
      login,
      signup,
      logout,
    }),
    [user, initializing, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
