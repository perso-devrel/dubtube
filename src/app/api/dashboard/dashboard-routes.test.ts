import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/session', () => ({
  requireSession: vi.fn(),
  forbiddenUidMismatch: vi.fn(
    () =>
      Response.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'UID mismatch' } },
        { status: 403 },
      ),
  ),
}))

vi.mock('@/lib/db/queries', () => ({
  getUserSummary: vi.fn(async () => ({ totalJobs: 5 })),
  getUserDubbingJobs: vi.fn(async () => []),
  getCreditUsageByMonth: vi.fn(async () => []),
  getLanguagePerformance: vi.fn(async () => []),
  getUserYouTubeUploads: vi.fn(async () => []),
  updateYouTubeStats: vi.fn(),
  createDubbingJob: vi.fn(async () => 1),
  createJobLanguages: vi.fn(),
  updateJobLanguageProgress: vi.fn(),
  updateJobLanguageCompleted: vi.fn(),
  updateJobStatus: vi.fn(),
  updateDubbingJobOriginalYouTubeUrl: vi.fn(),
  createYouTubeUpload: vi.fn(async () => 10),
  createJobLanguageYouTubeUpload: vi.fn(async () => ({ id: 12, status: 'created' })),
  updateJobLanguageYouTube: vi.fn(),
  startJobLanguageYouTubeUpload: vi.fn(async () => ({ status: 'reserved' })),
  failJobLanguageYouTubeUpload: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  getDb: vi.fn(() => ({
    execute: vi.fn(async () => ({ rows: [{ user_id: 'user1' }] })),
  })),
}))

vi.mock('@/lib/ops/observability', () => ({
  recordOperationalEventSafe: vi.fn(async () => undefined),
}))

vi.mock('@/lib/upload-queue/process', () => ({
  processUploadQueue: vi.fn(async () => ({ processed: 0, results: [] })),
}))

vi.mock('@/lib/upload-queue/enqueue', () => ({
  enqueueYouTubeUpload: vi.fn(async () => ({ status: 'queued', queueId: 10 })),
}))

vi.mock('@/lib/dubbing/process', () => ({
  enqueueCompletedDubbingUpload: vi.fn(async () => ({ status: 'queued', queueId: 11 })),
}))

vi.mock('@/lib/youtube/server', () => ({
  fetchVideoStatistics: vi.fn(async () => []),
  YouTubeError: class YouTubeError extends Error {
    constructor(
      public status: number,
      message: string,
      public code = 'YOUTUBE_ERROR',
    ) {
      super(message)
    }
  },
}))

vi.mock('@/lib/auth/token-refresh', () => ({
  getOrRefreshAccessToken: vi.fn(),
}))

import { requireSession } from '@/lib/auth/session'
import { getOrRefreshAccessToken } from '@/lib/auth/token-refresh'

const mockSession = vi.mocked(requireSession)
const mockGetOrRefreshAccessToken = vi.mocked(getOrRefreshAccessToken)

function mockAuth(uid: string) {
  mockSession.mockResolvedValueOnce({
    ok: true,
    session: { uid, email: `${uid}@example.com` },
  })
}

function mockNoAuth() {
  mockSession.mockResolvedValueOnce({
    ok: false,
    response: Response.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } },
      { status: 401 },
    ),
  })
}

// ── /api/dashboard/summary ────────────────────────────────

describe('/api/dashboard/summary', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ GET } = await import('./summary/route'))
  })

  it('returns 200 with valid uid matching session', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/summary?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data).toEqual({ totalJobs: 5 })
  })

  it('returns 401 without session', async () => {
    mockNoAuth()
    const req = new NextRequest('http://localhost/api/dashboard/summary?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when uid differs from session', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/summary?uid=other')
    const res = await GET(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('returns 400 when uid missing', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/summary')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    const { getUserSummary } = await import('@/lib/db/queries')
    vi.mocked(getUserSummary).mockRejectedValueOnce(new Error('DB connection lost'))
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/summary?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('DB_ERROR')
  })

  it('returns generic message when non-Error is thrown', async () => {
    const { getUserSummary } = await import('@/lib/db/queries')
    vi.mocked(getUserSummary).mockRejectedValueOnce('string error')
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/summary?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.message).toBe('대시보드 요약을 불러오지 못했습니다.')
  })
})

// ── /api/dashboard/jobs ───────────────────────────────────

