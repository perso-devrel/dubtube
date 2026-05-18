import 'server-only'

import { getDb } from '@/lib/db/client'
import { recordOperationalEventSafe } from '@/lib/ops/observability'

type QueueStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface UploadQueueItem {
  id: number
  userId: string
  jobId: number
  langCode: string
  videoUrl: string
  title: string
  description: string
  tags: string
  privacyStatus: string
  publishAt: string | null
  language: string
  isShort: boolean
  uploadCaptions: boolean
  captionLanguage: string | null
  captionName: string | null
  srtContent: string | null
  selfDeclaredMadeForKids: boolean
  containsSyntheticMedia: boolean
  uploadKind: string
  metadataJson: string | null
  localizationsJson: string | null
  status: QueueStatus
  retries: number
  error: string | null
  youtubeVideoId: string | null
  createdAt: string
}

export interface ClaimUploadQueueOptions {
  userId?: string
  queueId?: number
}

let tableEnsured = false

async function ensureTable() {
  if (tableEnsured) return
  const db = getDb()
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS upload_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      job_id INTEGER NOT NULL,
      lang_code TEXT NOT NULL,
      video_url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      privacy_status TEXT NOT NULL DEFAULT 'private',
      publish_at TEXT,
      language TEXT NOT NULL DEFAULT '',
      is_short INTEGER NOT NULL DEFAULT 0,
      upload_captions INTEGER NOT NULL DEFAULT 1,
      caption_language TEXT,
      caption_name TEXT,
      srt_content TEXT,
      self_declared_made_for_kids INTEGER NOT NULL DEFAULT 0,
      contains_synthetic_media INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      retries INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      youtube_video_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    args: [],
  })
  const columns = await db.execute({
    sql: 'PRAGMA table_info(upload_queue)',
    args: [],
  })
  const existing = new Set((columns.rows ?? []).map((row) => String(row.name)))
  const addColumn = async (name: string, definition: string) => {
    if (existing.has(name)) return
    await db.execute({
      sql: `ALTER TABLE upload_queue ADD COLUMN ${name} ${definition}`,
      args: [],
    })
  }
  await addColumn('upload_captions', 'INTEGER NOT NULL DEFAULT 1')
  await addColumn('publish_at', 'TEXT')
  await addColumn('caption_language', 'TEXT')
  await addColumn('caption_name', 'TEXT')
  await addColumn('srt_content', 'TEXT')
  await addColumn('self_declared_made_for_kids', 'INTEGER NOT NULL DEFAULT 0')
  await addColumn('contains_synthetic_media', 'INTEGER NOT NULL DEFAULT 0')
  await addColumn('upload_kind', "TEXT NOT NULL DEFAULT 'new_video_dubbed_video'")
  await addColumn('metadata_json', 'TEXT')
  await addColumn('localizations_json', 'TEXT')
  tableEnsured = true
}

