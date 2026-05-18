import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockExecute = vi.fn()

vi.mock('@/lib/db/client', () => ({
  getDb: vi.fn(() => ({
    execute: mockExecute,
  })),
}))

import {
  failJobLanguageYouTubeUpload,
  startJobLanguageYouTubeUpload,
} from './youtube'

describe('youtube db queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reserves a language upload before the YouTube request starts', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ youtube_video_id: null, youtube_upload_status: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowsAffected: 1 })

    await expect(startJobLanguageYouTubeUpload(35, 'en')).resolves.toEqual({
      status: 'reserved',
    })
    expect(mockExecute).toHaveBeenNthCalledWith(3, {
      sql: expect.stringContaining("youtube_upload_status = 'uploading'"),
      args: [35, 'en'],
    })
  })

  it('returns existing video id instead of reserving again', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ youtube_video_id: 'yt-123', youtube_upload_status: 'uploaded' }],
    })

    await expect(startJobLanguageYouTubeUpload(35, 'en')).resolves.toEqual({
      status: 'already_uploaded',
      youtubeVideoId: 'yt-123',
    })
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  it('blocks when another upload is already in progress', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ youtube_video_id: null, youtube_upload_status: 'uploading' }],
    }).mockResolvedValueOnce({ rows: [] })

    await expect(startJobLanguageYouTubeUpload(35, 'en')).resolves.toEqual({
      status: 'already_uploading',
    })
    expect(mockExecute).toHaveBeenCalledTimes(2)
  })

  it('uses a completed queue record instead of reserving again', async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [{ youtube_video_id: null, youtube_upload_status: null }],
      })
      .mockResolvedValueOnce({
        rows: [{ youtube_video_id: 'yt-from-queue' }],
      })
      .mockResolvedValueOnce({ rowsAffected: 1 })

    await expect(startJobLanguageYouTubeUpload(35, 'en')).resolves.toEqual({
      status: 'already_uploaded',
      youtubeVideoId: 'yt-from-queue',
    })
    expect(mockExecute).toHaveBeenNthCalledWith(3, {
      sql: expect.stringContaining("youtube_upload_status = 'uploaded'"),
      args: ['yt-from-queue', 35, 'en'],
    })
  })

  it('marks a reserved upload as failed so the user can retry', async () => {
    mockExecute.mockResolvedValueOnce({ rowsAffected: 1 })

    await failJobLanguageYouTubeUpload(35, 'en')

    expect(mockExecute).toHaveBeenCalledWith({
      sql: expect.stringContaining("youtube_upload_status = 'failed'"),
      args: [35, 'en'],
    })
  })
})
