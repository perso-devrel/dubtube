import { NextRequest } from 'next/server'
import {
  createDubbingJob,
  createJobLanguages,
  createDubbingJobWithLanguages,
  updateJobLanguageProgress,
  updateJobLanguageCompleted,
  updateJobStatus,
  updateDubbingJobOriginalYouTubeUrl,
  updateJobLanguageProjects,
  createYouTubeUpload,
  createJobLanguageYouTubeUpload,
  updateJobLanguageYouTube,
  startJobLanguageYouTubeUpload,
  failJobLanguageYouTubeUpload,
  deductUserMinutes,
  reserveJobCredits,
  releaseJobCredits,
  finalizeJobCredits,
  deleteDubbingJob,
} from '@/lib/db/queries'
import { requireSession } from '@/lib/auth/session'
import { mutationActionSchema, getUserIdFromAction, getJobIdFromAction } from '@/lib/validators/dashboard'
import { apiOk, apiFail, apiFailFromError } from '@/lib/api/response'
import { getDb } from '@/lib/db/client'
import { persoFetch } from '@/lib/perso/client'
import { processUploadQueue } from '@/lib/upload-queue/process'
import { enqueueYouTubeUpload } from '@/lib/upload-queue/enqueue'
import { enqueueCompletedDubbingUpload } from '@/lib/dubbing/process'
import { recordOperationalEventSafe } from '@/lib/ops/observability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function processQueuedUploadNow(
  userId: string,
  queueId: number,
  initialStatus: string,
) {
  const processed = await processUploadQueue({ userId, queueId, limit: 1 })
  const uploadResult = processed.results.find((item) => item.id === queueId)

  if (uploadResult?.status === 'done') {
    return {
      status: 'uploaded' as const,
      queueId,
      youtubeVideoId: uploadResult.videoId ?? null,
    }
  }

  if (uploadResult?.status === 'failed') {
    return {
      status: 'failed' as const,
      queueId,
      error: uploadResult.error ?? 'upload_failed',
    }
  }

  return {
    status: initialStatus,
    queueId,
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiFail('BAD_REQUEST', 'Invalid JSON body', 400)
  }

  const parsed = mutationActionSchema.safeParse(body)
  if (!parsed.success) {
    return apiFail('BAD_REQUEST', parsed.error.issues.map((i) => i.message).join('; '), 400)
  }

  const action = parsed.data
  const actionUserId = getUserIdFromAction(action)
  if (actionUserId && actionUserId !== auth.session.uid) {
    return apiFail('FORBIDDEN', 'UID mismatch: you can only mutate your own data', 403)
  }

  // Verify job ownership for job-based actions (IDOR prevention)
  const jobId = getJobIdFromAction(action)
  if (jobId !== null) {
    const db = getDb()
    const row = await db.execute({
      sql: 'SELECT user_id FROM dubbing_jobs WHERE id = ?',
      args: [jobId],
    })
    if (!row.rows[0]) {
      return apiFail('NOT_FOUND', 'Job not found', 404)
    }
    if (row.rows[0].user_id !== auth.session.uid) {
      return apiFail('FORBIDDEN', 'You do not own this job', 403)
    }
  }

  try {
    switch (action.type) {
      case 'createDubbingJob': {
        const jobId = await createDubbingJob(action.payload)
        return apiOk({ jobId })
      }
      case 'createJobLanguages': {
        await createJobLanguages(action.payload.jobId, action.payload.languages)
        return apiOk({ jobId: action.payload.jobId })
      }
      case 'createDubbingJobWithLanguages': {
        const jobId = await createDubbingJobWithLanguages(action.payload.job, action.payload.languages)
        return apiOk({ jobId })
      }
      case 'updateJobLanguageProgress': {
        const { jobId, langCode, status, progress, progressReason } = action.payload
        await updateJobLanguageProgress(jobId, langCode, status, progress, progressReason)
        if (
          status === 'failed' ||
          progressReason === 'FAILED' ||
          progressReason === 'Failed' ||
          progressReason === 'CANCELED'
        ) {
          await recordOperationalEventSafe({
            category: 'perso',
            eventType: 'perso_language_failed',
            severity: progressReason === 'CANCELED' ? 'warning' : 'error',
            userId: auth.session.uid,
            referenceType: 'dubbing_job',
            referenceId: jobId,
            message: 'Perso language processing failed',
            metadata: { langCode, status, progress, progressReason },
            idempotencyKey: `perso_language_failed:${jobId}:${langCode}:${progressReason}`,
          })
        }
        return apiOk({ jobId, langCode })
      }
      case 'updateJobLanguageCompleted': {
        const { jobId, langCode, urls } = action.payload
        await updateJobLanguageCompleted(jobId, langCode, urls)
        return apiOk({ jobId, langCode })
      }
      case 'updateJobStatus': {
        const { jobId, status } = action.payload
        await updateJobStatus(jobId, status)
        if (status === 'failed') {
          await recordOperationalEventSafe({
            category: 'perso',
            eventType: 'perso_job_failed',
            severity: 'error',
            userId: auth.session.uid,
            referenceType: 'dubbing_job',
            referenceId: jobId,
            message: 'Dubbing job failed',
            metadata: { status },
            idempotencyKey: `perso_job_failed:${jobId}`,
          })
        }
        return apiOk({ jobId })
      }
      case 'updateDubbingJobOriginalYouTubeUrl': {
        const { jobId, originalYouTubeUrl } = action.payload
        await updateDubbingJobOriginalYouTubeUrl(jobId, originalYouTubeUrl)
        return apiOk({ jobId, originalYouTubeUrl })
      }
      case 'createYouTubeUpload': {
        const id = await createYouTubeUpload(action.payload)
        return apiOk({ id })
      }
      case 'updateJobLanguageYouTube': {
        const { jobId, langCode, youtubeVideoId } = action.payload
        await updateJobLanguageYouTube(jobId, langCode, youtubeVideoId)
        return apiOk({ jobId, langCode })
      }
      case 'recordJobLanguageCaptionUpload': {
        const result = await createJobLanguageYouTubeUpload({
          userId: auth.session.uid,
          ...action.payload,
        })
        return apiOk(result)
      }
      case 'startJobLanguageYouTubeUpload': {
        const { jobId, langCode } = action.payload
        const reservation = await startJobLanguageYouTubeUpload(jobId, langCode)
        return apiOk(reservation)
      }
      case 'failJobLanguageYouTubeUpload': {
        const { jobId, langCode } = action.payload
        await failJobLanguageYouTubeUpload(jobId, langCode)
        return apiOk({ jobId, langCode })
      }
      case 'updateJobLanguageProjects': {
        const { jobId, languages } = action.payload
        await updateJobLanguageProjects(jobId, languages)
        return apiOk({ jobId })
      }
      case 'deductUserMinutes': {
        const { userId, jobId: deductJobId, minutes: clientMinutes } = action.payload
        const deductDb = getDb()
        const jobRow = await deductDb.execute({
          sql: 'SELECT video_duration_ms FROM dubbing_jobs WHERE id = ? AND user_id = ?',
          args: [deductJobId, auth.session.uid],
        })
        const durationMs = (jobRow.rows[0]?.video_duration_ms as number) || 0
        const serverMinutes = Math.max(1, Math.ceil(durationMs / 60_000))
        const minutes = Math.min(clientMinutes, serverMinutes)
        await deductUserMinutes(userId, minutes)
        return apiOk({ userId, minutes })
      }
      case 'reserveJobCredits': {
        const { jobId: reserveJobId } = action.payload
        const result = await reserveJobCredits(auth.session.uid, reserveJobId)
        return apiOk(result)
      }
      case 'releaseJobCredits': {
        const { jobId: releaseJobId, reason } = action.payload
        const result = await releaseJobCredits(auth.session.uid, releaseJobId, reason)
        return apiOk(result)
      }
      case 'finalizeJobCredits': {
        const { jobId: finalizeJobId } = action.payload
        const result = await finalizeJobCredits(auth.session.uid, finalizeJobId)
        return apiOk(result)
      }
      case 'queueYouTubeUpload': {
        const result = await enqueueYouTubeUpload(action.payload)
        if ('queueId' in result && typeof result.queueId === 'number') {
          if (action.payload.processNow) {
            return apiOk(await processQueuedUploadNow(auth.session.uid, result.queueId, result.status))
          }
        }
        return apiOk(result)
      }
      case 'queueJobLanguageYouTubeUpload': {
        const { jobId: queuedJobId, langCode } = action.payload
        const result = await enqueueCompletedDubbingUpload(queuedJobId, langCode, { force: true })
        if ('queueId' in result && typeof result.queueId === 'number') {
          if (action.payload.processNow) {
            return apiOk(await processQueuedUploadNow(auth.session.uid, result.queueId, result.status))
          }
        }
        return apiOk(result)
      }
      case 'deleteDubbingJob': {
        const { jobId } = action.payload
        const db2 = getDb()
        const langRows = await db2.execute({
          sql: 'SELECT jl.project_seq, dj.space_seq FROM job_languages jl JOIN dubbing_jobs dj ON dj.id = jl.job_id WHERE jl.job_id = ?',
          args: [jobId],
        })
        // Perso cancel + DB delete를 병렬로 실행. cancel 실패가 DB 삭제를 막지 않도록 allSettled.
        const cancelAll = Promise.allSettled(
          langRows.rows.map((row) => {
            const projectSeq = row.project_seq as number
            const spaceSeq = row.space_seq as number
            if (!projectSeq || !spaceSeq) return Promise.resolve()
            return persoFetch<unknown>(
              `/video-translator/api/v1/projects/${projectSeq}/spaces/${spaceSeq}/cancel`,
              { method: 'POST', baseURL: 'api' },
            )
          }),
        )
        await Promise.all([cancelAll, deleteDubbingJob(jobId)])
        return apiOk({ jobId })
      }
      default: {
        return apiFail('BAD_REQUEST', 'Unknown action type', 400)
      }
    }
  } catch (err) {
    return apiFailFromError(err)
  }
}
