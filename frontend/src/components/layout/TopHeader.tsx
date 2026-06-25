import { Menu, Moon, Search, Sun } from 'lucide-react'
import { APP_NAME } from '../../constants/branding'
import { useTheme } from '../../theme/ThemeProvider'
import { AppLogo, Button } from '../ui'

interface TopHeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenMobileNav: () => void
}

export function TopHeader({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileNav,
}: TopHeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="glass-strong sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border/60 px-4 dark:border-border-dark/60 lg:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="hidden lg:inline-flex"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2 lg:hidden">
          <AppLogo size="sm" />
          <span className="text-sm font-semibold text-content dark:text-content-dark-default">
            {APP_NAME}
          </span>
        </div>
      </div>

      <div className="mx-auto hidden max-w-xl flex-1 md:block">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted dark:text-content-dark-muted" />
          <input
            type="search"
            placeholder="Search jobs, proposals, clients..."
            className="h-10 w-full rounded-xl border border-border bg-surface/80 pl-10 pr-4 text-sm text-content placeholder:text-content-muted transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-border-dark dark:bg-surface-dark-tertiary/80 dark:text-content-dark-default dark:placeholder:text-content-dark-muted dark:focus:border-brand-light"
            readOnly
            aria-label="Global search"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <div className="flex items-center gap-3 border-l border-border pl-3 dark:border-border-dark">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-content dark:text-content-dark-default">
              Alex Morgan
            </p>
            <p className="text-xs text-content-muted dark:text-content-dark-muted">
              Pro Freelancer
            </p>
          </div>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand text-sm font-semibold text-white shadow-soft"
            aria-hidden="true"
          >
            AM
          </div>
        </div>
      </div>
    </header>
  )
}
