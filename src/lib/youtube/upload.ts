import 'server-only'

import type {
  YouTubeLocalization,
  YouTubePostUploadResult,
  YouTubeUploadResult,
} from '@/lib/youtube/types'
import { resolveCaptionTrackName } from '@/lib/youtube/captions'
import { YouTubeError } from '@/lib/youtube/error'
import { DEFAULT_YOUTUBE_CATEGORY_ID, parsePlaylistIds } from '@/lib/youtube/upload-options'
import { effectivePrivacyStatus, normalizePublishAt } from '@/lib/youtube/publish-schedule'

const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3'
const YOUTUBE_DATA_BASE = 'https://www.googleapis.com/youtube/v3'
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024
const THUMBNAIL_CONTENT_TYPES = new Set([
  '',
  'application/octet-stream',
  'image/jpeg',
  'image/png',
])
const THUMBNAIL_URL_ALLOWED_DOMAINS = [
  '.blob.core.windows.net',
  '.perso.ai',
  'perso.ai',
  'i.ytimg.com',
  'img.youtube.com',
  'yt3.ggpht.com',
  'lh3.googleusercontent.com',
]

function normalizeLanguageTag(language?: string | null) {
  return language?.trim().toLowerCase() || ''
}

function baseLanguage(language: string) {
  return normalizeLanguageTag(language).split('-')[0] || ''
}

function isSameLanguage(left?: string | null, right?: string | null) {
  const a = normalizeLanguageTag(left)
  const b = normalizeLanguageTag(right)
  if (!a || !b) return false
  return a === b || baseLanguage(a) === baseLanguage(b)
}

function omitLanguage(
  localizations: Record<string, YouTubeLocalization> | undefined,
  language: string,
) {
  if (!localizations) return undefined
  return Object.fromEntries(
    Object.entries(localizations).filter(([code]) => !isSameLanguage(code, language)),
  )
}

export interface YouTubeUploadInput {
  accessToken: string
  videoBlob: Blob
  title: string
  description: string
  tags: string[]
  categoryId?: string
  privacyStatus?: 'public' | 'unlisted' | 'private'
  publishAt?: string | null
  notifySubscribers?: boolean
  selfDeclaredMadeForKids?: boolean
  containsSyntheticMedia?: boolean
  language?: string
  thumbnailBlob?: Blob
  thumbnailUrl?: string | null
  playlistIds?: string[]
  /**
   * BCP-47 언어 코드를 키로 한 추가 번역 맵.
   * snippet.defaultLanguage가 함께 설정돼야 YouTube가 적용한다.
   */
  localizations?: Record<string, YouTubeLocalization>
}

export interface YouTubeUploadSessionInput {
  accessToken: string
  contentLength: number
  contentType: string
  title: string
  description: string
  tags: string[]
  categoryId?: string
  privacyStatus?: 'public' | 'unlisted' | 'private'
  publishAt?: string | null
  notifySubscribers?: boolean
  selfDeclaredMadeForKids?: boolean
  containsSyntheticMedia?: boolean
  language?: string
  localizations?: Record<string, YouTubeLocalization>
  /**
   * 브라우저에서 직접 session URI로 PUT할 경우, 그 origin을 init 요청 헤더에
   * 포함해야 YouTube가 응답 URI에 Access-Control-Allow-Origin 헤더를 부여한다.
   * 서버사이드에서 PUT까지 책임지는 경로는 생략해도 무방.
   */
  origin?: string
}

export interface YouTubePostUploadActionsInput {
  accessToken: string
  videoId: string
  thumbnailBlob?: Blob
  thumbnailUrl?: string | null
  playlistIds?: string[]
}

function isAllowedUrlHost(url: string, allowedDomains: string[]) {
  try {
    const urlHost = new URL(url).hostname
    return allowedDomains.some((domain) => {
      if (domain.startsWith('.')) return urlHost.endsWith(domain)
      return urlHost === domain || urlHost.endsWith(`.${domain}`)
    })
  } catch {
    return false
  }
}

