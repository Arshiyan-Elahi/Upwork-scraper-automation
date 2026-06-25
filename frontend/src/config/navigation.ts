import {
  BarChart3,
  Bookmark,
  ClipboardList,
  Columns3,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  PenTool,
  Settings,
  SkipForward,
  Trophy,
  UserSearch,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Job Inbox', path: '/job-inbox', icon: Inbox },
  { label: 'Apply Queue', path: '/apply-queue', icon: ClipboardList },
  { label: 'Maybe Jobs', path: '/maybe-jobs', icon: Bookmark },
  { label: 'Skipped Jobs', path: '/skipped-jobs', icon: SkipForward },
  { label: 'Proposal Studio', path: '/proposal-studio', icon: PenTool },
  { label: 'Pipeline Tracker', path: '/tracker', icon: Columns3 },
  { label: 'Profile Intelligence', path: '/profile-intelligence', icon: UserSearch },
  { label: 'Portfolio Library', path: '/portfolio-library', icon: FolderOpen },
  { label: 'Winning Proposals', path: '/winning-proposals', icon: Trophy },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Settings', path: '/settings', icon: Settings },
]
