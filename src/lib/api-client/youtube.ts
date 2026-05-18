import type {
  ChannelStats,
  MyVideoItem,
  VideoAnalytics,
  VideoStats,
  YouTubeLocalization,
  YouTubeUploadResult,
  YouTubeVideoMetadata,
} from '@/lib/youtube/types'
import { json } from './shared'

const YT = '/api/youtube'

export async function ytUploadVideo(params: {
  video?: File | Blob
  videoUrl?: string
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
  thumbnail?: File | Blob | null
  thumbnailUrl?: string | null
  playlistIds?: string[]
  /** BCP-47 language code → { title, description } 맵. snippet.localizations로 전달. */
  localizations?: Record<string, { title: string; description: string }>
}): Promise<YouTubeUploadResult> {
  // 1. 영상 URL이 있으면 서버가 fetch + 업로드 (더빙 흐름).
  if (params.videoUrl) {
    const form = new FormData()
    form.append('videoUrl', params.videoUrl)
    form.append('title', params.title)
    form.append('description', params.description)
    form.append('tags', params.tags.join(','))
    if (params.categoryId) form.append('categoryId', params.categoryId)
    if (params.privacyStatus) form.append('privacyStatus', params.privacyStatus)
    if (params.publishAt) form.append('publishAt', params.publishAt)
    if (params.notifySubscribers !== undefined) {
      form.append('notifySubscribers', String(params.notifySubscribers))
    }
    if (params.selfDeclaredMadeForKids !== undefined) {
      form.append('selfDeclaredMadeForKids', String(params.selfDeclaredMadeForKids))
    }
    if (params.containsSyntheticMedia !== undefined) {
      form.append('containsSyntheticMedia', String(params.containsSyntheticMedia))
    }
    if (params.language) form.append('language', params.language)
    if (params.thumbnail) form.append('thumbnail', params.thumbnail)
    if (params.thumbnailUrl) form.append('thumbnailUrl', params.thumbnailUrl)
    if (params.playlistIds?.length) form.append('playlistIds', params.playlistIds.join(','))
    if (params.localizations && Object.keys(params.localizations).length > 0) {
      form.append('localizations', JSON.stringify(params.localizations))
    }

    const res = await fetch(`${YT}/upload`, {
      method: 'POST',
      body: form,
    })
    return json<YouTubeUploadResult>(res)
  }

  // 2. 로컬 영상 파일은 브라우저 → YouTube 직접 resumable upload로 보낸다.
  //    Vercel 함수의 4.5MB 본문 한도를 우회하고, 서버는 session URI 발급만 책임진다.
  if (!params.video) {
    throw new Error('영상 파일 또는 videoUrl이 필요합니다')
  }
  const video = params.video

  const sessionRes = await fetch(`${YT}/upload-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentType: video.type || 'video/mp4',
      contentLength: video.size,
      title: params.title,
      description: params.description,
      tags: params.tags,
      categoryId: params.categoryId,
      privacyStatus: params.privacyStatus,
      publishAt: params.publishAt,
      notifySubscribers: params.notifySubscribers,
      selfDeclaredMadeForKids: params.selfDeclaredMadeForKids,
      containsSyntheticMedia: params.containsSyntheticMedia,
      language: params.language,
      localizations: params.localizations,
    }),
  })
  const session = await json<{ uploadUrl: string }>(sessionRes)

  const putRes = await fetch(session.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': video.type || 'video/mp4' },
    body: video,
  })
  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => '')
    console.warn('[sub2tube] YouTube direct upload failed', {
      status: putRes.status,
      detail,
    })
    throw new Error('YouTube 업로드를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
  const data = (await putRes.json()) as {
    id: string
    snippet?: { title?: string }
    status?: { uploadStatus?: string }
  }
  const result: YouTubeUploadResult = {
    videoId: data.id,
    title: data.snippet?.title || params.title,
    status: data.status?.uploadStatus || 'uploaded',
  }
  const hasPostUploadActions =
    Boolean(params.thumbnail) ||
    Boolean(params.thumbnailUrl) ||
    Boolean(params.playlistIds?.length)
  if (!hasPostUploadActions) return result

  const postForm = new FormData()
  postForm.append('videoId', result.videoId)
  if (params.thumbnail) postForm.append('thumbnail', params.thumbnail)
  if (params.thumbnailUrl) postForm.append('thumbnailUrl', params.thumbnailUrl)
  if (params.playlistIds?.length) postForm.append('playlistIds', params.playlistIds.join(','))
  const postRes = await fetch(`${YT}/upload-post-processing`, {
    method: 'POST',
    body: postForm,
  })
  result.postProcessing = await json<YouTubeUploadResult['postProcessing']>(postRes)
  return result
}

export async function ytUploadCaption(params: {
  videoId: string
  language: string
  name: string
  srtContent: string
  /** true면 동일 language의 기존 자막 트랙을 삭제하고 교체한다. */
  replace?: boolean
}): Promise<{ uploaded: true }> {
  const res = await fetch(`${YT}/caption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return json(res)
}

export interface YouTubeCaptionTrack {
  id: string
  language: string
  name: string
}

export async function ytListCaptions(videoId: string): Promise<YouTubeCaptionTrack[]> {
  const qs = new URLSearchParams({ videoId }).toString()
  const res = await fetch(`${YT}/caption?${qs}`, { cache: 'no-store' })
  const data = await json<{ captions: YouTubeCaptionTrack[] }>(res)
  return data.captions ?? []
}

export async function ytFetchChannelStats(): Promise<ChannelStats | null> {
  const res = await fetch(`${YT}/stats?channel=true`, { cache: 'no-store' })
  return json(res)
}

export async function ytFetchVideoStats(
  videoIds: string[],
): Promise<VideoStats[]> {
  const qs = new URLSearchParams({ videoIds: videoIds.join(',') }).toString()
  const res = await fetch(`${YT}/stats?${qs}`, { cache: 'no-store' })
  return json(res)
}

export async function ytFetchMyVideos(
  maxResults = 10,
): Promise<MyVideoItem[]> {
  const res = await fetch(`${YT}/videos?maxResults=${maxResults}`, { cache: 'no-store' })
  return json(res)
}

export async function ytFetchVideoMetadata(videoId: string, sourceLang?: string): Promise<YouTubeVideoMetadata> {
  const params = new URLSearchParams({ videoId })
  if (sourceLang) params.set('sourceLang', sourceLang)
  const res = await fetch(`${YT}/metadata?${params}`, { cache: 'no-store' })
  return json(res)
}

export async function ytUpdateVideoLocalizations(params: {
  videoId: string
  sourceLang: string
  title: string
  description: string
  tags?: string[]
  localizations: Record<string, YouTubeLocalization>
}): Promise<YouTubeVideoMetadata> {
  const res = await fetch(`${YT}/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return json(res)
}

export async function ytFetchAnalytics(
  videoIds: string[],
  startDate?: string,
  endDate?: string,
): Promise<VideoAnalytics[]> {
  const params = new URLSearchParams({
    videoIds: videoIds.join(','),
  })
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const res = await fetch(`${YT}/analytics?${params}`, { cache: 'no-store' })
  return json(res)
}
