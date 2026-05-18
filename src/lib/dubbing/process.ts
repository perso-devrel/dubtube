import 'server-only'

import {
  finalizeJobCredits,
  getDubbingJobLanguageWorkItem,
  getDubbingJobLanguageWorkItems,
  getJobLanguageTerminalSummary,
  updateJobLanguageCompleted,
  updateJobLanguageProgress,
  updateJobStatus,
  type DubbingJobLanguageWorkItem,
} from '@/lib/db/queries'
import { persoFetch } from '@/lib/perso/client'
import type { DownloadResponse, DownloadTarget, ProgressResponse } from '@/lib/perso/types'
import { getPersoFileUrl } from '@/lib/api-client/perso'
import { enqueueYouTubeUpload } from '@/lib/upload-queue/enqueue'
import { translateMetadata } from '@/lib/translate/gemini'
import { logger } from '@/lib/logger'
import { recordOperationalEventSafe } from '@/lib/ops/observability'
import { getLanguageByCode, toBcp47 } from '@/utils/languages'
import { resolveCaptionTrackName } from '@/lib/youtube/captions'
import { appendAiDisclosureFooter, appendTextFooter, stripAiDisclosureFooter } from '@/features/dubbing/utils/aiDisclosure'
import {
  snapshotLocalizationsJson,
  snapshotMetadataJson,
} from '@/lib/youtube/upload-snapshot'

export interface ProcessDubbingJobsOptions {
  limit?: number
}

interface CompletedAssets {
  dubbedVideoUrl: string | null
  audioUrl: string | null
  srtUrl: string | null
}

function mapProgressReasonToStatus(reason: string) {
  switch (reason) {
    case 'PENDING':
    case 'CREATED':
    case 'Enqueue Pending':
    case 'Slow Mode Pending':
      return 'transcribing'
    case 'READY':
    case 'READY_TARGET_LANGUAGES':
    case 'Transcribing':
    case 'Translating':
      return 'translating'
    case 'ENQUEUED':
    case 'Uploading':
    case 'Generating Voice':
      return 'synthesizing'
    case 'PROCESSING':
    case 'Analyzing Lip Sync':
    case 'Applying Lip Sync':
      return 'merging'
    case 'COMPLETED':
    case 'Completed':
      return 'completed'
    case 'FAILED':
    case 'CANCELED':
    case 'Failed':
      return 'failed'
    default:
      return 'translating'
  }
}

function isCompleted(reason: string) {
  return reason === 'COMPLETED' || reason === 'Completed'
}

function isFailed(reason: string) {
  return reason === 'FAILED' || reason === 'Failed' || reason === 'CANCELED'
}

function toAbsoluteUrl(url?: string | null) {
  if (!url) return null
  return url.startsWith('http') ? url : getPersoFileUrl(url)
}

async function fetchProgress(item: DubbingJobLanguageWorkItem) {
  return persoFetch<ProgressResponse>(
    `/video-translator/api/v1/projects/${item.projectSeq}/space/${item.spaceSeq}/progress`,
    { baseURL: 'api' },
  )
}

async function fetchDownloadLinks(item: DubbingJobLanguageWorkItem, target: DownloadTarget = 'all') {
  return persoFetch<DownloadResponse>(
    `/video-translator/api/v1/projects/${item.projectSeq}/spaces/${item.spaceSeq}/download`,
    { baseURL: 'api', query: { target } },
  )
}

