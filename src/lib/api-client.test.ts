import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  getPersoFileUrl,
  getSpaces,
  getLanguages,
  getExternalMetadata,
  uploadExternalVideo,
  getSasToken,
  uploadFileToBlob,
  registerUploadedVideo,
  uploadVideoFile,
  validateMedia,
  initializeQueue,
  submitTranslation,
  getProjectProgress,
  listProjects,
  getProjectDetail,
  getProjectScript,
  updateSentenceTranslation,
  regenerateSentenceAudio,
  getDownloadLinks,
  requestLipSync,
  ytUploadVideo,
  ytUploadCaption,
  ytFetchAnalytics,
  ytFetchVideoStats,
  ytFetchChannelStats,
  ytFetchMyVideos,
  ytFetchVideoMetadata,
  ytUpdateVideoLocalizations,
} from './api-client'

function okResponse<T>(data: T) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, data }),
  }
}

function errorResponse(code: string, message: string, status = 400) {
  return {
    ok: false,
    status,
    json: async () => ({ ok: false, error: { code, message } }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getPersoFileUrl', () => {
  it('returns empty string for empty path', () => {
    expect(getPersoFileUrl('')).toBe('')
  })

  it('returns absolute URL as-is', () => {
    expect(getPersoFileUrl('https://example.com/file.mp4')).toBe('https://example.com/file.mp4')
  })

  it('prepends base URL for relative path with leading slash', () => {
    const result = getPersoFileUrl('/files/video.mp4')
    expect(result).toContain('https://portal-media.perso.ai')
    expect(result).toContain('/files/video.mp4')
  })

  it('prepends base URL for relative path without leading slash', () => {
    const result = getPersoFileUrl('files/video.mp4')
    expect(result).toContain('/files/video.mp4')
  })
})

describe('ytFetchAnalytics', () => {
  it('fetches analytics with videoIds', async () => {
    mockFetch.mockResolvedValueOnce(okResponse([{ videoId: 'v1', daily: [], countries: [], totals: {} }]))
    const result = await ytFetchAnalytics(['v1'])
    expect(result).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/youtube/analytics?'),
      expect.objectContaining({ cache: 'no-store' }),
    )
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('videoIds=v1')
  })

  it('includes optional date range', async () => {
    mockFetch.mockResolvedValueOnce(okResponse([]))
    await ytFetchAnalytics(['v1'], '2026-01-01', '2026-01-31')
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('startDate=2026-01-01')
    expect(url).toContain('endDate=2026-01-31')
  })

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse('QUOTA', 'Quota exceeded', 429))
    await expect(ytFetchAnalytics(['v1'])).rejects.toThrow('Quota exceeded')
  })
})

describe('ytFetchVideoStats', () => {
  it('sends videoIds as comma-separated query', async () => {
    mockFetch.mockResolvedValueOnce(okResponse([{ videoId: 'v1', viewCount: 100 }]))
    const result = await ytFetchVideoStats(['v1', 'v2'])
    expect(result).toHaveLength(1)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('videoIds=v1%2Cv2')
  })
})

describe('ytFetchChannelStats', () => {
  it('fetches channel stats', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ channelId: 'ch1', subscriberCount: 500 }))
    const result = await ytFetchChannelStats()
    expect(result?.channelId).toBe('ch1')
  })
})

describe('ytFetchMyVideos', () => {
  it('fetches videos with maxResults', async () => {
    mockFetch.mockResolvedValueOnce(okResponse([{ videoId: 'v1' }]))
    const result = await ytFetchMyVideos(5)
    expect(result).toHaveLength(1)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('maxResults=5')
  })
})

// ── json helper edge cases ──────────────────────────────────

describe('json envelope edge cases', () => {
  it('throws on unparseable response body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new SyntaxError('Unexpected token') },
    })
    await expect(getSpaces()).rejects.toThrow('요청 결과를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })

  it('throws safe fallback when error has no message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ ok: false }),
    })
    await expect(getSpaces()).rejects.toThrow('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })
})

// ── Perso GET wrappers ──────────────────────────────────────

