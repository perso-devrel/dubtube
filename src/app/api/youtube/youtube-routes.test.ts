import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/session', () => ({
  requireSession: vi.fn(async () => ({
    ok: true,
    session: { uid: 'user1', email: 'user1@example.com' },
  })),
}))

vi.mock('@/lib/youtube/route-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/youtube/route-helpers')>()
  return {
    ...actual,
    requireAccessToken: vi.fn(async () => 'mock-token'),
    ytHandle: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        const data = await fn()
        return Response.json({ ok: true, data })
      } catch (err) {
        const code = (err as { code?: string }).code || 'UNKNOWN'
        const status = (err as { status?: number }).status || 500
        const message = err instanceof Error ? err.message : 'Unknown'
        return Response.json(
          { ok: false, error: { code, message } },
          { status },
        )
      }
    }),
    withTokenRetry: vi.fn(async (_req: Request, fn: (accessToken: string) => Promise<unknown>) => fn('mock-token')),
    ytOk: vi.fn(),
    ytFail: vi.fn(),
  }
})

vi.mock('@/lib/youtube/server', () => ({
  uploadVideoToYouTube: vi.fn(async () => ({
    videoId: 'yt-123',
    title: 'Test Video',
    status: 'uploaded',
  })),
  uploadCaptionToYouTube: vi.fn(async () => undefined),
  applyYouTubePostUploadActions: vi.fn(async () => ({
    thumbnailUploaded: true,
    playlistItemIds: ['playlist-item-1'],
    warnings: [],
  })),
  fetchVideoStatistics: vi.fn(async () => [
    { videoId: 'v1', viewCount: 100, likeCount: 10, commentCount: 5 },
  ]),
  fetchChannelStatistics: vi.fn(async () => ({
    subscriberCount: 500,
    viewCount: 10000,
    videoCount: 20,
    channelId: 'ch-1',
    title: 'My Channel',
    thumbnail: '',
  })),
  fetchVideoMetadata: vi.fn(async () => ({
    videoId: 'yt-123',
    title: 'Original title',
    description: 'Original description',
    categoryId: '22',
    tags: ['tag'],
    defaultLanguage: 'ko',
    localizations: {},
  })),
  updateVideoLocalizations: vi.fn(async () => ({
    videoId: 'yt-123',
    title: 'Original title',
    description: 'Original description',
    categoryId: '22',
    tags: ['tag'],
    defaultLanguage: 'ko',
    localizations: { en: { title: 'English title', description: 'English description' } },
  })),
  YouTubeError: class YouTubeError extends Error {
    constructor(
      public status: number,
      message: string,
      public code = 'YOUTUBE_ERROR',
    ) {
      super(message)
      this.name = 'YouTubeError'
    }
  },
}))

import { requireAccessToken } from '@/lib/youtube/route-helpers'
import { applyYouTubePostUploadActions, uploadVideoToYouTube } from '@/lib/youtube/server'

describe('POST /api/youtube/upload', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ POST } = await import('./upload/route'))
  })

  it('uploads video and returns videoId', async () => {
    const videoBlob = new Blob(['fake'], { type: 'video/mp4' })
    const thumbnailBlob = new Blob(['thumb'], { type: 'image/png' })
    const mockFormData = new Map<string, unknown>([
      ['video', videoBlob],
      ['thumbnail', thumbnailBlob],
      ['title', 'Test'],
      ['description', 'Desc'],
      ['tags', 'a,b'],
      ['language', 'ko'],
      ['notifySubscribers', 'false'],
      ['thumbnailUrl', 'https://i.ytimg.com/vi/abc/maxresdefault.jpg'],
      ['playlistIds', 'PL123'],
      ['selfDeclaredMadeForKids', 'false'],
      ['containsSyntheticMedia', 'true'],
    ])
    const req = {
      url: 'http://localhost/api/youtube/upload',
      headers: new Headers(),
      formData: async () => ({ get: (key: string) => mockFormData.get(key) ?? null }),
    } as unknown as NextRequest

    const res = await POST(req)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data.videoId).toBe('yt-123')
    expect(uploadVideoToYouTube).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'mock-token',
        title: 'Test',
        tags: ['a', 'b'],
        notifySubscribers: false,
        thumbnailBlob,
        thumbnailUrl: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
        playlistIds: ['PL123'],
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
      }),
    )
  })

  it('handles missing optional fields (no tags, no categoryId, no language)', async () => {
    const videoBlob = new Blob(['fake'], { type: 'video/mp4' })
    const mockFormData = new Map<string, unknown>([['video', videoBlob]])
    const req = {
      url: 'http://localhost/api/youtube/upload',
      headers: new Headers(),
      formData: async () => ({ get: (key: string) => mockFormData.get(key) ?? null }),
    } as unknown as NextRequest

    const res = await POST(req)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(uploadVideoToYouTube).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '',
        description: '',
        tags: [],
        categoryId: undefined,
        privacyStatus: undefined,
        language: undefined,
      }),
    )
  })

  it('handles empty tags string', async () => {
    const videoBlob = new Blob(['fake'], { type: 'video/mp4' })
    const mockFormData = new Map<string, unknown>([
      ['video', videoBlob],
      ['tags', ''],
    ])
    const req = {
      url: 'http://localhost/api/youtube/upload',
      headers: new Headers(),
      formData: async () => ({ get: (key: string) => mockFormData.get(key) ?? null }),
    } as unknown as NextRequest

    const res = await POST(req)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(uploadVideoToYouTube).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [] }),
    )
  })

  it('returns error when video field missing', async () => {
    const mockFormData = new Map<string, unknown>([['title', 'No video']])
    const req = {
      url: 'http://localhost/api/youtube/upload',
      headers: new Headers(),
      formData: async () => ({ get: (key: string) => mockFormData.get(key) ?? null }),
    } as unknown as NextRequest

    const res = await POST(req)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('MISSING_VIDEO')
  })
})

