import { describe, it, expect } from 'vitest'
import {
  captionBodySchema,
  analyticsQuerySchema,
  statsQuerySchema,
  videosQuerySchema,
  uploadFormSchema,
} from './youtube'

describe('captionBodySchema', () => {
  it('accepts valid body', () => {
    const result = captionBodySchema.safeParse({
      videoId: 'yt-123',
      language: 'ko',
      name: 'Korean',
      srtContent: '1\n00:00:00,000 --> 00:00:01,000\nHello\n',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing videoId', () => {
    const result = captionBodySchema.safeParse({
      language: 'ko',
      name: 'Korean',
      srtContent: 'content',
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty caption name so the uploader can apply a language fallback', () => {
    const result = captionBodySchema.safeParse({
      videoId: 'yt-123',
      language: 'ko',
      name: '',
      srtContent: 'content',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty srtContent', () => {
    const result = captionBodySchema.safeParse({
      videoId: 'yt-123',
      language: 'ko',
      name: 'Korean',
      srtContent: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('analyticsQuerySchema', () => {
  it('parses videoIds and transforms to array', () => {
    const result = analyticsQuerySchema.parse({ videoIds: 'v1,v2,v3' })
    expect(result.videoIds).toEqual(['v1', 'v2', 'v3'])
  })

  it('accepts optional date range', () => {
    const result = analyticsQuerySchema.parse({
      videoIds: 'v1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })
    expect(result.startDate).toBe('2026-01-01')
    expect(result.endDate).toBe('2026-01-31')
  })

  it('rejects invalid date format', () => {
    const result = analyticsQuerySchema.safeParse({
      videoIds: 'v1',
      startDate: 'January 1',
    })
    expect(result.success).toBe(false)
  })

  it('filters empty strings from videoIds', () => {
    const result = analyticsQuerySchema.parse({ videoIds: 'v1,,v2,' })
    expect(result.videoIds).toEqual(['v1', 'v2'])
  })
})

describe('statsQuerySchema', () => {
  it('parses channel=true', () => {
    const result = statsQuerySchema.parse({ channel: 'true' })
    expect(result.channel).toBe('true')
  })

  it('parses videoIds string', () => {
    const result = statsQuerySchema.parse({ videoIds: 'v1,v2' })
    expect(result.videoIds).toEqual(['v1', 'v2'])
  })

  it('defaults to empty videoIds', () => {
    const result = statsQuerySchema.parse({})
    expect(result.videoIds).toEqual([])
  })
})

describe('videosQuerySchema', () => {
  it('defaults maxResults to 10', () => {
    const result = videosQuerySchema.parse({})
    expect(result.maxResults).toBe(10)
  })

  it('parses string maxResults to number', () => {
    const result = videosQuerySchema.parse({ maxResults: '25' })
    expect(result.maxResults).toBe(25)
  })

  it('rejects maxResults > 50', () => {
    const result = videosQuerySchema.safeParse({ maxResults: '100' })
    expect(result.success).toBe(false)
  })

  it('rejects maxResults < 1', () => {
    const result = videosQuerySchema.safeParse({ maxResults: '0' })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer maxResults', () => {
    const result = videosQuerySchema.safeParse({ maxResults: '2.5' })
    expect(result.success).toBe(false)
  })
})

describe('uploadFormSchema', () => {
  it('accepts all fields', () => {
    const result = uploadFormSchema.parse({
      title: 'My Video',
      description: 'A test',
      tags: 'a,b,c',
      categoryId: '22',
      privacyStatus: 'unlisted',
      notifySubscribers: 'false',
      selfDeclaredMadeForKids: 'false',
      containsSyntheticMedia: 'true',
      language: 'ko',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
      playlistIds: 'https://www.youtube.com/playlist?list=PL123, UU456',
    })
    expect(result.title).toBe('My Video')
    expect(result.tags).toEqual(['a', 'b', 'c'])
    expect(result.privacyStatus).toBe('unlisted')
    expect(result.notifySubscribers).toBe(false)
    expect(result.thumbnailUrl).toBe('https://i.ytimg.com/vi/abc/maxresdefault.jpg')
    expect(result.playlistIds).toEqual(['PL123', 'UU456'])
    expect(result.selfDeclaredMadeForKids).toBe(false)
    expect(result.containsSyntheticMedia).toBe(true)
  })

  it('defaults title and description to empty', () => {
    const result = uploadFormSchema.parse({})
    expect(result.title).toBe('')
    expect(result.description).toBe('')
    expect(result.tags).toEqual([])
  })

  it('rejects invalid privacyStatus', () => {
    const result = uploadFormSchema.safeParse({ privacyStatus: 'secret' })
    expect(result.success).toBe(false)
  })

  it('rejects past scheduled publish times', () => {
    const result = uploadFormSchema.safeParse({ publishAt: '2000-01-01T00:00:00.000Z' })
    expect(result.success).toBe(false)
  })

  it('normalizes future scheduled publish times', () => {
    const result = uploadFormSchema.parse({ publishAt: '2100-01-01T00:00:00.000Z' })
    expect(result.publishAt).toBe('2100-01-01T00:00:00.000Z')
  })

  it('handles empty tags string', () => {
    const result = uploadFormSchema.parse({ tags: '' })
    expect(result.tags).toEqual([])
  })
})