describe('Perso GET endpoints', () => {
  it('getSpaces calls /api/perso/spaces', async () => {
    mockFetch.mockResolvedValueOnce(okResponse([{ id: 1 }]))
    const data = await getSpaces()
    expect(data).toEqual([{ id: 1 }])
    expect(mockFetch.mock.calls[0][0]).toBe('/api/perso/spaces')
  })

  it('getLanguages calls /api/perso/languages', async () => {
    mockFetch.mockResolvedValueOnce(okResponse([{ code: 'ko' }]))
    const data = await getLanguages()
    expect(data).toEqual([{ code: 'ko' }])
  })

  it('getSasToken passes fileName as query', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ blobSasUrl: 'https://blob/sas' }))
    const data = await getSasToken('test.mp4')
    expect(data.blobSasUrl).toBe('https://blob/sas')
    expect(mockFetch.mock.calls[0][0]).toContain('fileName=test.mp4')
  })

  it('getProjectProgress passes projectSeq and spaceSeq', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ progress: 50 }))
    await getProjectProgress(10, 2)
    expect(mockFetch.mock.calls[0][0]).toContain('projectSeq=10')
    expect(mockFetch.mock.calls[0][0]).toContain('spaceSeq=2')
  })

  it('listProjects passes spaceSeq', async () => {
    mockFetch.mockResolvedValueOnce(okResponse([]))
    await listProjects(3)
    expect(mockFetch.mock.calls[0][0]).toContain('spaceSeq=3')
  })

  it('getProjectDetail passes both params', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ seq: 5 }))
    await getProjectDetail(5, 1)
    expect(mockFetch.mock.calls[0][0]).toContain('projectSeq=5')
  })

  it('getProjectScript passes both params', async () => {
    mockFetch.mockResolvedValueOnce(okResponse([]))
    await getProjectScript(5, 1)
    expect(mockFetch.mock.calls[0][0]).toContain('projectSeq=5')
  })

  it('getDownloadLinks passes target param', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ urls: [] }))
    await getDownloadLinks(5, 1, 'voiceAudio')
    expect(mockFetch.mock.calls[0][0]).toContain('target=voiceAudio')
  })

  it('getDownloadLinks defaults target to all', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ urls: [] }))
    await getDownloadLinks(5, 1)
    expect(mockFetch.mock.calls[0][0]).toContain('target=all')
  })
})

// ── Perso mutation endpoints ────────────────────────────────

describe('Perso mutation endpoints', () => {
  it('getExternalMetadata posts to external/metadata', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ title: 'Test' }))
    const data = await getExternalMetadata(1, 'https://youtube.com/watch?v=abc')
    expect(data).toEqual({ title: 'Test' })
    expect(mockFetch.mock.calls[0][1].method).toBe('POST')
  })

  it('getExternalMetadata omits lang by default', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ title: 'T' }))
    await getExternalMetadata(1, 'https://youtube.com/watch?v=abc')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.lang).toBeUndefined()
  })

  it('getExternalMetadata omits lang when source is auto', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ title: 'T' }))
    await getExternalMetadata(1, 'https://youtube.com/watch?v=abc', 'auto')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.lang).toBeUndefined()
  })

  it('uploadExternalVideo puts to external/upload', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ seq: 10 }))
    const data = await uploadExternalVideo(1, 'https://youtube.com/watch?v=abc', 'en')
    expect(data.seq).toBe(10)
    expect(mockFetch.mock.calls[0][1].method).toBe('PUT')
  })

  it('registerUploadedVideo puts to upload/register', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ seq: 20 }))
    await registerUploadedVideo(1, 'https://blob/file', 'test.mp4')
    expect(mockFetch.mock.calls[0][1].method).toBe('PUT')
  })

  it('validateMedia posts body', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ valid: true }))
    await validateMedia({ spaceSeq: 1, mediaSeq: 2 } as never)
    expect(mockFetch.mock.calls[0][1].method).toBe('POST')
  })

  it('initializeQueue puts with spaceSeq', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(null))
    await initializeQueue(5)
    expect(mockFetch.mock.calls[0][0]).toContain('spaceSeq=5')
    expect(mockFetch.mock.calls[0][1].method).toBe('PUT')
  })

  it('submitTranslation posts with spaceSeq', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ projectSeq: 1 }))
    await submitTranslation(5, { languages: ['ko'] } as never)
    expect(mockFetch.mock.calls[0][0]).toContain('spaceSeq=5')
    expect(mockFetch.mock.calls[0][1].method).toBe('POST')
  })

  it('updateSentenceTranslation patches with params', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(null))
    await updateSentenceTranslation(10, 20, 'translated')
    expect(mockFetch.mock.calls[0][1].method).toBe('PATCH')
    expect(mockFetch.mock.calls[0][0]).toContain('projectSeq=10')
    expect(mockFetch.mock.calls[0][0]).toContain('sentenceSeq=20')
  })

  it('regenerateSentenceAudio patches with params and targetText', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(null))
    await regenerateSentenceAudio(10, 30, 'translated')
    expect(mockFetch.mock.calls[0][1].method).toBe('PATCH')
    expect(mockFetch.mock.calls[0][0]).toContain('audioSentenceSeq=30')
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ targetText: 'translated' })
  })

  it('requestLipSync posts with params', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(null))
    await requestLipSync(5, 1)
    expect(mockFetch.mock.calls[0][1].method).toBe('POST')
    expect(mockFetch.mock.calls[0][0]).toContain('projectSeq=5')
  })
})

