import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db/client'
import { requireSession } from '@/lib/auth/session'
import { apiFail, apiFailFromError, apiOk } from '@/lib/api/response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const jobId = Number.parseInt(req.nextUrl.searchParams.get('jobId') ?? '', 10)
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return apiFail('BAD_REQUEST', 'jobId required', 400)
  }

  try {
    const db = getDb()
    const result = await db.execute({
      sql: `SELECT
              dj.original_youtube_url,
              jl.language_code,
              jl.youtube_video_id,
              jl.youtube_upload_status,
              (
                SELECT uq.youtube_video_id
                FROM upload_queue uq
                WHERE uq.job_id = jl.job_id
                  AND uq.lang_code = jl.language_code
                  AND uq.status = 'done'
                  AND COALESCE(uq.youtube_video_id, '') != ''
                ORDER BY uq.id DESC
                LIMIT 1
              ) AS queued_youtube_video_id,
              EXISTS (
                SELECT 1
                FROM youtube_uploads yu
                WHERE yu.job_language_id = jl.id
                  AND yu.upload_kind IN ('new_video_original_captions', 'my_video_original_captions')
              ) AS original_caption_uploaded,
              (
                SELECT yu.youtube_video_id
                FROM youtube_uploads yu
                WHERE yu.job_language_id = jl.id
                  AND yu.upload_kind IN ('new_video_original_captions', 'my_video_original_captions')
                ORDER BY yu.id DESC
                LIMIT 1
              ) AS original_caption_video_id
            FROM job_languages jl
            JOIN dubbing_jobs dj ON dj.id = jl.job_id
            WHERE jl.job_id = ? AND dj.user_id = ?
            ORDER BY jl.language_code ASC`,
      args: [jobId, auth.session.uid],
    })

    return apiOk({
      jobId,
      originalYouTubeUrl: result.rows[0]?.original_youtube_url ? String(result.rows[0].original_youtube_url) : null,
      languages: result.rows.map((row) => ({
        languageCode: String(row.language_code),
        youtubeVideoId: row.youtube_video_id
          ? String(row.youtube_video_id)
          : row.queued_youtube_video_id
            ? String(row.queued_youtube_video_id)
            : null,
        youtubeUploadStatus: row.youtube_upload_status
          ? String(row.youtube_upload_status)
          : row.queued_youtube_video_id
            ? 'uploaded'
            : null,
        originalCaptionUploaded: Number(row.original_caption_uploaded ?? 0) === 1,
        originalCaptionVideoId: row.original_caption_video_id ? String(row.original_caption_video_id) : null,
      })),
    })
  } catch (err) {
    return apiFailFromError(err)
  }
}
