import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/session', () => ({
  requireSession: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  getDb: vi.fn(),
}))

import { requireSession } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'

const mockSession = vi.mocked(requireSession)
const mockGetDb = vi.mocked(getDb)

function mockAuth(uid: string) {
  mockSession.mockResolvedValueOnce({
    ok: true,
    session: { uid, email: `${uid}@example.com` },
  })
}

describe('/api/dashboard/job-language-status', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ GET } = await import('./job-language-status/route'))
  })

  it('returns server upload records used to prevent duplicate YouTube uploads', async () => {
    const execute = vi.fn(async () => ({
      rows: [
        {
          original_youtube_url: 'https://www.youtube.com/watch?v=orig123',
          language_code: 'de',
          youtube_video_id: null,
          youtube_upload_status: null,
          queued_youtube_video_id: 'queued123',
          original_caption_uploaded: 1,
          original_caption_video_id: 'orig123',
        },
      ],
    }))
    mockGetDb.mockReturnValueOnce({ execute } as unknown as ReturnType<typeof getDb>)

    mockAuth('user1')
    const req = new NextRequest('http://localhost/api/dashboard/job-language-status?jobId=42')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({
      sql: expect.stringContaining('FROM upload_queue uq'),
      args: [42, 'user1'],
    })
    expect(body.data).toEqual({
      jobId: 42,
      originalYouTubeUrl: 'https://www.youtube.com/watch?v=orig123',
      languages: [
        {
          languageCode: 'de',
          youtubeVideoId: 'queued123',
          youtubeUploadStatus: 'uploaded',
          originalCaptionUploaded: true,
          originalCaptionVideoId: 'orig123',
        },
      ],
    })
  })
})
