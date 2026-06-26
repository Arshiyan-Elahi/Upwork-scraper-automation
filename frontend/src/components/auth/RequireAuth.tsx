import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AppLogo } from '../ui'

export function RequireAuth() {
  const { isAuthenticated, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary dark:bg-surface-dark-default">
        <div className="flex flex-col items-center gap-3">
          <AppLogo size="md" className="animate-pulse" />
          <p className="text-sm text-content-muted dark:text-content-dark-muted">Loading…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
