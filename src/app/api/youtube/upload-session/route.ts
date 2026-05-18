import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { initYouTubeResumableUpload } from '@/lib/youtube/server'
import {
  parseYtBody,
  withTokenRetry,
  ytHandle,
} from '@/lib/youtube/route-helpers'
import { uploadSessionBodySchema } from '@/lib/validators/youtube'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * YouTube resumable upload 세션 시작 전용 엔드포인트.
 *
 * 영상 바이너리는 받지 않는다 — 메타데이터만 받아 YouTube에서 session URI를 발급받고
 * 클라이언트에 그대로 전달한다. 클라이언트는 받은 URI로 영상을 직접 PUT해서 Vercel 함수
 * body 한도(4.5MB)를 우회한다.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  // 브라우저가 받은 session URI로 직접 PUT하므로, init 시 Origin을 YouTube에 전달해
  // 응답 session URI가 해당 origin에 대해 CORS 허용 상태로 발급되도록 한다.
  const origin = req.headers.get('origin') || undefined

  return ytHandle(async () => {
    const body = await parseYtBody(req, uploadSessionBodySchema)
    return withTokenRetry(req, (accessToken) =>
      initYouTubeResumableUpload({
        accessToken,
        contentType: body.contentType,
        contentLength: body.contentLength,
        title: body.title,
        description: body.description,
        tags: body.tags,
        categoryId: body.categoryId,
        privacyStatus: body.privacyStatus,
        publishAt: body.publishAt,
        notifySubscribers: body.notifySubscribers,
        selfDeclaredMadeForKids: body.selfDeclaredMadeForKids,
        containsSyntheticMedia: body.containsSyntheticMedia,
        language: body.language,
        localizations: body.localizations,
        origin,
      }),
    )
  })
}
