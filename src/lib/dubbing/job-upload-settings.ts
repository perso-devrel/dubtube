import { getDefaultPublishTimeZone, normalizePublishTimeZone } from '@/lib/youtube/publish-schedule'

export type PersistedDeliverableMode = 'newDubbedVideos' | 'originalWithMultiAudio' | 'downloadOnly'

export type PersistedPrivacyStatus = 'public' | 'unlisted' | 'private'

export interface PersistedUploadSettings {
  autoUpload: boolean
  attachOriginalLink: boolean
  title: string
  description: string
  tags: string[]
  privacyStatus: PersistedPrivacyStatus
  publishAt: string | null
  publishAtTimeZone: string | null
  uploadCaptions: boolean
  selfDeclaredMadeForKids: boolean
  containsSyntheticMedia: boolean
  uploadReviewConfirmed: boolean
  metadataLanguage: string
}

export interface PersistedJobUploadSettings {
  deliverableMode: PersistedDeliverableMode
  uploadSettings: PersistedUploadSettings
  originalVideoUrl: string | null
  originalYouTubeUrl: string | null
}

const DEFAULT_UPLOAD_SETTINGS: PersistedUploadSettings = {
  autoUpload: false,
  attachOriginalLink: true,
  title: '',
  description: '',
  tags: [],
  privacyStatus: 'private',
  publishAt: null,
  publishAtTimeZone: getDefaultPublishTimeZone(),
  uploadCaptions: true,
  selfDeclaredMadeForKids: false,
  containsSyntheticMedia: true,
  uploadReviewConfirmed: false,
  metadataLanguage: 'ko',
}

const DEFAULT_JOB_UPLOAD_SETTINGS: PersistedJobUploadSettings = {
  deliverableMode: 'newDubbedVideos',
  uploadSettings: DEFAULT_UPLOAD_SETTINGS,
  originalVideoUrl: null,
  originalYouTubeUrl: null,
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asPublishAt(value: unknown): string | null {
  const raw = asNullableString(value)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function asPrivacy(value: unknown): PersistedPrivacyStatus {
  return value === 'public' || value === 'unlisted' || value === 'private'
    ? value
    : DEFAULT_UPLOAD_SETTINGS.privacyStatus
}

function asDeliverableMode(value: unknown): PersistedDeliverableMode {
  return value === 'newDubbedVideos' || value === 'originalWithMultiAudio' || value === 'downloadOnly'
    ? value
    : DEFAULT_JOB_UPLOAD_SETTINGS.deliverableMode
}

export function normalizeJobUploadSettings(value: unknown): PersistedJobUploadSettings {
  const root = asObject(value)
  const uploadSettings = asObject(root.uploadSettings)
  return {
    deliverableMode: asDeliverableMode(root.deliverableMode),
    originalVideoUrl: asNullableString(root.originalVideoUrl),
    originalYouTubeUrl: asNullableString(root.originalYouTubeUrl),
    uploadSettings: {
      autoUpload: asBoolean(uploadSettings.autoUpload, DEFAULT_UPLOAD_SETTINGS.autoUpload),
      attachOriginalLink: asBoolean(uploadSettings.attachOriginalLink, DEFAULT_UPLOAD_SETTINGS.attachOriginalLink),
      title: asString(uploadSettings.title),
      description: asString(uploadSettings.description),
      tags: asTags(uploadSettings.tags),
      privacyStatus: asPrivacy(uploadSettings.privacyStatus),
      publishAt: asPublishAt(uploadSettings.publishAt),
      publishAtTimeZone: normalizePublishTimeZone(uploadSettings.publishAtTimeZone),
      uploadCaptions: asBoolean(uploadSettings.uploadCaptions, DEFAULT_UPLOAD_SETTINGS.uploadCaptions),
      selfDeclaredMadeForKids: asBoolean(
        uploadSettings.selfDeclaredMadeForKids,
        DEFAULT_UPLOAD_SETTINGS.selfDeclaredMadeForKids,
      ),
      containsSyntheticMedia: asBoolean(
        uploadSettings.containsSyntheticMedia,
        DEFAULT_UPLOAD_SETTINGS.containsSyntheticMedia,
      ),
      uploadReviewConfirmed: asBoolean(
        uploadSettings.uploadReviewConfirmed,
        DEFAULT_UPLOAD_SETTINGS.uploadReviewConfirmed,
      ),
      metadataLanguage: asString(uploadSettings.metadataLanguage, DEFAULT_UPLOAD_SETTINGS.metadataLanguage),
    },
  }
}

export function parseJobUploadSettings(json: string | null | undefined): PersistedJobUploadSettings {
  if (!json) return DEFAULT_JOB_UPLOAD_SETTINGS
  try {
    return normalizeJobUploadSettings(JSON.parse(json))
  } catch {
    return DEFAULT_JOB_UPLOAD_SETTINGS
  }
}

export function serializeJobUploadSettings(value: unknown): string {
  return JSON.stringify(normalizeJobUploadSettings(value))
}