describe('/api/dashboard/jobs', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ GET } = await import('./jobs/route'))
  })

  it('returns 200 with matching uid', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/jobs?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('returns 401 without session', async () => {
    mockNoAuth()
    const req = new NextRequest('http://localhost/api/dashboard/jobs?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for mismatched uid', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/jobs?uid=other')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when uid missing', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/jobs')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    const { getUserDubbingJobs } = await import('@/lib/db/queries')
    vi.mocked(getUserDubbingJobs).mockRejectedValueOnce(new Error('DB timeout'))
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/jobs?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('returns generic message when non-Error is thrown', async () => {
    const { getUserDubbingJobs } = await import('@/lib/db/queries')
    vi.mocked(getUserDubbingJobs).mockRejectedValueOnce(42)
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/jobs?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.message).toBe('일시적인 서버 오류가 발생했습니다.')
  })
})

// ── /api/dashboard/credit-usage ───────────────────────────

describe('/api/dashboard/credit-usage', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ GET } = await import('./credit-usage/route'))
  })

  it('returns 200 with matching uid', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/credit-usage?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('returns 401 without session', async () => {
    mockNoAuth()
    const req = new NextRequest('http://localhost/api/dashboard/credit-usage?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for mismatched uid', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/credit-usage?uid=other')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when uid missing', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/credit-usage')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    const { getCreditUsageByMonth } = await import('@/lib/db/queries')
    vi.mocked(getCreditUsageByMonth).mockRejectedValueOnce(new Error('DB disk full'))
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/credit-usage?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('DB_ERROR')
  })

  it('returns generic message when non-Error is thrown', async () => {
    const { getCreditUsageByMonth } = await import('@/lib/db/queries')
    vi.mocked(getCreditUsageByMonth).mockRejectedValueOnce(null)
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/credit-usage?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.message).toBe('사용 시간 내역을 불러오지 못했습니다.')
  })
})

// ── /api/dashboard/language-performance ───────────────────

import { getLanguagePerformance, getUserYouTubeUploads, updateYouTubeStats } from '@/lib/db/queries'
import { fetchVideoStatistics } from '@/lib/youtube/server'

const mockGetLanguagePerformance = vi.mocked(getLanguagePerformance)
const mockGetUserYouTubeUploads = vi.mocked(getUserYouTubeUploads)
const mockUpdateYouTubeStats = vi.mocked(updateYouTubeStats)
const mockFetchVideoStatistics = vi.mocked(fetchVideoStatistics)

