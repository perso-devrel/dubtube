import type { DeliverableMode, PrivacyStatus, VideoSourceType } from '@/features/dubbing/types/dubbing.types'
import type { YouTubeLocalization } from '@/lib/youtube/types'
import { normalizePublishTimeZone } from '@/lib/youtube/publish-schedule'
import { DEFAULT_YOUTUBE_CATEGORY_ID, parsePlaylistIds } from '@/lib/youtube/upload-options'

export type YouTubeUploadKind =
  | 'new_video_dubbed_video'
  | 'new_video_original_captions'
  | 'my_video_dubbed_video'
  | 'my_video_original_captions'

export type YouTubeUploadSourceKind = 'new_video' | 'my_youtube_video'
export type YouTubeUploadTargetAssetKind = 'dubbed_video' | 'original_video'

export interface YouTubeUploadSnapshot {
  version: 1
  uploadKind: YouTubeUploadKind
  sourceKind: YouTubeUploadSourceKind
  targetAssetKind: YouTubeUploadTargetAssetKind
  sourceLanguage: string
  targetLanguage: string
  selectedLanguages: string[]
  settings: {
    title: string
    description: string
    tags: string[]
    categoryId: string
    privacyStatus: PrivacyStatus
    publishAt: string | null
    publishAtTimeZone: string | null
    notifySubscribers: boolean
    thumbnailUrl: string
    playlistIds: string[]
    uploadCaptions: boolean
    selfDeclaredMadeForKids: boolean
    containsSyntheticMedia: boolean
    attachOriginalLink: boolean
  }
  metadata: {
    source: {
      title: string
      description: string
      finalDescription: string
    }
    translated: Record<string, {
      title: string
      description: string
      finalDescription: string
      containsSyntheticMedia: boolean
    }>
    localizations: Record<string, YouTubeLocalization>
  }
  assets: {
    originalVideoUrl: string | null
    originalYouTubeVideoId: string | null
    originalYouTubeUrl: string | null
    dubbedVideoUrl: string | null
    audioUrl: string | null
    srtUrl: string | null
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asPublishAt(value: unknown) {
  const raw = asNullableString(value)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : []
}

function asPlaylistIds(value: unknown) {
  if (Array.isArray(value)) return parsePlaylistIds(value.filter((item): item is string => typeof item === 'string'))
  return parsePlaylistIds(typeof value === 'string' ? value : '')
}

function asPrivacy(value: unknown): PrivacyStatus {
  return value === 'public' || value === 'unlisted' || value === 'private' ? value : 'private'
}

function asUploadKind(value: unknown): YouTubeUploadKind {
  return value === 'new_video_original_captions' ||
    value === 'my_video_dubbed_video' ||
    value === 'my_video_original_captions'
    ? value
    : 'new_video_dubbed_video'
}

function asSourceKind(value: unknown): YouTubeUploadSourceKind {
  return value === 'my_youtube_video' ? 'my_youtube_video' : 'new_video'
}

function asTargetAssetKind(value: unknown): YouTubeUploadTargetAssetKind {
  return value === 'original_video' ? 'original_video' : 'dubbed_video'
}

function normalizeLocalizationMap(value: unknown): Record<string, YouTubeLocalization> {
  const root = asObject(value)
  const entries = Object.entries(root)
    .map(([code, localization]) => {
      const item = asObject(localization)
      const title = asString(item.title).trim()
      if (!title) return null
      return [code, { title, description: asString(item.description) }] as const
    })
    .filter((entry): entry is readonly [string, YouTubeLocalization] => entry !== null)
  return Object.fromEntries(entries)
}

function normalizeTranslatedMap(value: unknown): YouTubeUploadSnapshot['metadata']['translated'] {
  const root = asObject(value)
  const entries = Object.entries(root)
    .map(([code, metadata]) => {
      const item = asObject(metadata)
      const title = asString(item.title).trim()
      if (!title) return null
      return [code, {
        title,
        description: asString(item.description),
        finalDescription: asString(item.finalDescription, asString(item.description)),
        containsSyntheticMedia: asBoolean(item.containsSyntheticMedia, false),
      }] as const
    })
    .filter((entry): entry is readonly [string, YouTubeUploadSnapshot['metadata']['translated'][string]] => entry !== null)
  return Object.fromEntries(entries)
}

export function resolveYouTubeUploadKind(
  sourceType: VideoSourceType | undefined,
  deliverableMode: DeliverableMode,
): YouTubeUploadKind {
  const sourcePrefix = sourceType === 'channel' ? 'my_video' : 'new_video'
  const suffix = deliverableMode === 'originalWithMultiAudio' ? 'original_captions' : 'dubbed_video'
  return `${sourcePrefix}_${suffix}` as YouTubeUploadKind
}

export function parseYouTubeUploadSnapshot(json: string | null | undefined): YouTubeUploadSnapshot | null {
  if (!json) return null
  try {
    const root = asObject(JSON.parse(json))
    const settings = asObject(root.settings)
    const metadata = asObject(root.metadata)
    const source = asObject(metadata.source)
    const assets = asObject(root.assets)
    return {
      version: 1,
      uploadKind: asUploadKind(root.uploadKind),
      sourceKind: asSourceKind(root.sourceKind),
      targetAssetKind: asTargetAssetKind(root.targetAssetKind),
      sourceLanguage: asString(root.sourceLanguage, 'ko'),
      targetLanguage: asString(root.targetLanguage),
      selectedLanguages: asStringArray(root.selectedLanguages),
      settings: {
        title: asString(settings.title),
        description: asString(settings.description),
        tags: asStringArray(settings.tags),
        categoryId: asString(settings.categoryId, DEFAULT_YOUTUBE_CATEGORY_ID).trim() || DEFAULT_YOUTUBE_CATEGORY_ID,
        privacyStatus: asPrivacy(settings.privacyStatus),
        publishAt: asPublishAt(settings.publishAt),
        publishAtTimeZone: normalizePublishTimeZone(settings.publishAtTimeZone),
        notifySubscribers: asBoolean(settings.notifySubscribers, true),
        thumbnailUrl: asString(settings.thumbnailUrl),
        playlistIds: asPlaylistIds(settings.playlistIds),
        uploadCaptions: asBoolean(settings.uploadCaptions, true),
        selfDeclaredMadeForKids: asBoolean(settings.selfDeclaredMadeForKids, false),
        containsSyntheticMedia: asBoolean(settings.containsSyntheticMedia, false),
        attachOriginalLink: asBoolean(settings.attachOriginalLink, true),
      },
      metadata: {
        source: {
          title: asString(source.title),
          description: asString(source.description),
          finalDescription: asString(source.finalDescription, asString(source.description)),
        },
        translated: normalizeTranslatedMap(metadata.translated),
        localizations: normalizeLocalizationMap(metadata.localizations),
      },
      assets: {
        originalVideoUrl: asNullableString(assets.originalVideoUrl),
        originalYouTubeVideoId: asNullableString(assets.originalYouTubeVideoId),
        originalYouTubeUrl: asNullableString(assets.originalYouTubeUrl),
        dubbedVideoUrl: asNullableString(assets.dubbedVideoUrl),
        audioUrl: asNullableString(assets.audioUrl),
        srtUrl: asNullableString(assets.srtUrl),
      },
    }
  } catch {
    return null
  }
}

export function serializeYouTubeUploadSnapshot(snapshot: YouTubeUploadSnapshot): string {
  return JSON.stringify(snapshot)
}

export function snapshotMetadataJson(snapshot: YouTubeUploadSnapshot): string {
  return JSON.stringify(snapshot.metadata)
}

export function snapshotLocalizationsJson(snapshot: YouTubeUploadSnapshot): string {
  return JSON.stringify(snapshot.metadata.localizations)
}