// ── YouTube upload/caption wrappers ─────────────────────────

describe('ytUploadVideo', () => {
  it('binary 모드: /upload-session에 메타데이터 JSON을 보내고 받은 URL로 영상 PUT', async () => {
    // 1) /upload-session 응답
    mockFetch.mockResolvedValueOnce(okResponse({ uploadUrl: 'https://upload.googleapis.com/x/y' }))
    // 2) YouTube로의 직접 PUT 응답 (envelope 아님 — 실제 YouTube 응답 형태)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'yt1', snippet: { title: 'Test' }, status: { uploadStatus: 'uploaded' } }),
    } as unknown as Response)

    const blob = new Blob(['fake'], { type: 'video/mp4' })
    const result = await ytUploadVideo({
      video: blob,
      title: 'Test',
      description: 'desc',
      tags: ['a', 'b'],
      categoryId: '22',
      privacyStatus: 'unlisted',
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: true,
      language: 'ko',
    })
    expect(result.videoId).toBe('yt1')

    expect(mockFetch.mock.calls[0][0]).toBe('/api/youtube/upload-session')
    const sessionBody = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(sessionBody).toMatchObject({
      contentType: 'video/mp4',
      title: 'Test',
      description: 'desc',
      tags: ['a', 'b'],
      categoryId: '22',
      privacyStatus: 'unlisted',
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: true,
      language: 'ko',
    })
    expect(sessionBody.contentLength).toBeGreaterThan(0)

    expect(mockFetch.mock.calls[1][0]).toBe('https://upload.googleapis.com/x/y')
    expect(mockFetch.mock.calls[1][1].method).toBe('PUT')
    expect(mockFetch.mock.calls[1][1].body).toBe(blob)
  })

  it('binary 모드: 선택 필드는 정의되지 않은 채로 메타데이터 JSON에 포함', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ uploadUrl: 'https://upload.googleapis.com/x/y' }))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'yt2' }),
    } as unknown as Response)

    const blob = new Blob(['fake'], { type: 'video/mp4' })
    await ytUploadVideo({
      video: blob,
      title: 'Test',
      description: '',
      tags: [],
    })
    const sessionBody = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(sessionBody.categoryId).toBeUndefined()
    expect(sessionBody.privacyStatus).toBeUndefined()
    expect(sessionBody.selfDeclaredMadeForKids).toBeUndefined()
    expect(sessionBody.containsSyntheticMedia).toBeUndefined()
    expect(sessionBody.language).toBeUndefined()
  })

  it('binary mode: sends post-upload actions after direct upload', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ uploadUrl: 'https://upload.googleapis.com/x/y' }))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'yt-post' }),
    } as unknown as Response)
    mockFetch.mockResolvedValueOnce(okResponse({
      thumbnailUploaded: true,
      playlistItemIds: ['playlist-item-1'],
      warnings: [],
    }))

    const video = new Blob(['fake'], { type: 'video/mp4' })
    const thumbnail = new Blob(['thumb'], { type: 'image/png' })
    const result = await ytUploadVideo({
      video,
      title: 'Post',
      description: '',
      tags: [],
      notifySubscribers: false,
      thumbnail,
      thumbnailUrl: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
      playlistIds: ['PL123'],
    })

    expect(result.postProcessing?.thumbnailUploaded).toBe(true)
    const postSessionBody = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(postSessionBody.notifySubscribers).toBe(false)
    expect(mockFetch.mock.calls[2][0]).toBe('/api/youtube/upload-post-processing')
    const postBody = mockFetch.mock.calls[2][1].body as FormData
    expect(postBody.get('videoId')).toBe('yt-post')
    expect(postBody.get('thumbnail')).toBeInstanceOf(Blob)
    expect((postBody.get('thumbnail') as Blob).size).toBe(thumbnail.size)
    expect(postBody.get('thumbnailUrl')).toBe('https://i.ytimg.com/vi/abc/maxresdefault.jpg')
    expect(postBody.get('playlistIds')).toBe('PL123')
  })

  it('binary 모드: YouTube 직접 업로드 실패 시 raw 응답을 사용자 메시지에 노출하지 않음', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mockFetch.mockResolvedValueOnce(okResponse({ uploadUrl: 'https://upload.googleapis.com/x/y' }))
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'quotaExceeded: developer detail',
    } as unknown as Response)

    const blob = new Blob(['fake'], { type: 'video/mp4' })
    try {
      await ytUploadVideo({
        video: blob,
        title: 'Test',
        description: '',
        tags: [],
      })
      expect.fail('expected upload to fail')
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
      const message = (err as Error).message
      expect(message).toBe('YouTube 업로드를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      expect(message).not.toMatch(/quotaExceeded|403|developer detail/)
    } finally {
      warn.mockRestore()
    }
  })

  it('videoUrl 모드: FormData로 /upload에 POST (서버가 fetch + 업로드)', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ videoId: 'yt3' }))
    const thumbnail = new Blob(['thumb'], { type: 'image/png' })
    const result = await ytUploadVideo({
      videoUrl: 'https://example.blob.core.windows.net/x/y.mp4',
      title: 'URL Mode',
      description: 'd',
      tags: ['x'],
      notifySubscribers: false,
      thumbnail,
      playlistIds: ['PL123'],
    })
    expect(result.videoId).toBe('yt3')
    expect(mockFetch.mock.calls[0][0]).toBe('/api/youtube/upload')
    const body = mockFetch.mock.calls[0][1].body as FormData
    expect(body.get('videoUrl')).toBe('https://example.blob.core.windows.net/x/y.mp4')
    expect(body.get('title')).toBe('URL Mode')
    expect(body.get('tags')).toBe('x')
    expect(body.get('notifySubscribers')).toBe('false')
    expect(body.get('thumbnail')).toBeInstanceOf(Blob)
    expect((body.get('thumbnail') as Blob).size).toBe(thumbnail.size)
    expect(body.get('playlistIds')).toBe('PL123')
  })
})

