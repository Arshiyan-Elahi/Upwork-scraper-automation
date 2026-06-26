import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/auth'
import { AppShell } from './components/layout'
import { AuthProvider } from './context/AuthContext'
import { JobsProvider } from './context/JobsContext'
import {
  AnalyticsPage,
  ApplyQueuePage,
  DashboardPage,
  JobDetailPage,
  JobInboxPage,
  LoginPage,
  MaybeJobsPage,
  PortfolioLibraryPage,
  ProfileIntelligencePage,
  ProposalStudioPage,
  SettingsPage,
  SignupPage,
  SkippedJobsPage,
  TrackerPage,
  WinningProposalsPage,
} from './pages'
import { ThemeProvider } from './theme/ThemeProvider'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <JobsProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              <Route element={<RequireAuth />}>
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
              </Route>
            </Routes>
          </JobsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
