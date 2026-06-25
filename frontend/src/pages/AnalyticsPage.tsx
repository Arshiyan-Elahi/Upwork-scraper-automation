import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  bestPerformingNiche,
  bestPortfolioLinks,
  bestProposalStyle,
  jobsOverTime,
  pipelineMetrics,
  verdictChartData,
} from '../mockData'
import { PageLoading, usePageLoading } from '../components/PageStates'
import { Card, MetricCard } from '../components/ui'
import { formatCurrency } from '../utils/jobs'
import { DollarSign, FileText, MessageSquare, Percent, Send, Trophy, Users, Video } from 'lucide-react'

export function AnalyticsPage() {
  const loading = usePageLoading()

  if (loading) return <PageLoading label="Loading analytics..." />

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-content dark:text-content-dark-default">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-content-secondary dark:text-content-dark-secondary">
          Performance insights driven from your job and proposal activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Drafts" value={pipelineMetrics.proposalsDrafted} icon={FileText} accent="info" />
        <MetricCard title="Submitted" value={pipelineMetrics.submitted} icon={Send} accent="brand" />
        <MetricCard title="Reply rate" value={`${pipelineMetrics.replyRate}%`} icon={MessageSquare} accent="success" />
        <MetricCard title="Interview rate" value={`${pipelineMetrics.interviewRate}%`} icon={Video} accent="warning" />
        <MetricCard title="Hire rate" value={`${pipelineMetrics.hireRate}%`} icon={Users} accent="success" />
        <MetricCard
          title="Revenue won"
          value={formatCurrency(pipelineMetrics.revenueWon)}
          icon={DollarSign}
          accent="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="default" padding="md">
          <h2 className="mb-4 text-base font-semibold text-content dark:text-content-dark-default">
            Jobs found over time
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={jobsOverTime}>
                <defs>
                  <linearGradient id="jobsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border dark:stroke-border-dark" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-content-muted" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="jobs" stroke="#6366f1" fill="url(#jobsGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card variant="default" padding="md">
          <h2 className="mb-4 text-base font-semibold text-content dark:text-content-dark-default">
            Apply vs Maybe vs Skip
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={verdictChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {verdictChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex justify-center gap-4">
            {verdictChartData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card variant="default" padding="md">
        <h2 className="mb-4 text-base font-semibold text-content dark:text-content-dark-default">
          Revenue won over time
        </h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={jobsOverTime}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border dark:stroke-border-dark" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="glass" padding="md">
          <div className="mb-2 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-brand dark:text-brand-light" />
            <h3 className="text-sm font-semibold text-content dark:text-content-dark-default">
              {bestPerformingNiche.label}
            </h3>
          </div>
          <p className="text-xl font-semibold text-brand dark:text-brand-light">{bestPerformingNiche.value}</p>
          <p className="mt-1 text-xs text-content-muted dark:text-content-dark-muted">
            {bestPerformingNiche.detail}
          </p>
        </Card>

        <Card variant="glass" padding="md">
          <div className="mb-2 flex items-center gap-2">
            <Percent className="h-4 w-4 text-semantic-success dark:text-semantic-success-light" />
            <h3 className="text-sm font-semibold text-content dark:text-content-dark-default">
              {bestProposalStyle.label}
            </h3>
          </div>
          <p className="text-xl font-semibold text-semantic-success-dark dark:text-semantic-success-light">
            {bestProposalStyle.value}
          </p>
          <p className="mt-1 text-xs text-content-muted dark:text-content-dark-muted">
            {bestProposalStyle.detail}
          </p>
        </Card>

        <Card variant="glass" padding="md">
          <h3 className="mb-3 text-sm font-semibold text-content dark:text-content-dark-default">
            Best portfolio links
          </h3>
          <ul className="space-y-2">
            {bestPortfolioLinks.map((link) => (
              <li key={link.label} className="text-sm">
                <span className="font-medium text-content dark:text-content-dark-default">{link.label}</span>
                <span className="ml-2 text-brand dark:text-brand-light">{link.value}</span>
                <p className="text-xs text-content-muted dark:text-content-dark-muted">{link.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card variant="default" padding="md">
        <h2 className="mb-4 text-base font-semibold text-content dark:text-content-dark-default">
          Verdict distribution (bar)
        </h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={verdictChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {verdictChartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