describe('ytUploadCaption', () => {
  it('sends JSON body to /api/youtube/caption', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ uploaded: true }))
    const result = await ytUploadCaption({
      videoId: 'v1',
      language: 'ko',
      name: 'Korean',
      srtContent: '1\n00:00:01,000 --> 00:00:02,000\nHello',
    })
    expect(result.uploaded).toBe(true)
    expect(mockFetch.mock.calls[0][0]).toBe('/api/youtube/caption')
    expect(mockFetch.mock.calls[0][1].method).toBe('POST')
  })
})

describe('ytUpdateVideoLocalizations', () => {
  it('sends tags to metadata update API', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ videoId: 'v1', tags: ['a'] }))
    await ytUpdateVideoLocalizations({
      videoId: 'v1',
      sourceLang: 'ko',
      title: 'Title',
      description: 'Description',
      tags: ['a'],
      localizations: {},
    })

    expect(mockFetch.mock.calls[0][0]).toBe('/api/youtube/metadata')
    expect(JSON.parse(mockFetch.mock.calls[0][1].body as string)).toMatchObject({
      videoId: 'v1',
      tags: ['a'],
    })
  })
})

// ── uploadFileToBlob (XHR) ─────────────────────────────────

describe('ytFetchVideoMetadata', () => {
  it('passes the requested source language to the metadata API', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ videoId: 'v1' }))
    await ytFetchVideoMetadata('v1', 'ko')

    expect(mockFetch.mock.calls[0][0]).toBe('/api/youtube/metadata?videoId=v1&sourceLang=ko')
  })
})

