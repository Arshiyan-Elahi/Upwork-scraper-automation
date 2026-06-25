import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { APP_NAME } from '../../constants/branding'
import { navItems } from '../../config/navigation'
import { AppLogo } from '../ui'

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ collapsed, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-content/40 backdrop-blur-sm lg:hidden dark:bg-black/60"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/60 bg-surface/90 backdrop-blur-glass transition-all duration-300 dark:border-border-dark/60 dark:bg-surface-dark-secondary/90 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-[72px]' : 'w-72'} lg:relative lg:shrink-0`}
      >
        <div
          className={`flex h-16 items-center border-b border-border/60 dark:border-border-dark/60 ${
            collapsed ? 'justify-center px-2' : 'justify-between px-5'
          }`}
        >
          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
            <AppLogo size="md" />
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-content dark:text-content-dark-default">
                  {APP_NAME}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Close sidebar"
            className="rounded-lg p-1.5 text-content-muted hover:bg-surface-tertiary lg:hidden dark:text-content-dark-muted dark:hover:bg-surface-dark-tertiary"
            onClick={onMobileClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              title={collapsed ? label : undefined}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-gradient-brand text-white shadow-glow'
                    : 'text-content-secondary hover:bg-surface-tertiary hover:text-content dark:text-content-dark-secondary dark:hover:bg-surface-dark-tertiary dark:hover:text-content-dark-default'
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
