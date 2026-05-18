import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueueCompletedDubbingUpload } from './process'
import {
  getDubbingJobLanguageWorkItem,
  updateJobLanguageCompleted,
} from '@/lib/db/queries'
import { persoFetch } from '@/lib/perso/client'
import { enqueueYouTubeUpload } from '@/lib/upload-queue/enqueue'
import { translateMetadata } from '@/lib/translate/gemini'

vi.mock('@/lib/db/queries', () => ({
  finalizeJobCredits: vi.fn(),
  getDubbingJobLanguageWorkItem: vi.fn(),
  getDubbingJobLanguageWorkItems: vi.fn(),
  getJobLanguageTerminalSummary: vi.fn(),
  updateJobLanguageCompleted: vi.fn(),
  updateJobLanguageProgress: vi.fn(),
  updateJobStatus: vi.fn(),
}))

vi.mock('@/lib/perso/client', () => ({
  persoFetch: vi.fn(),
}))

vi.mock('@/lib/upload-queue/enqueue', () => ({
  enqueueYouTubeUpload: vi.fn(),
}))

vi.mock('@/lib/translate/gemini', () => ({
  translateMetadata: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/ops/observability', () => ({
  recordOperationalEventSafe: vi.fn(),
}))

const uploadSettings = {
  deliverableMode: 'newDubbedVideos' as const,
  originalVideoUrl: null,
  originalYouTubeUrl: null,
  uploadSettings: {
    autoUpload: false,
    attachOriginalLink: false,
    title: 'Base title',
    description: 'Base description',
    tags: ['sub2tube'],
    categoryId: '22',
    privacyStatus: 'private' as const,
    publishAt: null,
    publishAtTimeZone: 'UTC',
    notifySubscribers: true,
    thumbnailUrl: '',
    playlistIds: [],
    uploadCaptions: false,
    selfDeclaredMadeForKids: false,
    containsSyntheticMedia: true,
    uploadReviewConfirmed: true,
    metadataLanguage: 'ko',
  },
}

const workItem = {
  jobId: 10,
  userId: 'user-1',
  videoTitle: 'Source video',
  videoDurationMs: 120_000,
  isShort: false,
  spaceSeq: 7,
  deliverableMode: 'newDubbedVideos' as const,
  uploadSettings,
  languageCode: 'en',
  projectSeq: 99,
  languageStatus: 'completed',
  progress: 100,
  progressReason: 'COMPLETED',
  dubbedVideoUrl: null,
  audioUrl: null,
  srtUrl: null,
  youtubeVideoId: null,
  youtubeUploadStatus: null,
  youtubeUploadSnapshot: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getDubbingJobLanguageWorkItem).mockResolvedValue(workItem)
  vi.mocked(updateJobLanguageCompleted).mockResolvedValue()
  vi.mocked(translateMetadata).mockResolvedValue({
    en: { title: 'Translated title', description: 'Translated description' },
  })
  vi.mocked(enqueueYouTubeUpload).mockResolvedValue({ status: 'queued', queueId: 123 })
})

describe('enqueueCompletedDubbingUpload', () => {
  it('uses target=dubbingVideo when target=all does not include the dubbed video URL', async () => {
    vi.mocked(persoFetch).mockImplementation(async (_path, opts) => {
      const target = opts?.query?.target
      if (target === 'dubbingVideo') {
        return { videoFile: { videoDownloadLink: '/files/dubbed.mp4' } }
      }
      if (target === 'all') {
        return {
          audioFile: { voiceAudioDownloadLink: '/files/voice.wav' },
          srtFile: { translatedSubtitleDownloadLink: '/files/subtitle.srt' },
        }
      }
      return {}
    })

    const result = await enqueueCompletedDubbingUpload(10, 'en', { force: true })

    expect(result).toEqual({ status: 'queued', queueId: 123 })
    expect(persoFetch).toHaveBeenCalledWith(
      '/video-translator/api/v1/projects/99/spaces/7/download',
      { baseURL: 'api', query: { target: 'dubbingVideo' } },
    )
    expect(updateJobLanguageCompleted).toHaveBeenCalledWith(10, 'en', {
      dubbedVideoUrl: 'https://portal-media.perso.ai/files/dubbed.mp4',
      audioUrl: 'https://portal-media.perso.ai/files/voice.wav',
      srtUrl: 'https://portal-media.perso.ai/files/subtitle.srt',
    })
    expect(enqueueYouTubeUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 10,
        langCode: 'en',
        videoUrl: 'https://portal-media.perso.ai/files/dubbed.mp4',
        title: 'Translated title',
        resetFailed: true,
      }),
    )
  })
})