function validateThumbnailBlob(thumbnailBlob: Blob) {
  if (thumbnailBlob.size <= 0) {
    throw new YouTubeError(400, 'Thumbnail image is empty', 'INVALID_THUMBNAIL')
  }
  if (thumbnailBlob.size > MAX_THUMBNAIL_BYTES) {
    throw new YouTubeError(400, 'Thumbnail image must be 2MB or smaller', 'INVALID_THUMBNAIL')
  }
  const contentType = thumbnailBlob.type.toLowerCase()
  if (!THUMBNAIL_CONTENT_TYPES.has(contentType)) {
    throw new YouTubeError(400, 'Thumbnail must be a JPEG or PNG image', 'INVALID_THUMBNAIL')
  }
}

async function thumbnailBlobFromUrl(thumbnailUrl: string): Promise<Blob> {
  if (!thumbnailUrl.trim()) {
    throw new YouTubeError(400, 'Thumbnail URL is empty', 'INVALID_THUMBNAIL_URL')
  }
  if (!isAllowedUrlHost(thumbnailUrl, THUMBNAIL_URL_ALLOWED_DOMAINS)) {
    throw new YouTubeError(400, 'Thumbnail URL domain not allowed', 'INVALID_THUMBNAIL_URL')
  }
  const res = await fetch(thumbnailUrl)
  if (!res.ok) {
    throw new YouTubeError(502, 'Failed to fetch thumbnail image', 'THUMBNAIL_FETCH_FAILED')
  }
  const contentLength = Number(res.headers.get('content-length') || 0)
  if (contentLength > MAX_THUMBNAIL_BYTES) {
    throw new YouTubeError(400, 'Thumbnail image must be 2MB or smaller', 'INVALID_THUMBNAIL')
  }
  return res.blob()
}

async function resolveThumbnailBlob(input: YouTubePostUploadActionsInput): Promise<Blob | null> {
  const directBlob = input.thumbnailBlob
  if (directBlob && directBlob.size > 0) {
    validateThumbnailBlob(directBlob)
    return directBlob
  }

  const thumbnailUrl = input.thumbnailUrl?.trim()
  if (!thumbnailUrl) return null
  const fetchedBlob = await thumbnailBlobFromUrl(thumbnailUrl)
  validateThumbnailBlob(fetchedBlob)
  return fetchedBlob
}

