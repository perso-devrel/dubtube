import 'server-only'

import { getDb } from '@/lib/db/client'

export interface JobLanguageYouTubeUploadReservation {
  status: 'reserved' | 'already_uploaded' | 'already_uploading' | 'not_found'
  youtubeVideoId?: string | null
}

let youtubeUploadColumnsEnsured = false

async function ensureYouTubeUploadColumns() {
  if (youtubeUploadColumnsEnsured) return
  const db = getDb()
  const result = await db.execute({ sql: 'PRAGMA table_info(youtube_uploads)', args: [] })
  const existing = new Set((result.rows ?? []).map((row) => String(row.name)))
  const addColumn = async (name: string, definition: string) => {
    if (existing.has(name)) return
    await db.execute({ sql: `ALTER TABLE youtube_uploads ADD COLUMN ${name} ${definition}`, args: [] })
  }
  await addColumn('upload_kind', "TEXT NOT NULL DEFAULT 'new_video_dubbed_video'")
  await addColumn('metadata_json', 'TEXT')
  youtubeUploadColumnsEnsured = true
}

export async function createYouTubeUpload(upload: {
  userId: string
  jobLanguageId?: number
  youtubeVideoId: string
  title: string
  languageCode: string
  privacyStatus: string
  isShort: boolean
  uploadKind?: string
  metadataJson?: string | null
}): Promise<number> {
  await ensureYouTubeUploadColumns()
  const db = getDb()
  const result = await db.execute({
    sql: `INSERT INTO youtube_uploads (
            user_id, job_language_id, youtube_video_id, title, language_code,
            privacy_status, is_short, upload_kind, metadata_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      upload.userId,
      upload.jobLanguageId || null,
      upload.youtubeVideoId,
      upload.title,
      upload.languageCode,
      upload.privacyStatus,
      upload.isShort ? 1 : 0,
      upload.uploadKind ?? 'new_video_dubbed_video',
      upload.metadataJson ?? null,
    ],
  })
  return Number(result.lastInsertRowid)
}

export async function createJobLanguageYouTubeUpload(upload: {
  userId: string
  jobId: number
  langCode: string
  youtubeVideoId: string
  title: string
  languageCode: string
  privacyStatus: string
  isShort: boolean
  uploadKind: string
  metadataJson?: string | null
}): Promise<{ id: number; status: 'created' | 'already_recorded' } | { status: 'not_found' }> {
  await ensureYouTubeUploadColumns()
  const db = getDb()
  const languageRow = await db.execute({
    sql: `SELECT id
          FROM job_languages
          WHERE job_id = ? AND language_code = ?
          LIMIT 1`,
    args: [upload.jobId, upload.langCode],
  })
  const jobLanguageId = languageRow.rows[0]?.id ? Number(languageRow.rows[0].id) : null
  if (!jobLanguageId) return { status: 'not_found' }

  const existing = await db.execute({
    sql: `SELECT id
          FROM youtube_uploads
          WHERE job_language_id = ? AND upload_kind = ?
          ORDER BY id DESC
          LIMIT 1`,
    args: [jobLanguageId, upload.uploadKind],
  })
  const existingId = existing.rows[0]?.id ? Number(existing.rows[0].id) : null
  if (existingId) return { id: existingId, status: 'already_recorded' }

  const id = await createYouTubeUpload({
    userId: upload.userId,
    jobLanguageId,
    youtubeVideoId: upload.youtubeVideoId,
    title: upload.title,
    languageCode: upload.languageCode,
    privacyStatus: upload.privacyStatus,
    isShort: upload.isShort,
    uploadKind: upload.uploadKind,
    metadataJson: upload.metadataJson,
  })
  return { id, status: 'created' }
}

export async function startJobLanguageYouTubeUpload(
  jobId: number,
  langCode: string,
): Promise<JobLanguageYouTubeUploadReservation> {
  const db = getDb()
  const current = await db.execute({
    sql: `SELECT youtube_video_id, youtube_upload_status
          FROM job_languages
          WHERE job_id = ? AND language_code = ?
          LIMIT 1`,
    args: [jobId, langCode],
  })
  const row = current.rows[0]
  if (!row) return { status: 'not_found' }

  const youtubeVideoId = row.youtube_video_id ? String(row.youtube_video_id) : null
  if (youtubeVideoId) return { status: 'already_uploaded', youtubeVideoId }

  const completedQueue = await db.execute({
    sql: `SELECT youtube_video_id
          FROM upload_queue
          WHERE job_id = ? AND lang_code = ?
            AND status = 'done'
            AND COALESCE(youtube_video_id, '') != ''
          ORDER BY id DESC
          LIMIT 1`,
    args: [jobId, langCode],
  })
  const completedQueueVideoId = completedQueue.rows[0]?.youtube_video_id
    ? String(completedQueue.rows[0].youtube_video_id)
    : null
  if (completedQueueVideoId) {
    await db.execute({
      sql: `UPDATE job_languages
            SET youtube_video_id = ?, youtube_upload_status = 'uploaded', updated_at = datetime('now')
            WHERE job_id = ? AND language_code = ?`,
      args: [completedQueueVideoId, jobId, langCode],
    })
    return { status: 'already_uploaded', youtubeVideoId: completedQueueVideoId }
  }

  if (row.youtube_upload_status === 'uploading') {
    return { status: 'already_uploading' }
  }

  const reserved = await db.execute({
    sql: `UPDATE job_languages
          SET youtube_upload_status = 'uploading', updated_at = datetime('now')
          WHERE job_id = ? AND language_code = ?
            AND youtube_video_id IS NULL
            AND COALESCE(youtube_upload_status, '') != 'uploading'`,
    args: [jobId, langCode],
  })
  if (Number(reserved.rowsAffected ?? 0) > 0) {
    return { status: 'reserved' }
  }

  const latest = await db.execute({
    sql: `SELECT youtube_video_id, youtube_upload_status
          FROM job_languages
          WHERE job_id = ? AND language_code = ?
          LIMIT 1`,
    args: [jobId, langCode],
  })
  const latestRow = latest.rows[0]
  const latestVideoId = latestRow?.youtube_video_id ? String(latestRow.youtube_video_id) : null
  if (latestVideoId) return { status: 'already_uploaded', youtubeVideoId: latestVideoId }
  if (latestRow?.youtube_upload_status === 'uploading') return { status: 'already_uploading' }
  return { status: 'not_found' }
}

export async function failJobLanguageYouTubeUpload(
  jobId: number,
  langCode: string,
) {
  const db = getDb()
  await db.execute({
    sql: `UPDATE job_languages
          SET youtube_upload_status = 'failed', updated_at = datetime('now')
          WHERE job_id = ? AND language_code = ? AND youtube_video_id IS NULL`,
    args: [jobId, langCode],
  })
}

export async function updateYouTubeStats(
  youtubeVideoId: string,
  stats: { viewCount: number; likeCount: number; commentCount: number },
) {
  const db = getDb()
  await db.execute({
    sql: `UPDATE youtube_uploads SET view_count = ?, like_count = ?, comment_count = ?, last_stats_fetch = datetime('now')
          WHERE youtube_video_id = ?`,
    args: [
      stats.viewCount,
      stats.likeCount,
      stats.commentCount,
      youtubeVideoId,
    ],
  })
}

export async function updateJobLanguageYouTube(
  jobId: number,
  langCode: string,
  youtubeVideoId: string,
) {
  const db = getDb()
  await db.execute({
    sql: `UPDATE job_languages SET youtube_video_id = ?, youtube_upload_status = 'uploaded' WHERE job_id = ? AND language_code = ?`,
    args: [youtubeVideoId, jobId, langCode],
  })
}