async function tryFetchDownloadLinks(item: DubbingJobLanguageWorkItem, target: DownloadTarget) {
  try {
    return await fetchDownloadLinks(item, target)
  } catch (err) {
    logger.warn('perso download link fetch failed in dubbing worker', {
      jobId: item.jobId,
      langCode: item.languageCode,
      target,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return null
  }
}

async function resolveCompletedAssets(item: DubbingJobLanguageWorkItem): Promise<CompletedAssets> {
  const [dubbingDownloads, allDownloads] = await Promise.all([
    tryFetchDownloadLinks(item, 'dubbingVideo'),
    tryFetchDownloadLinks(item, 'all'),
  ])
  if (!dubbingDownloads && !allDownloads) {
    throw new Error('Unable to fetch Perso download links')
  }

  return {
    dubbedVideoUrl: toAbsoluteUrl(
      dubbingDownloads?.videoFile?.videoDownloadLink
        ?? allDownloads?.videoFile?.videoDownloadLink,
    ),
    audioUrl: toAbsoluteUrl(allDownloads?.audioFile?.voiceAudioDownloadLink),
    srtUrl: toAbsoluteUrl(allDownloads?.srtFile?.translatedSubtitleDownloadLink),
  }
}

async function fetchTranslatedSrt(item: DubbingJobLanguageWorkItem): Promise<string | null> {
  let downloads = await fetchDownloadLinks(item, 'translatedSubtitle').catch(() => null)
  let path = downloads?.srtFile?.translatedSubtitleDownloadLink
  if (!path) {
    downloads = await fetchDownloadLinks(item, 'audioScript').catch(() => null)
    path = downloads?.srtFile?.translatedSubtitleDownloadLink
  }
  if (!path) return null

  const res = await fetch(path.startsWith('http') ? path : getPersoFileUrl(path))
  if (!res.ok) return null
  const srt = await res.text()
  return srt.trim().length > 0 ? srt : null
}

function applyDescriptionFooter(item: DubbingJobLanguageWorkItem, description: string) {
  const snapshot = item.uploadSettings
  const settings = snapshot.uploadSettings
  let next = stripAiDisclosureFooter(description)
  if (settings.attachOriginalLink && snapshot.originalYouTubeUrl) {
    next = appendTextFooter(next, `Original video: ${snapshot.originalYouTubeUrl}`)
  }
  return appendAiDisclosureFooter(
    next,
    item.languageCode,
    item.deliverableMode === 'newDubbedVideos' && settings.containsSyntheticMedia,
  )
}

async function buildMetadata(item: DubbingJobLanguageWorkItem) {
  const settings = item.uploadSettings.uploadSettings
  const lang = getLanguageByCode(item.languageCode)
  const baseTitle = settings.title.trim() || item.videoTitle || 'sub2tube video'
  const baseDescription = stripAiDisclosureFooter(settings.description || '')
  let translated = { title: baseTitle, description: baseDescription }

  try {
    const translations = await translateMetadata({
      title: baseTitle,
      description: baseDescription,
      sourceLang: settings.metadataLanguage || 'ko',
      targetLangs: [item.languageCode],
    })
    translated = translations[item.languageCode] ?? translated
  } catch (err) {
    logger.warn('metadata translation failed in dubbing worker', {
      jobId: item.jobId,
      langCode: item.languageCode,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }

  return {
    title: translated.title,
    description: applyDescriptionFooter(item, translated.description),
    tags: Array.from(new Set([...settings.tags, lang?.name ?? item.languageCode].map((tag) => tag.trim()).filter(Boolean))),
    captionName: resolveCaptionTrackName(toBcp47(item.languageCode), lang?.name ?? item.languageCode),
  }
}

async function enqueueCompletedLanguage(
  item: DubbingJobLanguageWorkItem,
  assets: CompletedAssets,
  options: { force?: boolean } = {},
) {
  const settings = item.uploadSettings.uploadSettings
  if (item.deliverableMode !== 'newDubbedVideos') return { status: 'skipped_mode' }
  if (!options.force && (!settings.autoUpload || !settings.uploadReviewConfirmed)) {
    return { status: 'skipped_settings' }
  }
  if (item.youtubeVideoId || item.youtubeUploadStatus === 'uploaded') return { status: 'already_uploaded' }
  if (!options.force && item.youtubeUploadStatus === 'failed') return { status: 'skipped_upload_failed' }

  const videoUrl = assets.dubbedVideoUrl ?? item.dubbedVideoUrl
  if (!videoUrl) return { status: 'missing_video_url' }

  const metadata = await buildMetadata(item)
  const snapshot = item.youtubeUploadSnapshot
  const snapshotMetadata = snapshot?.metadata.translated[item.languageCode]
  const uploadCaptions = snapshot?.settings.uploadCaptions ?? settings.uploadCaptions
  const publishAt = snapshot?.settings.publishAt ?? settings.publishAt
  const playlistIds = snapshot?.settings.playlistIds?.length
    ? snapshot.settings.playlistIds
    : settings.playlistIds
  const srtContent = uploadCaptions ? await fetchTranslatedSrt(item).catch(() => null) : null

  return enqueueYouTubeUpload({
    userId: item.userId,
    jobId: item.jobId,
    langCode: item.languageCode,
    videoUrl,
    title: snapshotMetadata?.title || metadata.title,
    description: snapshotMetadata?.finalDescription || metadata.description,
    tags: snapshot?.settings.tags?.length ? snapshot.settings.tags : metadata.tags,
    categoryId: snapshot?.settings.categoryId || settings.categoryId,
    privacyStatus: snapshot?.settings.privacyStatus || settings.privacyStatus,
    publishAt,
    notifySubscribers: snapshot?.settings.notifySubscribers ?? settings.notifySubscribers,
    thumbnailUrl: snapshot?.settings.thumbnailUrl || settings.thumbnailUrl,
    playlistIds,
    language: item.languageCode,
    isShort: item.isShort,
    uploadCaptions,
    captionLanguage: toBcp47(item.languageCode),
    captionName: metadata.captionName,
    srtContent,
    selfDeclaredMadeForKids: snapshot?.settings.selfDeclaredMadeForKids ?? settings.selfDeclaredMadeForKids,
    containsSyntheticMedia: snapshot?.settings.containsSyntheticMedia ?? (item.deliverableMode === 'newDubbedVideos' && settings.containsSyntheticMedia),
    uploadKind: snapshot?.uploadKind,
    metadataJson: snapshot ? snapshotMetadataJson(snapshot) : null,
    localizationsJson: snapshot ? snapshotLocalizationsJson(snapshot) : null,
    resetFailed: Boolean(options.force),
  })
}

export async function enqueueCompletedDubbingUpload(
  jobId: number,
  langCode: string,
  options: { force?: boolean } = {},
) {
  const item = await getDubbingJobLanguageWorkItem(jobId, langCode)
  if (!item) return { status: 'not_found' as const }

  const completed =
    item.languageStatus === 'completed' ||
    isCompleted(item.progressReason) ||
    item.dubbedVideoUrl !== null
  if (!completed) return { status: 'not_completed' as const }

  let assets: CompletedAssets = {
    dubbedVideoUrl: item.dubbedVideoUrl,
    audioUrl: item.audioUrl,
    srtUrl: item.srtUrl,
  }

  if (!assets.dubbedVideoUrl) {
    assets = await resolveCompletedAssets(item)
    await updateJobLanguageCompleted(item.jobId, item.languageCode, {
      dubbedVideoUrl: assets.dubbedVideoUrl ?? undefined,
      audioUrl: assets.audioUrl ?? undefined,
      srtUrl: assets.srtUrl ?? undefined,
    })
  }

  return enqueueCompletedLanguage(item, assets, options)
}

async function finalizeJobIfTerminal(item: DubbingJobLanguageWorkItem) {
  const summary = await getJobLanguageTerminalSummary(item.jobId)
  if (summary.total === 0 || summary.terminal < summary.total) return null

  const status = summary.failed > 0 ? 'failed' : 'completed'
  await updateJobStatus(item.jobId, status)
  await finalizeJobCredits(item.userId, item.jobId)
  return status
}

export async function processDubbingJobs(options: ProcessDubbingJobsOptions = {}) {
  const items = await getDubbingJobLanguageWorkItems(options.limit ?? 50)
  const results: Array<{
    jobId: number
    langCode: string
    status: string
    uploadStatus?: string
    error?: string
  }> = []

  for (const item of items) {
    try {
      let assets: CompletedAssets = {
        dubbedVideoUrl: item.dubbedVideoUrl,
        audioUrl: item.audioUrl,
        srtUrl: item.srtUrl,
      }

      if (item.languageStatus !== 'completed') {
        const progress = await fetchProgress(item)
        const status = mapProgressReasonToStatus(progress.progressReason)
        await updateJobLanguageProgress(
          item.jobId,
          item.languageCode,
          status,
          progress.progress,
          progress.progressReason,
        )

        if (isCompleted(progress.progressReason)) {
          assets = await resolveCompletedAssets(item).catch(() => assets)
          await updateJobLanguageCompleted(item.jobId, item.languageCode, {
            dubbedVideoUrl: assets.dubbedVideoUrl ?? undefined,
            audioUrl: assets.audioUrl ?? undefined,
            srtUrl: assets.srtUrl ?? undefined,
          })
        } else if (isFailed(progress.progressReason)) {
          await recordOperationalEventSafe({
            category: 'perso',
            eventType: 'perso_language_failed',
            severity: progress.progressReason === 'CANCELED' ? 'warning' : 'error',
            userId: item.userId,
            referenceType: 'dubbing_job',
            referenceId: item.jobId,
            message: 'Perso language processing failed',
            metadata: { langCode: item.languageCode, progressReason: progress.progressReason },
            idempotencyKey: `perso_language_failed:${item.jobId}:${item.languageCode}:${progress.progressReason}`,
          })
        }
      }

      const isNowCompleted =
        item.languageStatus === 'completed' ||
        isCompleted(item.progressReason) ||
        assets.dubbedVideoUrl !== null
      const uploadResult = isNowCompleted
        ? await enqueueCompletedLanguage(item, assets).catch((err) => ({
            status: 'upload_enqueue_failed',
            error: err instanceof Error ? err.message : 'Unknown error',
          }))
        : null

      const uploadError =
        uploadResult && 'error' in uploadResult
          ? String(uploadResult.error)
          : undefined
      const finalized = await finalizeJobIfTerminal(item)
      results.push({
        jobId: item.jobId,
        langCode: item.languageCode,
        status: finalized ?? (isNowCompleted ? 'completed' : 'processing'),
        uploadStatus: uploadResult?.status,
        error: uploadError,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error('dubbing worker item failed', {
        jobId: item.jobId,
        langCode: item.languageCode,
        error: message,
      })
      results.push({
        jobId: item.jobId,
        langCode: item.languageCode,
        status: 'failed',
        error: message,
      })
    }
  }

  return { processed: results.length, results }
}