async function uploadThumbnailToYouTube(
  accessToken: string,
  videoId: string,
  thumbnailBlob: Blob,
): Promise<void> {
  const contentType = thumbnailBlob.type || 'application/octet-stream'
  const qs = new URLSearchParams({
    uploadType: 'media',
    videoId,
  })
  const res = await fetch(`${YOUTUBE_UPLOAD_BASE}/thumbnails/set?${qs.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: thumbnailBlob,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new YouTubeError(
      res.status,
      `Thumbnail upload failed: ${err}`,
      'THUMBNAIL_UPLOAD_FAILED',
    )
  }
}

async function addVideoToPlaylist(
  accessToken: string,
  videoId: string,
  playlistId: string,
): Promise<string> {
  const res = await fetch(`${YOUTUBE_DATA_BASE}/playlistItems?part=snippet`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      snippet: {
        playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId,
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new YouTubeError(
      res.status,
      `Playlist insert failed: ${err}`,
      'PLAYLIST_INSERT_FAILED',
    )
  }

  const data = (await res.json()) as { id?: string }
  return data.id || playlistId
}

function warningMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Unknown error'
}

export async function applyYouTubePostUploadActions(
  input: YouTubePostUploadActionsInput,
): Promise<YouTubePostUploadResult> {
  const result: YouTubePostUploadResult = {
    thumbnailUploaded: false,
    playlistItemIds: [],
    warnings: [],
  }

  try {
    const thumbnailBlob = await resolveThumbnailBlob(input)
    if (thumbnailBlob) {
      await uploadThumbnailToYouTube(input.accessToken, input.videoId, thumbnailBlob)
      result.thumbnailUploaded = true
    }
  } catch (err) {
    result.warnings.push({ action: 'thumbnail', message: warningMessage(err) })
  }

  for (const playlistId of parsePlaylistIds(input.playlistIds ?? [])) {
    try {
      const playlistItemId = await addVideoToPlaylist(input.accessToken, input.videoId, playlistId)
      result.playlistItemIds.push(playlistItemId)
    } catch (err) {
      result.warnings.push({ action: 'playlist', message: warningMessage(err) })
    }
  }

  return result
}

/**
 * YouTube resumable upload 세션을 시작하고 Location 헤더의 session URI를 반환한다.
 * 반환된 URI로 PUT하면 YouTube에 영상 바이너리가 직접 업로드된다 — Vercel 함수 body 한도(4.5MB)와 무관.
 */
export async function initYouTubeResumableUpload(
  input: YouTubeUploadSessionInput,
): Promise<{ uploadUrl: string }> {
  const {
    accessToken,
    contentLength,
    contentType,
    title,
    description,
    tags,
    categoryId = DEFAULT_YOUTUBE_CATEGORY_ID,
    privacyStatus = 'private',
    publishAt,
    notifySubscribers,
    selfDeclaredMadeForKids = false,
    containsSyntheticMedia = false,
    language = 'en',
    localizations,
    origin,
  } = input

  const filteredLocalizations = omitLanguage(localizations, language)
  const hasLocalizations = !!filteredLocalizations && Object.keys(filteredLocalizations).length > 0
  const normalizedPublishAt = normalizePublishAt(publishAt)
  if (normalizedPublishAt && new Date(normalizedPublishAt).getTime() <= Date.now()) {
    throw new YouTubeError(
      400,
      'Scheduled publish time must be in the future',
      'INVALID_PUBLISH_AT',
    )
  }
  const metadata: Record<string, unknown> = {
    snippet: {
      title,
      description,
      tags,
      categoryId,
      defaultLanguage: language,
      defaultAudioLanguage: language,
    },
    status: {
      privacyStatus: effectivePrivacyStatus(privacyStatus, normalizedPublishAt),
      ...(normalizedPublishAt ? { publishAt: normalizedPublishAt } : {}),
      selfDeclaredMadeForKids,
      containsSyntheticMedia,
    },
  }
  if (hasLocalizations) {
    metadata.localizations = filteredLocalizations
  }
  const parts = ['snippet', 'status', ...(hasLocalizations ? ['localizations'] : [])].join(',')

  const initHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Length': String(contentLength),
    'X-Upload-Content-Type': contentType || 'video/mp4',
  }
  if (origin) {
    // YouTube는 init 시 Origin이 들어오면 응답 session URI에 CORS 헤더를 부여한다.
    initHeaders.Origin = origin
  }

  const query = new URLSearchParams({
    uploadType: 'resumable',
    part: parts,
  })
  if (notifySubscribers !== undefined) {
    query.set('notifySubscribers', String(notifySubscribers))
  }

  const initRes = await fetch(
    `${YOUTUBE_UPLOAD_BASE}/videos?${query.toString()}`,
    {
      method: 'POST',
      headers: initHeaders,
      body: JSON.stringify(metadata),
    },
  )

  if (!initRes.ok) {
    const err = await initRes.text()
    throw new YouTubeError(
      initRes.status,
      `YouTube upload init failed: ${err}`,
      'UPLOAD_INIT_FAILED',
    )
  }

  const uploadUrl = initRes.headers.get('Location')
  if (!uploadUrl) {
    throw new YouTubeError(
      500,
      'YouTube did not return a resumable upload URL',
      'NO_UPLOAD_URL',
    )
  }

  return { uploadUrl }
}

export async function uploadVideoToYouTube(
  input: YouTubeUploadInput,
): Promise<YouTubeUploadResult> {
  const { accessToken, videoBlob, title } = input

  const { uploadUrl } = await initYouTubeResumableUpload({
    accessToken,
    contentLength: videoBlob.size,
    contentType: videoBlob.type || 'video/mp4',
    title,
    description: input.description,
    tags: input.tags,
    categoryId: input.categoryId,
    privacyStatus: input.privacyStatus,
    publishAt: input.publishAt,
    notifySubscribers: input.notifySubscribers,
    selfDeclaredMadeForKids: input.selfDeclaredMadeForKids,
    containsSyntheticMedia: input.containsSyntheticMedia,
    language: input.language,
    localizations: input.localizations,
  })

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': videoBlob.type || 'video/mp4',
    },
    body: videoBlob,
  })

  if (!putRes.ok) {
    const err = await putRes.text()
    throw new YouTubeError(
      putRes.status,
      `YouTube upload failed: ${err}`,
      'UPLOAD_FAILED',
    )
  }

  const result = (await putRes.json()) as {
    id: string
    snippet?: { title?: string }
    status?: { uploadStatus?: string }
  }

  const uploadResult: YouTubeUploadResult = {
    videoId: result.id,
    title: result.snippet?.title || title,
    status: result.status?.uploadStatus || 'uploaded',
  }
  const postProcessing = await applyYouTubePostUploadActions({
    accessToken,
    videoId: result.id,
    thumbnailBlob: input.thumbnailBlob,
    thumbnailUrl: input.thumbnailUrl,
    playlistIds: input.playlistIds,
  })
  if (
    postProcessing.thumbnailUploaded ||
    postProcessing.playlistItemIds.length > 0 ||
    postProcessing.warnings.length > 0
  ) {
    uploadResult.postProcessing = postProcessing
  }
  return uploadResult
}

export interface CaptionUploadInput {
  accessToken: string
  videoId: string
  language: string
  name: string
  srtContent: string
  /** true면 동일 language의 기존 캡션을 모두 삭제한 뒤 새 SRT를 삽입한다. */
  replace?: boolean
}

export interface CaptionListItem {
  id: string
  snippet?: { language?: string; name?: string }
}

export async function listCaptionsForVideo(
  accessToken: string,
  videoId: string,
): Promise<CaptionListItem[]> {
  const res = await fetch(
    `${YOUTUBE_DATA_BASE}/captions?videoId=${encodeURIComponent(videoId)}&part=snippet`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    const err = await res.text()
    throw new YouTubeError(
      res.status,
      `Caption list failed: ${err}`,
      'CAPTION_LIST_FAILED',
    )
  }
  const data = (await res.json()) as { items?: CaptionListItem[] }
  return data.items ?? []
}

async function deleteCaption(
  accessToken: string,
  captionId: string,
): Promise<void> {
  const res = await fetch(
    `${YOUTUBE_DATA_BASE}/captions?id=${encodeURIComponent(captionId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )
  if (!res.ok && res.status !== 404) {
    const err = await res.text()
    throw new YouTubeError(
      res.status,
      `Caption delete failed: ${err}`,
      'CAPTION_DELETE_FAILED',
    )
  }
}

export async function uploadCaptionToYouTube(
  input: CaptionUploadInput,
): Promise<void> {
  const { accessToken, videoId, language, srtContent, replace } = input
  const name = resolveCaptionTrackName(language, input.name)

  if (replace) {
    const existing = await listCaptionsForVideo(accessToken, videoId)
    const sameLang = existing.filter(
      (c) => (c.snippet?.language || '').toLowerCase() === language.toLowerCase(),
    )
    for (const c of sameLang) {
      await deleteCaption(accessToken, c.id)
    }
  }

  const metadata = { snippet: { videoId, language, name } }
  const boundary = `caption_boundary_${Date.now()}`
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/x-subrip\r\n\r\n` +
    srtContent +
    `\r\n--${boundary}--`

  const res = await fetch(
    `${YOUTUBE_UPLOAD_BASE}/captions?uploadType=multipart&part=snippet`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new YouTubeError(
      res.status,
      `Caption upload failed: ${err}`,
      'CAPTION_UPLOAD_FAILED',
    )
  }
}
