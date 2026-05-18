import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { applyYouTubePostUploadActions } from '@/lib/youtube/server'
import {
  withTokenRetry,
  ytHandle,
} from '@/lib/youtube/route-helpers'
import { uploadPostProcessingFormSchema } from '@/lib/validators/youtube'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  return ytHandle(async () => {
    const form = await req.formData()
    const fields = uploadPostProcessingFormSchema.parse({
      videoId: String(form.get('videoId') || ''),
      thumbnailUrl: (form.get('thumbnailUrl') as string) || undefined,
      playlistIds: (form.get('playlistIds') as string) || undefined,
    })
    const thumbnail = form.get('thumbnail')
    const thumbnailBlob = thumbnail instanceof Blob && thumbnail.size > 0
      ? thumbnail
      : undefined

    return withTokenRetry(req, (accessToken) =>
      applyYouTubePostUploadActions({
        accessToken,
        videoId: fields.videoId,
        thumbnailBlob,
        thumbnailUrl: fields.thumbnailUrl,
        playlistIds: fields.playlistIds,
      }),
    )
  })
}
