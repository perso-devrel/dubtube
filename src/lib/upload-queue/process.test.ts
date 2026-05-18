import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processUploadQueue } from './process'
import {
  claimPendingUploads,
  completeQueueItem,
  failQueueItem,
} from '@/lib/db/queries/upload-queue'
import { createYouTubeUpload, updateJobLanguageYouTube } from '@/lib/db/queries'
import { getOrRefreshAccessToken } from '@/lib/auth/token-refresh'
import { uploadCaptionToYouTube, uploadVideoToYouTube } from '@/lib/youtube/upload'

vi.mock('@/lib/db/queries/upload-queue', () => ({
  claimPendingUploads: vi.fn(),
  completeQueueItem: vi.fn(),
  failQueueItem: vi.fn(),
}))

vi.mock('@/lib/db/queries', () => ({
  createYouTubeUpload: vi.fn(),
  updateJobLanguageYouTube: vi.fn(),
}))

vi.mock('@/lib/auth/token-refresh', () => ({
  getOrRefreshAccessToken: vi.fn(),
}))

vi.mock('@/lib/youtube/upload', () => ({
  uploadVideoToYouTube: vi.fn(),
  uploadCaptionToYouTube: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const queueItem = {
  id: 10,
  userId: 'user-1',
  jobId: 20,
  langCode: 'en',
  videoUrl: 'https://cdn.perso.ai/video.mp4',
  title: 'Translated title',
  description: 'Translated description',
  tags: 'sub2tube,english',
  categoryId: '22',
  privacyStatus: 'private',
  publishAt: null,
  notifySubscribers: true,
  thumbnailUrl: 'https://cdn.perso.ai/thumb.png',
  playlistIds: ['PL123'],
  language: 'en',
  isShort: false,
  uploadCaptions: true,
  captionLanguage: 'en',
  captionName: '',
  srtContent: '1\n00:00:00,000 --> 00:00:01,000\nHello',
  selfDeclaredMadeForKids: false,
  containsSyntheticMedia: true,
  uploadKind: 'new_video_dubbed_video',
  metadataJson: JSON.stringify({ translated: { en: { title: 'Translated title' } } }),
  localizationsJson: JSON.stringify({ en: { title: 'Translated title', description: 'Translated description' } }),
  status: 'processing' as const,
  retries: 0,
  error: null,
  youtubeVideoId: null,
  createdAt: '2026-05-07T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(claimPendingUploads).mockResolvedValue([])
  vi.mocked(completeQueueItem).mockResolvedValue(true)
  vi.mocked(failQueueItem).mockResolvedValue(true)
})

describe('processUploadQueue', () => {
  it('claims pending uploads with caller filters', async () => {
    const result = await processUploadQueue({ userId: 'user-1', queueId: 10, limit: 1 })

    expect(result).toEqual({ processed: 0, results: [] })
    expect(claimPendingUploads).toHaveBeenCalledWith(1, {
      userId: 'user-1',
      queueId: 10,
    })
  })

  it('uploads a claimed queue item and marks it done', async () => {
    vi.mocked(claimPendingUploads).mockResolvedValueOnce([queueItem])
    vi.mocked(getOrRefreshAccessToken).mockResolvedValueOnce('access-token')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['video'], { type: 'video/mp4' }),
    })
    vi.mocked(uploadVideoToYouTube).mockResolvedValueOnce({
      videoId: 'yt-123',
      title: 'Translated title',
      status: 'uploaded',
    })

    const result = await processUploadQueue()

    expect(result).toEqual({
      processed: 1,
      results: [{ id: 10, status: 'done', videoId: 'yt-123' }],
    })
    expect(uploadVideoToYouTube).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'access-token',
        title: 'Translated title',
        tags: ['sub2tube', 'english'],
        categoryId: '22',
        notifySubscribers: true,
        thumbnailUrl: 'https://cdn.perso.ai/thumb.png',
        playlistIds: ['PL123'],
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
        localizations: { en: { title: 'Translated title', description: 'Translated description' } },
      }),
    )
    expect(uploadCaptionToYouTube).toHaveBeenCalledWith({
      accessToken: 'access-token',
      videoId: 'yt-123',
      language: 'en',
      name: 'English',
      srtContent: queueItem.srtContent,
    })
    expect(completeQueueItem).toHaveBeenCalledWith(10, 'yt-123')
    expect(createYouTubeUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        youtubeVideoId: 'yt-123',
        uploadKind: 'new_video_dubbed_video',
        metadataJson: queueItem.metadataJson,
      }),
    )
    expect(updateJobLanguageYouTube).toHaveBeenCalledWith(20, 'en', 'yt-123')
  })

  it('fails a claimed item when video URL host is not allowed', async () => {
    vi.mocked(claimPendingUploads).mockResolvedValueOnce([
      { ...queueItem, videoUrl: 'https://example.com/video.mp4' },
    ])
    vi.mocked(getOrRefreshAccessToken).mockResolvedValueOnce('access-token')

    const result = await processUploadQueue()

    expect(result.results).toEqual([{ id: 10, status: 'failed', error: 'invalid_domain' }])
    expect(failQueueItem).toHaveBeenCalledWith(10, 'Video URL domain not allowed')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(uploadVideoToYouTube).not.toHaveBeenCalled()
  })

  it('fails a claimed item when no access token can be refreshed', async () => {
    vi.mocked(claimPendingUploads).mockResolvedValueOnce([queueItem])
    vi.mocked(getOrRefreshAccessToken).mockResolvedValueOnce(null)

    const result = await processUploadQueue()

    expect(result.results).toEqual([{ id: 10, status: 'failed', error: 'no_token' }])
    expect(failQueueItem).toHaveBeenCalledWith(10, 'No valid access token - user may need to re-login')
  })
})
