import 'server-only'

import {
  claimPendingUploads,
  completeQueueItem,
  failQueueItem,
} from '@/lib/db/queries/upload-queue'
import { createYouTubeUpload, updateJobLanguageYouTube } from '@/lib/db/queries'
import { getOrRefreshAccessToken } from '@/lib/auth/token-refresh'
import { uploadCaptionToYouTube, uploadVideoToYouTube } from '@/lib/youtube/upload'
import { resolveCaptionTrackName } from '@/lib/youtube/captions'
import type { YouTubeLocalization } from '@/lib/youtube/types'
import { logger } from '@/lib/logger'

export interface ProcessUploadQueueOptions {
  limit?: number
  userId?: string
  queueId?: number
}

function parseLocalizationsJson(json: string | null): Record<string, YouTubeLocalization> | undefined {
  if (!json) return undefined
  try {
    const parsed = JSON.parse(json) as Record<string, YouTubeLocalization>
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export async function processUploadQueue(options: ProcessUploadQueueOptions = {}) {
  const items = await claimPendingUploads(options.limit ?? 50, {
    userId: options.userId,
    queueId: options.queueId,
  })
  if (items.length === 0) return { processed: 0, results: [] }

  const results: { id: number; status: string; videoId?: string; error?: string }[] = []

  for (const item of items) {
    try {
      const accessToken = await getOrRefreshAccessToken(item.userId)
      if (!accessToken) {
        await failQueueItem(item.id, 'No valid access token - user may need to re-login')
        results.push({ id: item.id, status: 'failed', error: 'no_token' })
        continue
      }

      const allowed = ['.blob.core.windows.net', '.perso.ai', 'perso.ai']
      const urlHost = new URL(item.videoUrl).hostname
      const isAllowed = allowed.some((d) => urlHost === d || urlHost.endsWith(d))
      if (!isAllowed) {
        await failQueueItem(item.id, 'Video URL domain not allowed')
        results.push({ id: item.id, status: 'failed', error: 'invalid_domain' })
        continue
      }

      const videoRes = await fetch(item.videoUrl)
      if (!videoRes.ok) {
        await failQueueItem(item.id, `Failed to fetch video: ${videoRes.status}`)
        results.push({ id: item.id, status: 'failed', error: 'fetch_failed' })
        continue
      }
      const videoBlob = await videoRes.blob()

      const result = await uploadVideoToYouTube({
        accessToken,
        videoBlob,
        title: item.title,
        description: item.description,
        tags: item.tags ? item.tags.split(',') : [],
        privacyStatus: item.privacyStatus as 'public' | 'unlisted' | 'private',
        publishAt: item.publishAt,
        selfDeclaredMadeForKids: item.selfDeclaredMadeForKids,
        containsSyntheticMedia: item.containsSyntheticMedia,
        language: item.language || undefined,
        localizations: parseLocalizationsJson(item.localizationsJson),
      })

      if (item.uploadCaptions && item.srtContent?.trim()) {
        try {
          await uploadCaptionToYouTube({
            accessToken,
            videoId: result.videoId,
            language: item.captionLanguage || item.langCode,
            name: resolveCaptionTrackName(item.captionLanguage || item.langCode, item.captionName),
            srtContent: item.srtContent,
          })
        } catch (err) {
          logger.warn('queue caption upload failed', {
            queueId: item.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }

      await completeQueueItem(item.id, result.videoId)

      try {
        await createYouTubeUpload({
          userId: item.userId,
          youtubeVideoId: result.videoId,
          title: item.title,
          languageCode: item.langCode,
          privacyStatus: item.privacyStatus,
          isShort: item.isShort,
          uploadKind: item.uploadKind,
          metadataJson: item.metadataJson,
        })
        await updateJobLanguageYouTube(item.jobId, item.langCode, result.videoId)
      } catch {
        // DB update is best-effort
      }

      results.push({ id: item.id, status: 'done', videoId: result.videoId })
      logger.info('queue upload success', { queueId: item.id, videoId: result.videoId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await failQueueItem(item.id, msg)
      results.push({ id: item.id, status: 'failed', error: msg })
      logger.error('queue upload failed', { queueId: item.id, error: msg })
    }
  }

  return { processed: results.length, results }
}
