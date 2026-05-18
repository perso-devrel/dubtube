export interface DashboardSummary {
  total_jobs: number
  total_minutes: number
  active_jobs: number
  credits_remaining: number
}

export interface DubbingJob {
  id: number
  user_id: string
  video_title: string
  video_duration_ms: number
  status: string
  created_at: string
  languages: string
  avg_progress: number
  language_count: number
  uploaded_count: number
  upload_processing_count: number
  upload_pending_count: number
}

export interface CreditUsageRow {
  month: string
  job_count: number
  minutes_used: number
}

export interface LanguagePerformanceRow {
  language_code: string
  total_views: number
  total_likes: number
  upload_count: number
}

export interface DashboardInitialData {
  summary: DashboardSummary | null
  jobs: DubbingJob[]
  creditUsage: CreditUsageRow[]
  ytVideoIds: string[]
}
