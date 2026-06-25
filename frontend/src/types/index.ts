export type JobSource = 'email' | 'apify' | 'api' | 'manual' | 'extension'

export type Verdict = 'apply' | 'maybe' | 'skip'

export type ClientQuality = 'high' | 'medium' | 'low' | 'unknown'

export type CompetitionLevel = 'low' | 'medium' | 'high' | 'unknown'

export type ProposalVariant = 'short' | 'premium' | 'direct'

export type PortfolioSourceType =
  | 'behance'
  | 'google_drive'
  | 'website'
  | 'pdf'
  | 'case_study'
  | 'dribbble'
  | 'figma'
  | 'manual'

/** @deprecated Mock-only category — use mainCategory/subCategory from API */
export type PortfolioCategory = 'logo' | 'branding' | 'packaging' | 'social' | 'web' | 'other'

export interface PortfolioItem {
  id: number
  profileId: number
  title: string
  url: string
  sourceType: PortfolioSourceType
  mainCategory: string
  subCategory: string
  industryTags: string[]
  skillTags: string[]
  styleTags: string[]
  toolsTags: string[]
  description: string | null
  priorityScore: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface FreelancerProfile {
  id: number
  name: string
  rawInput: string
  extracted: ExtractedProfile
  upworkProfileUrl: string | null
  behanceUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type PipelineStage =
  | 'found'
  | 'drafted'
  | 'submitted'
  | 'viewed'
  | 'replied'
  | 'interview'
  | 'hired'
  | 'rejected'
  | 'archived'

export type JobOutcome = 'replied' | 'interview' | 'hired' | 'rejected'

export type BudgetType = 'fixed' | 'hourly' | 'unknown'

export interface ScoreBreakdown {
  nicheMatch: number
  budgetQuality: number
  clientQuality: number
  competition: number
  clarity: number
  urgency: number
  portfolioMatch: number
  conversionChance: number
}

export interface JobClientInfo {
  spend?: string
  rating?: number
  location?: string
  hireRate?: string
}

export interface Job {
  id: string
  title: string
  source: JobSource
  budget: string | null
  budgetType: BudgetType
  description: string
  skills: string[]
  clientQuality: ClientQuality
  clientInfo: JobClientInfo
  competition: CompetitionLevel
  /** null = not yet scored by intelligence layer (live inbox jobs) */
  matchScore: number | null
  /** null = unscored — show neutral badge in UI */
  verdict: Verdict | null
  /** null when job is unscored */
  scoreBreakdown: ScoreBreakdown | null
  redFlags: string[]
  portfolioMatchIds: string[]
  suggestedAngle: string
  discoveryQuestion: string
  postedDate: string
  receivedDate: string
  jobUrl: string | null
  stage: PipelineStage
  outcome: JobOutcome | null
  /** LLM job fit signal — null when not yet scored */
  fitScore?: number | null
  /** LLM apply/maybe/skip recommendation — null when not yet scored */
  fitRecommendation?: Verdict | null
  fitReasons?: string[]
  fitConcerns?: string[]
  fitAngle?: string
  fitScoredAt?: string | null
}


export interface WinningProposal {
  id: string
  jobTitle: string
  text: string
  niche: string
  outcome: string
  revenue: number
  notes: string
}

export interface ProposalDraft {
  id: string
  jobId: string
  variant: ProposalVariant
  text: string
  submitted: boolean
  outcome: PipelineStage | null
}

export interface ProfileFingerprint {
  primaryNiche: string
  secondaryNiches: string[]
  strongestServices: string[]
  portfolioStrengths: string[]
  idealClients: string[]
  writingTone: string
  bestFitJobTypes: string[]
  avoidJobTypes: string[]
}

/** Structured profile from backend PUT/GET /profile */
export interface ExtractedProfile {
  niches: string[]
  skills: string[]
  services: string[]
  strengths: string[]
  idealClients: string
  writingTone: string
  bestFitJobTypes: string[]
  avoidJobTypes: string[]
  headline: string
  summary: string
}

export interface DashboardMetrics {
  totalJobs: number
  applyJobs: number
  maybeJobs: number
  skippedJobs: number
  proposalsDrafted: number
  submitted: number
  replies: number
  interviews: number
  hired: number
  revenueWon: number
  replyRate: number
  hireRate: number
}

export type LlmProviderId = 'gemini' | 'groq' | 'claude' | 'openai'

export interface LlmProviderStatus {
  configured: boolean
  last4: string | null
}

export interface LlmSettings {
  providers: Record<LlmProviderId, LlmProviderStatus>
  generation_provider: LlmProviderId
}

export interface ProfileFormData {
  upworkProfileText: string
  profileLink: string
  behanceLink: string
  services: string
  skills: string
  niches: string
  idealProjectTypes: string
  pricingRange: string
  communicationStyle: string
}

export interface AnalyticsTimePoint {
  date: string
  jobs: number
  revenue: number
}

export interface AnalyticsVerdictPoint {
  name: string
  value: number
  fill: string
}

export interface AnalyticsInsight {
  label: string
  value: string
  detail: string
}