describe('/api/dashboard/language-performance', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ GET } = await import('./language-performance/route'))
  })

  it('returns 200 with matching uid', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/language-performance?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('returns 401 without session', async () => {
    mockNoAuth()
    const req = new NextRequest('http://localhost/api/dashboard/language-performance?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for mismatched uid', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/language-performance?uid=other')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when uid missing', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/language-performance')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('refreshes YouTube stats when DB token and uploads exist', async () => {
    mockAuth('user1')
    mockGetOrRefreshAccessToken.mockResolvedValueOnce('db_token')
    mockGetUserYouTubeUploads.mockResolvedValueOnce([
      { youtube_video_id: 'vid1' },
      { youtube_video_id: 'vid2' },
      { youtube_video_id: null },
    ] as never)
    mockFetchVideoStatistics.mockResolvedValueOnce([
      { videoId: 'vid1', viewCount: 100, likeCount: 10, commentCount: 5 },
      { videoId: 'vid2', viewCount: 200, likeCount: 20, commentCount: 8 },
    ] as never)
    const refreshedData = [{ lang: 'ko', views: 300 }]
    mockGetLanguagePerformance.mockResolvedValueOnce([] as never) // initial call
    mockGetLanguagePerformance.mockResolvedValueOnce(refreshedData as never) // after refresh

    const req = new NextRequest('http://localhost/api/dashboard/language-performance?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(refreshedData)
    expect(mockUpdateYouTubeStats).toHaveBeenCalledTimes(2)
    expect(mockFetchVideoStatistics).toHaveBeenCalledWith('db_token', ['vid1', 'vid2'])
  })

  it('falls back to DB data when YouTube refresh fails', async () => {
    mockAuth('user1')
    mockGetOrRefreshAccessToken.mockResolvedValueOnce('db_token')
    const dbData = [{ lang: 'en', views: 50 }]
    mockGetLanguagePerformance.mockResolvedValueOnce(dbData as never)
    mockGetUserYouTubeUploads.mockRejectedValueOnce(new Error('YouTube down'))

    const req = new NextRequest('http://localhost/api/dashboard/language-performance?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(dbData)
  })

  it('skips YouTube refresh when no uploads have video IDs', async () => {
    mockAuth('user1')
    mockGetOrRefreshAccessToken.mockResolvedValueOnce('db_token')
    const dbData = [{ lang: 'ja', views: 10 }]
    mockGetLanguagePerformance.mockResolvedValueOnce(dbData as never)
    mockGetUserYouTubeUploads.mockResolvedValueOnce([
      { youtube_video_id: null },
      { youtube_video_id: '' },
    ] as never)

    const req = new NextRequest('http://localhost/api/dashboard/language-performance?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(dbData)
    expect(mockFetchVideoStatistics).not.toHaveBeenCalled()
  })

  it('returns 500 on DB error', async () => {
    mockAuth('user1')
    mockGetLanguagePerformance.mockRejectedValueOnce(new Error('DB connection lost'))

    const req = new NextRequest('http://localhost/api/dashboard/language-performance?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('returns generic message when non-Error is thrown from outer catch', async () => {
    mockAuth('user1')
    mockGetLanguagePerformance.mockRejectedValueOnce({ weird: 'object' })

    const req = new NextRequest('http://localhost/api/dashboard/language-performance?uid=user1')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.message).toBe('일시적인 서버 오류가 발생했습니다.')
  })

  it('ignores raw token headers and uses the DB token', async () => {
    mockAuth('user1')
    mockGetOrRefreshAccessToken.mockResolvedValueOnce('db_token')
    mockGetUserYouTubeUploads.mockResolvedValueOnce([
      { youtube_video_id: 'vid1' },
    ] as never)
    mockFetchVideoStatistics.mockResolvedValueOnce([
      { videoId: 'vid1', viewCount: 50, likeCount: 5, commentCount: 1 },
    ] as never)
    mockGetLanguagePerformance.mockResolvedValueOnce([] as never)
    mockGetLanguagePerformance.mockResolvedValueOnce([{ lang: 'ko' }] as never)

    const req = new NextRequest('http://localhost/api/dashboard/language-performance?uid=user1', {
      headers: { 'x-google-access-token': 'header_token' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockFetchVideoStatistics).toHaveBeenCalledWith('db_token', ['vid1'])
  })
})

// ── /api/dashboard/mutations ──────────────────────────────

describe('/api/dashboard/mutations', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ POST } = await import('./mutations/route'))
  })

  it('returns 401 without session', async () => {
    mockNoAuth()
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'createDubbingJob',
        payload: {
          userId: 'user1',
          videoTitle: 'test',
          videoDurationMs: 1000,
          videoThumbnail: '',
          sourceLanguage: 'en',
          mediaSeq: 1,
          spaceSeq: 1,
          lipSyncEnabled: false,
          isShort: false,
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 for createDubbingJob with matching uid', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'createDubbingJob',
        payload: {
          userId: 'user1',
          videoTitle: 'test',
          videoDurationMs: 1000,
          videoThumbnail: '',
          sourceLanguage: 'en',
          mediaSeq: 1,
          spaceSeq: 1,
          lipSyncEnabled: false,
          isShort: false,
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data.jobId).toBe(1)
  })

  it('returns 403 for createDubbingJob with mismatched uid', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'createDubbingJob',
        payload: {
          userId: 'other',
          videoTitle: 'test',
          videoDurationMs: 1000,
          videoThumbnail: '',
          sourceLanguage: 'en',
          mediaSeq: 1,
          spaceSeq: 1,
          lipSyncEnabled: false,
          isShort: false,
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('BAD_REQUEST')
  })

  it('returns 400 for unknown action type', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({ type: 'unknownAction', payload: {} }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 for createJobLanguages', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'createJobLanguages',
        payload: { jobId: 1, languages: [{ code: 'ko', projectSeq: 1 }] },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.jobId).toBe(1)
  })

  it('returns 200 for updateJobLanguageProgress', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'updateJobLanguageProgress',
        payload: { jobId: 1, langCode: 'ko', status: 'processing', progress: 50, progressReason: 'Dubbing' },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ jobId: 1, langCode: 'ko' })
  })

  it('returns 200 for updateJobLanguageCompleted', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'updateJobLanguageCompleted',
        payload: { jobId: 1, langCode: 'ko', urls: { dubbedVideoUrl: 'https://example.com/video.mp4' } },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ jobId: 1, langCode: 'ko' })
  })

  it('returns 200 for updateJobStatus', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'updateJobStatus',
        payload: { jobId: 1, status: 'completed' },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.jobId).toBe(1)
  })

  it('returns 200 for updateDubbingJobOriginalYouTubeUrl', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'updateDubbingJobOriginalYouTubeUrl',
        payload: {
          jobId: 1,
          originalYouTubeUrl: 'https://www.youtube.com/watch?v=abc123',
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({
      jobId: 1,
      originalYouTubeUrl: 'https://www.youtube.com/watch?v=abc123',
    })
  })

  it('returns 200 for createYouTubeUpload with matching uid', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'createYouTubeUpload',
        payload: {
          userId: 'user1',
          youtubeVideoId: 'abc123',
          title: 'Test Video',
          languageCode: 'ko',
          privacyStatus: 'unlisted',
          isShort: false,
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(10)
  })

  it('returns 403 for createYouTubeUpload with mismatched uid', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'createYouTubeUpload',
        payload: {
          userId: 'other',
          youtubeVideoId: 'abc123',
          title: 'Test',
          languageCode: 'ko',
          privacyStatus: 'unlisted',
          isShort: false,
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 200 for updateJobLanguageYouTube', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'updateJobLanguageYouTube',
        payload: { jobId: 1, langCode: 'ko', youtubeVideoId: 'xyz789' },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual({ jobId: 1, langCode: 'ko' })
  })

  it('records a caption upload for a job language', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'recordJobLanguageCaptionUpload',
        payload: {
          jobId: 1,
          langCode: 'ko',
          youtubeVideoId: 'xyz789',
          title: 'Caption target',
          languageCode: 'ko',
          privacyStatus: 'private',
          isShort: false,
          uploadKind: 'new_video_original_captions',
        },
      }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual({ id: 12, status: 'created' })
  })

  it('returns upload reservation status for startJobLanguageYouTubeUpload', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'startJobLanguageYouTubeUpload',
        payload: { jobId: 1, langCode: 'ko' },
      }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual({ status: 'reserved' })
  })

  it('queues completed job language uploads on the server', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'queueJobLanguageYouTubeUpload',
        payload: { jobId: 1, langCode: 'ko' },
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ status: 'queued', queueId: 11 })
  })

  it('processes completed job language upload immediately when requested', async () => {
    const { processUploadQueue } = await import('@/lib/upload-queue/process')
    vi.mocked(processUploadQueue).mockResolvedValueOnce({
      processed: 1,
      results: [{ id: 11, status: 'done', videoId: 'yt-1' }],
    })
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'queueJobLanguageYouTubeUpload',
        payload: { jobId: 1, langCode: 'ko', processNow: true },
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(processUploadQueue).toHaveBeenCalledWith({ userId: 'user1', queueId: 11, limit: 1 })
    expect(body.data).toEqual({ status: 'uploaded', queueId: 11, youtubeVideoId: 'yt-1' })
  })

  it('returns 200 for failJobLanguageYouTubeUpload', async () => {
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'failJobLanguageYouTubeUpload',
        payload: { jobId: 1, langCode: 'ko' },
      }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual({ jobId: 1, langCode: 'ko' })
  })

  it('returns 500 on DB error', async () => {
    const { createDubbingJob } = await import('@/lib/db/queries')
    vi.mocked(createDubbingJob).mockRejectedValueOnce(new Error('DB write failed'))
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'createDubbingJob',
        payload: {
          userId: 'user1',
          videoTitle: 'test',
          videoDurationMs: 1000,
          videoThumbnail: '',
          sourceLanguage: 'en',
          mediaSeq: 1,
          spaceSeq: 1,
          lipSyncEnabled: false,
          isShort: false,
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('returns generic message when non-Error is thrown from DB', async () => {
    const { createDubbingJob } = await import('@/lib/db/queries')
    vi.mocked(createDubbingJob).mockRejectedValueOnce('raw string')
    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/mutations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'createDubbingJob',
        payload: {
          userId: 'user1',
          videoTitle: 'test',
          videoDurationMs: 1000,
          videoThumbnail: '',
          sourceLanguage: 'en',
          mediaSeq: 1,
          spaceSeq: 1,
          lipSyncEnabled: false,
          isShort: false,
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.message).toBe('일시적인 서버 오류가 발생했습니다.')
  })
})
