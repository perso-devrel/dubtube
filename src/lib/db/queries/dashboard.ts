import 'server-only'

import { getDb } from '@/lib/db/client'
import { ensureCreditTables } from './credits'
import type {
  DashboardSummary,
  DubbingJob,
  CreditUsageRow,
  LanguagePerformanceRow,
} from '@/features/dashboard/components/types'

export interface YouTubeUploadRow {
  youtube_video_id: string
  [key: string]: unknown
}

function toPlain<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => ({ ...row }) as T)
}

function toPlainOne<T>(row: Record<string, unknown> | undefined): T | null {
  return row ? ({ ...row } as T) : null
}

export async function getUserDubbingJobs(userId: string, limit = 10): Promise<DubbingJob[]> {
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT dj.*, GROUP_CONCAT(jl.language_code) as languages,
          AVG(jl.progress) as avg_progress,
          COUNT(jl.id) as language_count,
          COALESCE(SUM(CASE
            WHEN COALESCE(jl.youtube_video_id, '') != ''
              OR COALESCE(jl.youtube_upload_status, '') = 'uploaded'
            THEN 1 ELSE 0
          END), 0) as uploaded_count,
          COALESCE(SUM(CASE
            WHEN COALESCE(jl.youtube_upload_status, '') = 'uploading'
            THEN 1 ELSE 0
          END), 0) as upload_processing_count,
          COALESCE(SUM(CASE
            WHEN (dj.status = 'completed'
              OR jl.status = 'completed'
              OR COALESCE(jl.progress, 0) >= 100)
              AND COALESCE(jl.youtube_video_id, '') = ''
              AND COALESCE(jl.youtube_upload_status, '') NOT IN ('uploaded', 'uploading')
            THEN 1 ELSE 0
          END), 0) as upload_pending_count
          FROM dubbing_jobs dj
          LEFT JOIN job_languages jl ON jl.job_id = dj.id
          WHERE dj.user_id = ?
          GROUP BY dj.id
          ORDER BY dj.created_at DESC
          LIMIT ?`,
    args: [userId, limit],
  })
  return toPlain<DubbingJob>(result.rows as Record<string, unknown>[])
}

export async function getUserSummary(userId: string): Promise<DashboardSummary | null> {
  await ensureCreditTables()
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT
          COUNT(DISTINCT dj.id) as total_jobs,
          COALESCE(SUM(dj.video_duration_ms), 0) / 60000 as total_minutes,
          COUNT(DISTINCT CASE WHEN dj.status = 'processing' THEN dj.id END) as active_jobs,
          (SELECT MAX(
            0,
            COALESCE(u.credits_remaining, 0) -
              COALESCE((SELECT SUM(ct.reserved_delta_minutes)
                        FROM credit_transactions ct
                        WHERE ct.user_id = u.id), 0)
          ) FROM users u WHERE u.id = ?) as credits_remaining
          FROM dubbing_jobs dj
          WHERE dj.user_id = ?`,
    args: [userId, userId],
  })
  return toPlainOne<DashboardSummary>(result.rows[0] as Record<string, unknown> | undefined)
}

export async function getCreditUsageByMonth(userId: string): Promise<CreditUsageRow[]> {
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT strftime('%Y-%m', created_at) as month,
          COUNT(*) as job_count,
          SUM(video_duration_ms) / 60000 as minutes_used
          FROM dubbing_jobs
          WHERE user_id = ?
          GROUP BY month
          ORDER BY month DESC
          LIMIT 6`,
    args: [userId],
  })
  return toPlain<CreditUsageRow>(result.rows as Record<string, unknown>[])
}

export async function getLanguagePerformance(userId: string): Promise<LanguagePerformanceRow[]> {
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT yu.language_code,
          SUM(yu.view_count) as total_views,
          SUM(yu.like_count) as total_likes,
          COUNT(*) as upload_count
          FROM youtube_uploads yu
          WHERE yu.user_id = ?
          GROUP BY yu.language_code
          ORDER BY total_views DESC`,
    args: [userId],
  })
  return toPlain<LanguagePerformanceRow>(result.rows as Record<string, unknown>[])
}

export async function getUserYouTubeUploads(userId: string): Promise<YouTubeUploadRow[]> {
  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM youtube_uploads WHERE user_id = ? ORDER BY created_at DESC',
    args: [userId],
  })
  return toPlain<YouTubeUploadRow>(result.rows as Record<string, unknown>[])
}

export interface CompletedJobLanguage {
  job_id: number
  video_title: string
  video_thumbnail: string
  video_duration_ms: number
  language_code: string
  project_seq: number
  space_seq: number
  dubbed_video_url: string | null
  audio_url: string | null
  srt_url: string | null
  youtube_video_id: string | null
  youtube_upload_status: string | null
  youtube_upload_snapshot_json: string | null
  deliverable_mode: string
  original_video_url: string | null
  original_youtube_url: string | null
  created_at: string
}

export async function getCompletedJobLanguages(userId: string): Promise<CompletedJobLanguage[]> {
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT dj.id as job_id, dj.video_title, dj.video_thumbnail, dj.video_duration_ms,
          dj.space_seq, dj.deliverable_mode, dj.original_video_url, dj.original_youtube_url,
          jl.language_code, jl.project_seq,
          jl.dubbed_video_url, jl.audio_url, jl.srt_url, jl.youtube_video_id,
          jl.youtube_upload_status, jl.youtube_upload_snapshot_json,
          dj.created_at
          FROM dubbing_jobs dj
          JOIN job_languages jl ON jl.job_id = dj.id
          WHERE dj.user_id = ? AND dj.status = 'completed'
            AND COALESCE(jl.youtube_video_id, '') = ''
            AND COALESCE(jl.youtube_upload_status, '') NOT IN ('uploaded', 'uploading')
          ORDER BY dj.created_at DESC
          LIMIT 50`,
    args: [userId],
  })
  return toPlain<CompletedJobLanguage>(result.rows as Record<string, unknown>[])
}
