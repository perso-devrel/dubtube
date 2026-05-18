import { z } from 'zod'
import { normalizePublishAt } from '@/lib/youtube/publish-schedule'

export const captionBodySchema = z.object({
  videoId: z.string().min(1),
  language: z.string().min(1),
  name: z.string().optional().default(''),
  srtContent: z.string().min(1),
  /** true면 동일 language의 기존 캡션을 모두 삭제한 뒤 새로 삽입한다. */
  replace: z.boolean().optional(),
})

export const captionListQuerySchema = z.object({
  videoId: z.string().min(1),
})

export const analyticsQuerySchema = z.object({
  videoIds: z
    .string()
    .min(1)
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const statsQuerySchema = z.object({
  channel: z.string().optional(),
  videoIds: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
})

export const videosQuerySchema = z.object({
  maxResults: z
    .string()
    .default('10')
    .transform(Number)
    .pipe(z.number().int().min(1).max(50)),
})

export const metadataQuerySchema = z.object({
  videoId: z.string().min(1),
  sourceLang: z.string().min(1).optional(),
})

export const metadataUpdateBodySchema = z.object({
  videoId: z.string().min(1),
  sourceLang: z.string().min(1),
  title: z.string().min(1).max(2000),
  description: z.string().max(20000).default(''),
  tags: z.array(z.string().min(1)).optional(),
  localizations: z.record(
    z.string().min(1),
    z.object({
      title: z.string().min(1).max(2000),
      description: z.string().max(20000).default(''),
    }),
  ),
})

const localizationsRecordSchema = z.record(
  z.string().min(1),
  z.object({
    title: z.string().min(1).max(2000),
    description: z.string().max(20000).default(''),
  }),
)

const formBooleanSchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined
    if (typeof v === 'boolean') return v
    return v === 'true'
  })

const publishAtSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx): string | undefined => {
    if (value === undefined || value === null || value.trim().length === 0) return undefined
    const normalized = normalizePublishAt(value)
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Invalid publishAt datetime' })
      return z.NEVER
    }
    if (new Date(normalized).getTime() <= Date.now()) {
      ctx.addIssue({ code: 'custom', message: 'publishAt must be in the future' })
      return z.NEVER
    }
    return normalized
  })

export const uploadSessionBodySchema = z.object({
  contentType: z.string().min(1).max(200),
  contentLength: z.number().int().positive(),
  title: z.string().default(''),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  categoryId: z.string().optional(),
  privacyStatus: z.enum(['public', 'unlisted', 'private']).optional(),
  publishAt: publishAtSchema,
  selfDeclaredMadeForKids: z.boolean().optional(),
  containsSyntheticMedia: z.boolean().optional(),
  language: z.string().optional(),
  localizations: localizationsRecordSchema.optional(),
})

export const uploadFormSchema = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
  tags: z
    .string()
    .default('')
    .transform((v) => (v ? v.split(',').map((t) => t.trim()).filter(Boolean) : [])),
  categoryId: z.string().optional(),
  privacyStatus: z.enum(['public', 'unlisted', 'private']).optional(),
  publishAt: publishAtSchema,
  selfDeclaredMadeForKids: formBooleanSchema,
  containsSyntheticMedia: formBooleanSchema,
  language: z.string().optional(),
  /** form에서는 JSON 문자열로 전달. */
  localizations: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined
      try {
        return localizationsRecordSchema.parse(JSON.parse(v))
      } catch {
        return undefined
      }
    }),
})