describe('uploadFileToBlob', () => {
  let xhrInstances: Array<Record<string, unknown>>

  beforeEach(() => {
    xhrInstances = []
    function MockXHR(this: Record<string, unknown>) {
      this.open = vi.fn()
      this.setRequestHeader = vi.fn()
      this.send = vi.fn()
      this.upload = { onprogress: null as unknown }
      this.onload = null as unknown
      this.onerror = null as unknown
      this.status = 200
      xhrInstances.push(this)
    }
    vi.stubGlobal('XMLHttpRequest', MockXHR)
  })

  it('resolves on successful upload (2xx)', async () => {
    const file = new File(['data'], 'test.mp4', { type: 'video/mp4' })
    const promise = uploadFileToBlob('https://blob.example/sas', file)

    const xhr = xhrInstances[0]
    expect(xhr.open).toHaveBeenCalledWith('PUT', 'https://blob.example/sas')
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('x-ms-blob-type', 'BlockBlob')
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream')

    xhr.status = 200
    ;(xhr.onload as () => void)()
    await expect(promise).resolves.toBeUndefined()
  })

  it('uses fallback content-type when file.type is empty', async () => {
    const file = new File(['data'], 'test.bin', { type: '' })
    uploadFileToBlob('https://blob.example/sas', file)

    const xhr = xhrInstances[0]
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream')
  })

  it('reports upload progress', async () => {
    const file = new File(['data'], 'test.mp4', { type: 'video/mp4' })
    const onProgress = vi.fn()
    const promise = uploadFileToBlob('https://blob.example/sas', file, onProgress)

    const xhr = xhrInstances[0]
    const progressHandler = (xhr.upload as { onprogress: (e: unknown) => void }).onprogress
    progressHandler({ lengthComputable: true, loaded: 50, total: 100 })
    expect(onProgress).toHaveBeenCalledWith(50)

    progressHandler({ lengthComputable: true, loaded: 100, total: 100 })
    expect(onProgress).toHaveBeenCalledWith(100)

    progressHandler({ lengthComputable: false, loaded: 10, total: 0 })
    expect(onProgress).toHaveBeenCalledTimes(2)

    xhr.status = 200
    ;(xhr.onload as () => void)()
    await promise
  })

  it('rejects on non-2xx status', async () => {
    const file = new File(['data'], 'test.mp4', { type: 'video/mp4' })
    const promise = uploadFileToBlob('https://blob.example/sas', file)

    const xhr = xhrInstances[0]
    xhr.status = 403
    ;(xhr.onload as () => void)()

    await expect(promise).rejects.toThrow('Blob upload failed: 403')
  })

  it('rejects on network error', async () => {
    const file = new File(['data'], 'test.mp4', { type: 'video/mp4' })
    const promise = uploadFileToBlob('https://blob.example/sas', file)

    const xhr = xhrInstances[0]
    ;(xhr.onerror as () => void)()

    await expect(promise).rejects.toThrow('Network error during blob upload')
  })
})

// ── uploadVideoFile (orchestrator) ─────────────────────────

describe('uploadVideoFile', () => {
  let xhrInstances: Array<Record<string, unknown>>

  beforeEach(() => {
    xhrInstances = []
    function MockXHR(this: Record<string, unknown>) {
      this.open = vi.fn()
      this.setRequestHeader = vi.fn()
      this.send = vi.fn().mockImplementation(() => {
        this.status = 200
        ;(this.onload as () => void)()
      })
      this.upload = { onprogress: null as unknown }
      this.onload = null as unknown
      this.onerror = null as unknown
      this.status = 200
      xhrInstances.push(this)
    }
    vi.stubGlobal('XMLHttpRequest', MockXHR)
  })

  it('chains getSasToken → uploadFileToBlob → registerUploadedVideo', async () => {
    mockFetch
      .mockResolvedValueOnce(okResponse({ blobSasUrl: 'https://blob.example/file.mp4?sig=abc' }))
      .mockResolvedValueOnce(okResponse({ seq: 42 }))

    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    const result = await uploadVideoFile(1, file)

    expect(result.seq).toBe(42)
    expect(mockFetch.mock.calls[0][0]).toContain('fileName=clip.mp4')
    const registerBody = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(registerBody.fileUrl).toBe('https://blob.example/file.mp4')
    expect(registerBody.fileName).toBe('clip.mp4')
    expect(registerBody.spaceSeq).toBe(1)
  })

  it('passes onProgress to blob upload', async () => {
    mockFetch
      .mockResolvedValueOnce(okResponse({ blobSasUrl: 'https://blob.example/f.mp4?sig=x' }))
      .mockResolvedValueOnce(okResponse({ seq: 1 }))

    const onProgress = vi.fn()
    const file = new File(['video'], 'test.mp4', { type: 'video/mp4' })
    await uploadVideoFile(1, file, onProgress)

    expect(xhrInstances).toHaveLength(1)
  })
})
