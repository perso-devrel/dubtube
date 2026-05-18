import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import {
  uploadVideoToYouTube,
  YouTubeError,
} from '@/lib/youtube/server'
import {
  requireAccessToken,
  ytHandle,
} from '@/lib/youtube/route-helpers'
import { uploadFormSchema } from '@/lib/validators/youtube'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  return ytHandle(async () => {
    const accessToken = await requireAccessToken(req)
    const form = await req.formData()

    const rawFields = {
      title: String(form.get('title') || ''),
      description: String(form.get('description') || ''),
      tags: String(form.get('tags') || ''),
      categoryId: (form.get('categoryId') as string) || undefined,
      privacyStatus: (form.get('privacyStatus') as string) || undefined,
      publishAt: (form.get('publishAt') as string) || undefined,
      selfDeclaredMadeForKids: (form.get('selfDeclaredMadeForKids') as string) || undefined,
      containsSyntheticMedia: (form.get('containsSyntheticMedia') as string) || undefined,
      language: (form.get('language') as string) || undefined,
      localizations: (form.get('localizations') as string) || undefined,
    }
    const fields = uploadFormSchema.parse(rawFields)

    // Support videoUrl (server fetches directly, avoids client CORS) OR direct file upload
    let videoBlob: Blob
    const videoUrl = form.get('videoUrl')
    if (typeof videoUrl === 'string' && videoUrl.startsWith('http')) {
      // SSRF prevention: only allow known video source domains
      const allowed = ['.blob.core.windows.net', '.perso.ai', 'perso.ai']
      const urlHost = new URL(videoUrl).hostname
      const isAllowed = allowed.some((d) => urlHost === d || urlHost.endsWith(d))
      if (!isAllowed) {
        throw new YouTubeError(400, 'Video URL domain not allowed', 'INVALID_VIDEO_URL')
      }
      const res = await fetch(videoUrl)
      if (!res.ok) throw new YouTubeError(502, 'Failed to fetch video from source URL', 'VIDEO_FETCH_FAILED')
      videoBlob = await res.blob()
    } else {
      const video = form.get('video')
      if (!(video instanceof Blob)) {
        throw new YouTubeError(400, 'Missing video file or videoUrl', 'MISSING_VIDEO')
      }
      videoBlob = video
    }

    return uploadVideoToYouTube({
      accessToken,
      videoBlob,
      title: fields.title,
      description: fields.description,
      tags: fields.tags,
      categoryId: fields.categoryId,
      privacyStatus: fields.privacyStatus,
      publishAt: fields.publishAt,
      selfDeclaredMadeForKids: fields.selfDeclaredMadeForKids,
      containsSyntheticMedia: fields.containsSyntheticMedia,
      language: fields.language,
      localizations: fields.localizations,
    })
  })
}