export async function createUploadQueueItem(item: {
  userId: string
  jobId: number
  langCode: string
  videoUrl: string
  title: string
  description: string
  tags: string[]
  privacyStatus: string
  publishAt?: string | null
  language: string
  isShort: boolean
  uploadCaptions?: boolean
  captionLanguage?: string | null
  captionName?: string | null
  srtContent?: string | null
  selfDeclaredMadeForKids?: boolean
  containsSyntheticMedia?: boolean
  uploadKind?: string
  metadataJson?: string | null
  localizationsJson?: string | null
  resetFailed?: boolean
}): Promise<number> {
  await ensureTable()
  const db = getDb()
  const existing = await db.execute({
    sql: `SELECT id, status
          FROM upload_queue
          WHERE job_id = ? AND lang_code = ?
          ORDER BY id DESC
          LIMIT 1`,
    args: [item.jobId, item.langCode],
  })
  const existingRow = existing.rows[0]
  if (existingRow) {
    const id = Number(existingRow.id)
    const status = String(existingRow.status)
    if (status === 'pending' || status === 'processing' || status === 'done' || !item.resetFailed) {
      return id
    }
    await db.execute({
      sql: `UPDATE upload_queue
            SET user_id = ?,
                video_url = ?,
                title = ?,
                description = ?,
                tags = ?,
                privacy_status = ?,
                publish_at = ?,
                language = ?,
                is_short = ?,
                upload_captions = ?,
                caption_language = ?,
                caption_name = ?,
                srt_content = ?,
                self_declared_made_for_kids = ?,
                contains_synthetic_media = ?,
                upload_kind = ?,
                metadata_json = ?,
                localizations_json = ?,
                status = 'pending',
                retries = 0,
                error = NULL,
                youtube_video_id = NULL,
                updated_at = datetime('now')
            WHERE id = ?`,
      args: [
        item.userId,
        item.videoUrl,
        item.title,
        item.description,
        item.tags.join(','),
        item.privacyStatus,
        item.publishAt ?? null,
        item.language,
        item.isShort ? 1 : 0,
        (item.uploadCaptions ?? true) ? 1 : 0,
        item.captionLanguage ?? null,
        item.captionName ?? null,
        item.srtContent ?? null,
        item.selfDeclaredMadeForKids ? 1 : 0,
        item.containsSyntheticMedia ? 1 : 0,
        item.uploadKind ?? 'new_video_dubbed_video',
        item.metadataJson ?? null,
        item.localizationsJson ?? null,
        id,
      ],
    })
    return id
  }
  const result = await db.execute({
    sql: `INSERT INTO upload_queue (
            user_id, job_id, lang_code, video_url, title, description, tags,
            privacy_status, language, is_short, upload_captions, caption_language,
            publish_at, caption_name, srt_content, self_declared_made_for_kids, contains_synthetic_media,
            upload_kind, metadata_json, localizations_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      item.userId,
      item.jobId,
      item.langCode,
      item.videoUrl,
      item.title,
      item.description,
      item.tags.join(','),
      item.privacyStatus,
      item.language,
      item.isShort ? 1 : 0,
      (item.uploadCaptions ?? true) ? 1 : 0,
      item.captionLanguage ?? null,
      item.publishAt ?? null,
      item.captionName ?? null,
      item.srtContent ?? null,
      item.selfDeclaredMadeForKids ? 1 : 0,
      item.containsSyntheticMedia ? 1 : 0,
      item.uploadKind ?? 'new_video_dubbed_video',
      item.metadataJson ?? null,
      item.localizationsJson ?? null,
    ],
  })
  return Number(result.lastInsertRowid)
}

export async function claimPendingUploads(
  limit = 5,
  options: ClaimUploadQueueOptions = {},
): Promise<UploadQueueItem[]> {
  await ensureTable()
  const db = getDb()
  const filters = [`(status = 'pending' OR (status = 'failed' AND retries < 3))`]
  const args: (string | number)[] = []

  if (options.userId) {
    filters.push('user_id = ?')
    args.push(options.userId)
  }

  if (options.queueId !== undefined) {
    filters.push('id = ?')
    args.push(options.queueId)
  }

  const result = await db.execute({
    sql: `UPDATE upload_queue
          SET status = 'processing',
              error = NULL,
              updated_at = datetime('now')
          WHERE id IN (
            SELECT id
            FROM upload_queue
            WHERE ${filters.join(' AND ')}
            ORDER BY created_at ASC
            LIMIT ?
          )
          AND (status = 'pending' OR (status = 'failed' AND retries < 3))
          RETURNING *`,
    args: [...args, limit],
  })
  return result.rows.map(rowToItem)
}

export async function completeQueueItem(id: number, youtubeVideoId: string): Promise<boolean> {
  await ensureTable()
  const db = getDb()
  const result = await db.execute({
    sql: `UPDATE upload_queue
          SET status = 'done',
              youtube_video_id = ?,
              error = NULL,
              updated_at = datetime('now')
          WHERE id = ? AND status = 'processing'
          RETURNING id`,
    args: [youtubeVideoId, id],
  })
  return Boolean(result.rows[0])
}

export async function failQueueItem(id: number, error: string): Promise<boolean> {
  await ensureTable()
  const db = getDb()
  const result = await db.execute({
    sql: `UPDATE upload_queue
          SET status = 'failed',
              error = ?,
              retries = retries + 1,
              updated_at = datetime('now')
          WHERE id = ? AND status = 'processing'
          RETURNING id, user_id, job_id, lang_code, retries`,
    args: [error, id],
  })
  const row = result.rows[0]
  if (row) {
    const retries = Number(row.retries ?? 0)
    await db.execute({
      sql: `UPDATE job_languages
            SET youtube_upload_status = 'failed', updated_at = datetime('now')
            WHERE job_id = ? AND language_code = ? AND COALESCE(youtube_video_id, '') = ''`,
      args: [Number(row.job_id), String(row.lang_code)],
    }).catch(() => undefined)
    await recordOperationalEventSafe({
      category: 'upload_queue',
      eventType: 'upload_queue_failed',
      severity: retries >= 3 ? 'error' : 'warning',
      userId: String(row.user_id),
      referenceType: 'upload_queue',
      referenceId: Number(row.id),
      message: 'YouTube upload queue item failed',
      metadata: {
        jobId: Number(row.job_id),
        langCode: String(row.lang_code),
        retries,
        error,
      },
      idempotencyKey: `upload_queue_failed:${row.id}:${retries}`,
    })
  }
  return Boolean(row)
}

function dbBoolean(value: unknown) {
  return value === true || value === 1 || value === '1'
}

function rowToItem(row: Record<string, unknown>): UploadQueueItem {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    jobId: Number(row.job_id),
    langCode: String(row.lang_code),
    videoUrl: String(row.video_url),
    title: String(row.title),
    description: String(row.description),
    tags: String(row.tags),
    privacyStatus: String(row.privacy_status),
    publishAt: row.publish_at ? String(row.publish_at) : null,
    language: String(row.language),
    isShort: dbBoolean(row.is_short),
    uploadCaptions: dbBoolean(row.upload_captions),
    captionLanguage: row.caption_language ? String(row.caption_language) : null,
    captionName: row.caption_name ? String(row.caption_name) : null,
    srtContent: row.srt_content ? String(row.srt_content) : null,
    selfDeclaredMadeForKids: dbBoolean(row.self_declared_made_for_kids),
    containsSyntheticMedia: dbBoolean(row.contains_synthetic_media),
    uploadKind: row.upload_kind ? String(row.upload_kind) : 'new_video_dubbed_video',
    metadataJson: row.metadata_json ? String(row.metadata_json) : null,
    localizationsJson: row.localizations_json ? String(row.localizations_json) : null,
    status: String(row.status) as QueueStatus,
    retries: Number(row.retries),
    error: row.error ? String(row.error) : null,
    youtubeVideoId: row.youtube_video_id ? String(row.youtube_video_id) : null,
    createdAt: String(row.created_at),
  }
}
