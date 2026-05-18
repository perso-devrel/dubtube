export type DubbingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type DeliverableMode = 'newDubbedVideos' | 'originalWithMultiAudio' | 'downloadOnly'

export type PrivacyStatus = 'public' | 'unlisted' | 'private'

export interface UploadSettings {
  autoUpload: boolean
  attachOriginalLink: boolean
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
  uploadReviewConfirmed: boolean
  /**
   * 사용자가 작성한 제목/설명의 언어. 다른 대상 언어로 자동 번역하는 기준.
   * 마이페이지의 `defaultLanguage`로 초기화되며 더빙별로 override 가능.
   */
  metadataLanguage: string
}

export type JobStatus = 'idle' | 'transcribing' | 'translating' | 'synthesizing' | 'lip-syncing' | 'merging' | 'completed' | 'failed'

export type VideoSourceType = 'url' | 'upload' | 'channel'

export interface VideoSource {
  type: VideoSourceType
  url?: string
  file?: File
  videoId?: string
}

export interface VideoMetadata {
  id: string
  title: string
  description?: string
  thumbnail: string
  duration: number // seconds
  durationMs: number // milliseconds (from Perso)
  channelTitle: string
  width?: number
  height?: number
}

export interface TranslationSegment {
  id: string
  sentenceSeq: number
  audioSentenceSeq: number
  startTime: number
  endTime: number
  originalText: string
  translatedText: string
  excluded: boolean
  locked: boolean
  audioUrl?: string
}

export interface LanguageProgress {
  langCode: string
  projectSeq: number
  status: JobStatus
  progress: number
  progressReason: string
  audioUrl?: string
  srtUrl?: string
  dubbingVideoUrl?: string
}

type YouTubeUploadStatus = 'uploading' | 'done' | 'error'

export interface YouTubeUploadState {
  status: YouTubeUploadStatus
  progress: number
  videoId?: string
  error?: string
}

export interface GlossaryEntry {
  id: string
  original: string
  translations: Record<string, string>
  locked: boolean
}