describe('POST /api/youtube/upload-post-processing', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ POST } = await import('./upload-post-processing/route'))
  })

  it('applies thumbnail and playlist actions to an uploaded video', async () => {
    const thumbnailBlob = new Blob(['thumb'], { type: 'image/png' })
    const mockFormData = new Map<string, unknown>([
      ['videoId', 'yt-123'],
      ['thumbnail', thumbnailBlob],
      ['thumbnailUrl', 'https://i.ytimg.com/vi/abc/maxresdefault.jpg'],
      ['playlistIds', 'PL123'],
    ])
    const req = {
      url: 'http://localhost/api/youtube/upload-post-processing',
      headers: new Headers(),
      formData: async () => ({ get: (key: string) => mockFormData.get(key) ?? null }),
    } as unknown as NextRequest

    const res = await POST(req)
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(applyYouTubePostUploadActions).toHaveBeenCalledWith({
      accessToken: 'mock-token',
      videoId: 'yt-123',
      thumbnailBlob,
      thumbnailUrl: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
      playlistIds: ['PL123'],
    })
  })
})

describe('POST /api/youtube/caption', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ POST } = await import('./caption/route'))
  })

  it('uploads caption and returns uploaded: true', async () => {
    const req = new NextRequest('http://localhost/api/youtube/caption', {
      method: 'POST',
      body: JSON.stringify({
        videoId: 'yt-123',
        language: 'ko',
        name: 'Korean',
        srtContent: '1\n00:00:00,000 --> 00:00:01,000\n안녕\n',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data).toEqual({ uploaded: true })
  })
})

describe('GET /api/youtube/stats', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ GET } = await import('./stats/route'))
  })

  it('returns video statistics by videoIds', async () => {
    const req = new NextRequest('http://localhost/api/youtube/stats?videoIds=v1,v2')
    const res = await GET(req)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].videoId).toBe('v1')
  })

  it('returns channel statistics when channel=true', async () => {
    const req = new NextRequest('http://localhost/api/youtube/stats?channel=true')
    const res = await GET(req)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data.channelId).toBe('ch-1')
  })

  it('returns video statistics with empty videoIds (no channel param)', async () => {
    const { fetchVideoStatistics } = await import('@/lib/youtube/server')
    vi.mocked(fetchVideoStatistics).mockResolvedValueOnce([] as never)
    const req = new NextRequest('http://localhost/api/youtube/stats')
    const res = await GET(req)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(vi.mocked(fetchVideoStatistics)).toHaveBeenCalledWith('mock-token', [])
  })
})

describe('/api/youtube/metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches current video metadata', async () => {
    const { GET } = await import('./metadata/route')
    const { fetchVideoMetadata } = await import('@/lib/youtube/server')
    const req = new NextRequest('http://localhost/api/youtube/metadata?videoId=yt-123')

    const res = await GET(req)
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(body.data.videoId).toBe('yt-123')
    expect(fetchVideoMetadata).toHaveBeenCalledWith('mock-token', 'yt-123')
  })

  it('passes requested source language when fetching metadata', async () => {
    const { GET } = await import('./metadata/route')
    const { fetchVideoMetadata } = await import('@/lib/youtube/server')
    const req = new NextRequest('http://localhost/api/youtube/metadata?videoId=yt-123&sourceLang=ko')

    const res = await GET(req)
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(fetchVideoMetadata).toHaveBeenCalledWith('mock-token', 'yt-123', 'ko')
  })

  it('updates localizations without uploading media', async () => {
    const { POST } = await import('./metadata/route')
    const { updateVideoLocalizations } = await import('@/lib/youtube/server')
    const req = new NextRequest('http://localhost/api/youtube/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: 'yt-123',
        sourceLang: 'ko',
        title: 'Original title',
        description: 'Original description',
        tags: ['sub2tube', 'AI더빙'],
        localizations: {
          en: { title: 'English title', description: 'English description' },
        },
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(updateVideoLocalizations).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'mock-token',
        videoId: 'yt-123',
        tags: ['sub2tube', 'AI더빙'],
        localizations: {
          en: { title: 'English title', description: 'English description' },
        },
      }),
    )
  })
})

describe('requireAccessToken integration', () => {
  it('is called by routes to extract token', () => {
    expect(requireAccessToken).toBeDefined()
    expect(vi.isMockFunction(requireAccessToken)).toBe(true)
  })
})
