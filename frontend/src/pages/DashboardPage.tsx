import {
  Briefcase,
  CheckCircle2,
  DollarSign,
  FileText,
  Inbox,
  MessageSquare,
  Percent,
  Send,
  SkipForward,
  ThumbsUp,
  Users,
  Video,
} from 'lucide-react'
import { dashboardMetrics } from '../mockData'
import { useJobs } from '../context/JobsContext'
import { SafetyPanel } from '../components/SafetyPanel'
import { RecentJobsList, VerdictBreakdown } from '../components/dashboard'
import { MetricCard } from '../components/ui'
import { formatCurrency, getRecentJobs } from '../utils/jobs'

/** DATA SOURCE: mock only — metrics and recent jobs from mockData/. */
export function DashboardPage() {
  const { jobs } = useJobs()
  const recentJobs = getRecentJobs(jobs, 5)
  const metrics = dashboardMetrics

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
          Your Upwork AI intelligence command center.
        </p>
      </div>

      <SafetyPanel />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <MetricCard title="Total jobs" value={metrics.totalJobs} icon={Inbox} accent="brand" trend={12} />
        <MetricCard title="Apply" value={metrics.applyJobs} icon={ThumbsUp} accent="success" trend={8} />
        <MetricCard title="Maybe" value={metrics.maybeJobs} icon={Briefcase} accent="warning" trend={3} />
        <MetricCard title="Skipped" value={metrics.skippedJobs} icon={SkipForward} accent="neutral" trend={-5} />
        <MetricCard
          title="Proposals drafted"
          value={metrics.proposalsDrafted}
          icon={FileText}
          accent="info"
          trend={15}
        />
        <MetricCard title="Submitted" value={metrics.submitted} icon={Send} accent="brand" trend={10} />
        <MetricCard title="Replies" value={metrics.replies} icon={MessageSquare} accent="success" trend={25} />
        <MetricCard title="Interviews" value={metrics.interviews} icon={Video} accent="warning" trend={50} />
        <MetricCard title="Hired" value={metrics.hired} icon={CheckCircle2} accent="success" trend={100} />
        <MetricCard
          title="Revenue won"
          value={formatCurrency(metrics.revenueWon)}
          icon={DollarSign}
          accent="success"
          trend={18}
        />
        <MetricCard
          title="Reply rate"
          value={`${metrics.replyRate}%`}
          icon={Percent}
          accent="brand"
          trend={6}
        />
        <MetricCard
          title="Hire rate"
          value={`${metrics.hireRate}%`}
          icon={Users}
          accent="success"
          trend={4}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentJobsList jobs={recentJobs} />
        </div>
        <VerdictBreakdown
          apply={metrics.applyJobs}
          maybe={metrics.maybeJobs}
          skipped={metrics.skippedJobs}
          total={metrics.totalJobs}
        />
      </div>
    </div>
  )
}
