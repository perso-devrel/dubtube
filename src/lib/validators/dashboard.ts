import { z } from 'zod'

export const summaryQuerySchema = z.object({
  uid: z.string().min(1),
})

export const jobsQuerySchema = z.object({
  uid: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const creditUsageQuerySchema = z.object({
  uid: z.string().min(1),
})

export const languagePerformanceQuerySchema = z.object({
  uid: z.string().min(1),
})

const createDubbingJobSchema = z.object({
  type: z.literal('createDubbingJob'),
  payload: z.object({
    userId: z.string().min(1),
    videoTitle: z.string().min(1),
    videoDurationMs: z.number().int().nonnegative(),
    videoThumbnail: z.string(),
    sourceLanguage: z.string().min(1),
    mediaSeq: z.number().int(),
    spaceSeq: z.number().int(),
    lipSyncEnabled: z.boolean(),
    isShort: z.boolean(),
    deliverableMode: z.enum(['newDubbedVideos', 'originalWithMultiAudio', 'downloadOnly']).optional(),
    originalVideoUrl: z.string().nullable().optional(),
    originalYouTubeUrl: z.string().nullable().optional(),
    uploadSettings: z.object({
      autoUpload: z.boolean(),
      attachOriginalLink: z.boolean(),
      title: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
      privacyStatus: z.enum(['public', 'unlisted', 'private']),
      publishAt: z.string().nullable().optional(),
      publishAtTimeZone: z.string().nullable().optional(),
      uploadCaptions: z.boolean(),
      selfDeclaredMadeForKids: z.boolean(),
      containsSyntheticMedia: z.boolean(),
      uploadReviewConfirmed: z.boolean(),
      metadataLanguage: z.string(),
    }).optional(),
  }),
})

const createJobLanguagesSchema = z.object({
  type: z.literal('createJobLanguages'),
  payload: z.object({
    jobId: z.number().int(),
    languages: z.array(z.object({
      code: z.string().min(1),
      projectSeq: z.number().int(),
      youtubeUploadSnapshotJson: z.string().nullable().optional(),
    })).min(1),
  }),
})

const updateJobLanguageProgressSchema = z.object({
  type: z.literal('updateJobLanguageProgress'),
  payload: z.object({
    jobId: z.number().int(),
    langCode: z.string().min(1),
    status: z.string().min(1),
    progress: z.number().min(0).max(100),
    progressReason: z.string(),
  }),
})

const updateJobLanguageCompletedSchema = z.object({
  type: z.literal('updateJobLanguageCompleted'),
  payload: z.object({
    jobId: z.number().int(),
    langCode: z.string().min(1),
    urls: z.object({
      dubbedVideoUrl: z.string().optional(),
      audioUrl: z.string().optional(),
      srtUrl: z.string().optional(),
    }),
  }),
})

const updateJobStatusSchema = z.object({
  type: z.literal('updateJobStatus'),
  payload: z.object({
    jobId: z.number().int(),
    status: z.string().min(1),
  }),
})

const updateDubbingJobOriginalYouTubeUrlSchema = z.object({
  type: z.literal('updateDubbingJobOriginalYouTubeUrl'),
  payload: z.object({
    jobId: z.number().int(),
    originalYouTubeUrl: z.string().url(),
  }),
})

const createYouTubeUploadSchema = z.object({
  type: z.literal('createYouTubeUpload'),
  payload: z.object({
    userId: z.string().min(1),
    jobLanguageId: z.number().int().optional(),
    youtubeVideoId: z.string().min(1),
    title: z.string().min(1),
    languageCode: z.string().min(1),
    privacyStatus: z.string().min(1),
    isShort: z.boolean(),
    uploadKind: z.string().optional(),
    metadataJson: z.string().nullable().optional(),
  }),
})

const updateJobLanguageYouTubeSchema = z.object({
  type: z.literal('updateJobLanguageYouTube'),
  payload: z.object({
    jobId: z.number().int(),
    langCode: z.string().min(1),
    youtubeVideoId: z.string().min(1),
  }),
})

const startJobLanguageYouTubeUploadSchema = z.object({
  type: z.literal('startJobLanguageYouTubeUpload'),
  payload: z.object({
    jobId: z.number().int(),
    langCode: z.string().min(1),
  }),
})

const failJobLanguageYouTubeUploadSchema = z.object({
  type: z.literal('failJobLanguageYouTubeUpload'),
  payload: z.object({
    jobId: z.number().int(),
    langCode: z.string().min(1),
  }),
})

const deductUserMinutesSchema = z.object({
  type: z.literal('deductUserMinutes'),
  payload: z.object({
    userId: z.string().min(1),
    jobId: z.number().int(),
    minutes: z.number().int().positive(),
  }),
})

const reserveJobCreditsSchema = z.object({
  type: z.literal('reserveJobCredits'),
  payload: z.object({
    jobId: z.number().int(),
  }),
})

const releaseJobCreditsSchema = z.object({
  type: z.literal('releaseJobCredits'),
  payload: z.object({
    jobId: z.number().int(),
    reason: z.string().min(1).max(80).default('manual_release'),
  }),
})

const finalizeJobCreditsSchema = z.object({
  type: z.literal('finalizeJobCredits'),
  payload: z.object({
    jobId: z.number().int(),
  }),
})

const updateJobLanguageProjectsSchema = z.object({
  type: z.literal('updateJobLanguageProjects'),
  payload: z.object({
    jobId: z.number().int(),
    languages: z.array(z.object({
      code: z.string().min(1),
      projectSeq: z.number().int(),
      youtubeUploadSnapshotJson: z.string().nullable().optional(),
    })).min(1),
  }),
})

const createDubbingJobWithLanguagesSchema = z.object({
  type: z.literal('createDubbingJobWithLanguages'),
  payload: z.object({
    job: createDubbingJobSchema.shape.payload,
    languages: z.array(z.object({
      code: z.string().min(1),
      projectSeq: z.number().int(),
      youtubeUploadSnapshotJson: z.string().nullable().optional(),
    })).min(1),
  }),
})

const deleteDubbingJobSchema = z.object({
  type: z.literal('deleteDubbingJob'),
  payload: z.object({
    jobId: z.number().int(),
  }),
})

const queueYouTubeUploadSchema = z.object({
  type: z.literal('queueYouTubeUpload'),
  payload: z.object({
    userId: z.string().min(1),
    jobId: z.number().int(),
    langCode: z.string().min(1),
    videoUrl: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    tags: z.array(z.string()),
    privacyStatus: z.string().min(1),
    publishAt: z.string().nullable().optional(),
    language: z.string(),
    isShort: z.boolean(),
    uploadCaptions: z.boolean().optional(),
    captionLanguage: z.string().nullable().optional(),
    captionName: z.string().nullable().optional(),
    srtContent: z.string().nullable().optional(),
    selfDeclaredMadeForKids: z.boolean().optional(),
    containsSyntheticMedia: z.boolean().optional(),
    uploadKind: z.string().optional(),
    metadataJson: z.string().nullable().optional(),
    localizationsJson: z.string().nullable().optional(),
    resetFailed: z.boolean().optional(),
    processNow: z.boolean().optional(),
  }),
})

const queueJobLanguageYouTubeUploadSchema = z.object({
  type: z.literal('queueJobLanguageYouTubeUpload'),
  payload: z.object({
    jobId: z.number().int(),
    langCode: z.string().min(1),
    processNow: z.boolean().optional(),
  }),
})

export const mutationActionSchema = z.discriminatedUnion('type', [
  createDubbingJobSchema,
  createJobLanguagesSchema,
  createDubbingJobWithLanguagesSchema,
  updateJobLanguageProgressSchema,
  updateJobLanguageCompletedSchema,
  updateJobStatusSchema,
  updateDubbingJobOriginalYouTubeUrlSchema,
  createYouTubeUploadSchema,
  updateJobLanguageYouTubeSchema,
  startJobLanguageYouTubeUploadSchema,
  failJobLanguageYouTubeUploadSchema,
  deductUserMinutesSchema,
  reserveJobCreditsSchema,
  releaseJobCreditsSchema,
  finalizeJobCreditsSchema,
  updateJobLanguageProjectsSchema,
  deleteDubbingJobSchema,
  queueYouTubeUploadSchema,
  queueJobLanguageYouTubeUploadSchema,
])

export type MutationAction = z.infer<typeof mutationActionSchema>

/**
 * Extract userId from actions that carry it directly.
 * For job-based actions (no userId in payload), the caller must verify ownership
 * by querying the DB — see mutations/route.ts verifyJobOwnership().
 */
export function getUserIdFromAction(action: MutationAction): string | null {
  switch (action.type) {
    case 'createDubbingJob':
      return action.payload.userId
    case 'createDubbingJobWithLanguages':
      return action.payload.job.userId
    case 'createYouTubeUpload':
      return action.payload.userId
    case 'queueYouTubeUpload':
      return action.payload.userId
    case 'deductUserMinutes':
      return action.payload.userId
    default:
      return null
  }
}

/** Actions that operate on a jobId and need ownership verification. */
export function getJobIdFromAction(action: MutationAction): number | null {
  switch (action.type) {
    case 'createJobLanguages':
      return action.payload.jobId
    case 'updateJobLanguageProgress':
      return action.payload.jobId
    case 'updateJobLanguageCompleted':
      return action.payload.jobId
    case 'updateJobStatus':
      return action.payload.jobId
    case 'updateDubbingJobOriginalYouTubeUrl':
      return action.payload.jobId
    case 'updateJobLanguageYouTube':
      return action.payload.jobId
    case 'startJobLanguageYouTubeUpload':
      return action.payload.jobId
    case 'failJobLanguageYouTubeUpload':
      return action.payload.jobId
    case 'deleteDubbingJob':
      return action.payload.jobId
    case 'deductUserMinutes':
      return action.payload.jobId
    case 'reserveJobCredits':
      return action.payload.jobId
    case 'releaseJobCredits':
      return action.payload.jobId
    case 'finalizeJobCredits':
      return action.payload.jobId
    case 'updateJobLanguageProjects':
      return action.payload.jobId
    case 'queueYouTubeUpload':
      return action.payload.jobId
    case 'queueJobLanguageYouTubeUpload':
      return action.payload.jobId
    default:
      return null
  }
}
