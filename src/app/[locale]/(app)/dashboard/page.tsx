import { cookies } from 'next/headers'
import { getUserSummary, getUserDubbingJobs, getCreditUsageByMonth, getUserYouTubeUploads } from '@/lib/db/queries'
import { DashboardContent } from '@/features/dashboard/components/DashboardContent'
import { verifySessionCookie } from '@/lib/auth/session-cookie'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('sub2tube_session')?.value
  const uid = raw ? await verifySessionCookie(raw) : null

  if (!uid) {
    return null
  }

  const [summary, jobs, creditUsage, ytUploads] = await Promise.all([
    getUserSummary(uid),
    getUserDubbingJobs(uid, 5),
    getCreditUsageByMonth(uid),
    getUserYouTubeUploads(uid),
  ])

  const ytVideoIds = ytUploads
    .map((u) => u.youtube_video_id)
    .filter(Boolean)

  return (
    <DashboardContent
      initial={{
        summary,
        jobs,
        creditUsage,
        ytVideoIds,
      }}
    />
  )
}
