import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout'
import { JobsProvider } from './context/JobsContext'
import {
  AnalyticsPage,
  ApplyQueuePage,
  DashboardPage,
  JobDetailPage,
  JobInboxPage,
  MaybeJobsPage,
  PortfolioLibraryPage,
  ProfileIntelligencePage,
  ProposalStudioPage,
  SettingsPage,
  SkippedJobsPage,
  TrackerPage,
  WinningProposalsPage,
} from './pages'
import { ThemeProvider } from './theme/ThemeProvider'

export default function App() {
  return (
    <ThemeProvider>
      <JobsProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="job-inbox" element={<JobInboxPage />} />
              <Route path="jobs/:id" element={<JobDetailPage />} />
              <Route path="apply-queue" element={<ApplyQueuePage />} />
              <Route path="maybe-jobs" element={<MaybeJobsPage />} />
              <Route path="skipped-jobs" element={<SkippedJobsPage />} />
              <Route path="proposal-studio" element={<ProposalStudioPage />} />
              <Route path="proposal-studio/:jobId" element={<ProposalStudioPage />} />
              <Route path="tracker" element={<TrackerPage />} />
              <Route path="profile-intelligence" element={<ProfileIntelligencePage />} />
              <Route path="portfolio-library" element={<PortfolioLibraryPage />} />
              <Route path="winning-proposals" element={<WinningProposalsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </JobsProvider>
    </ThemeProvider>
  )
}
