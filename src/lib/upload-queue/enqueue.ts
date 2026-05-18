import 'server-only'

import { createUploadQueueItem } from '@/lib/db/queries/upload-queue'
import { startJobLanguageYouTubeUpload } from '@/lib/db/queries/youtube'

export interface EnqueueYouTubeUploadInput {
  userId: string
  jobId: number
  langCode: string
  videoUrl: string
  title: string
  description: string
  tags: string[]
  privacyStatus: string
  publishAt?: string | null
  language: string
  isShort: boolean
  uploadCaptions?: boolean
  captionLanguage?: string | null
  captionName?: string | null
  srtContent?: string | null
  selfDeclaredMadeForKids?: boolean
  containsSyntheticMedia?: boolean
  uploadKind?: string
  metadataJson?: string | null
  localizationsJson?: string | null
  resetFailed?: boolean
}

export async function enqueueYouTubeUpload(input: EnqueueYouTubeUploadInput) {
  const reservation = await startJobLanguageYouTubeUpload(input.jobId, input.langCode)
  if (reservation.status === 'already_uploaded') {
    return {
      status: 'already_uploaded' as const,
      youtubeVideoId: reservation.youtubeVideoId ?? null,
    }
  }
  if (reservation.status !== 'reserved' && reservation.status !== 'already_uploading') {
    return { status: reservation.status }
  }

  const queueId = await createUploadQueueItem({
    ...input,
    resetFailed: input.resetFailed ?? true,
  })
  return {
    status: reservation.status === 'already_uploading'
      ? 'already_queued'
      : 'queued',
    queueId,
  } as const
}
