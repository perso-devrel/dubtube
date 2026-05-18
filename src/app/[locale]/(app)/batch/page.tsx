'use client'

import { useEffect, useState } from 'react'
import { LocaleLink } from '@/components/i18n/LocaleLink'
import { Plus, GripVertical, Layers, Loader2, Trash2 } from 'lucide-react'
import { Card, CardTitle, Button, Badge, Progress } from '@/components/ui'
import { LanguageBadge } from '@/components/shared/LanguageBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { formatDuration } from '@/utils/formatters'
import { useRecentJobs } from '@/hooks/useDashboardData'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { dbMutation } from '@/lib/api/dbMutation'
import { useLocaleText } from '@/hooks/useLocaleText'

const statusConfig = {
  processing: { label: 'app.app.batch.page.labelProcessing', variant: 'brand' as const },
  completed: { label: 'app.app.batch.page.labelComplete', variant: 'success' as const },
  failed: { label: 'app.app.batch.page.labelFailed', variant: 'error' as const },
  queued: { label: 'app.app.batch.page.labelQueued', variant: 'default' as const },
}

export default function BatchPage() {
  const t = useLocaleText()
  const { data: jobs = [], isLoading } = useRecentJobs()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDeleteJob = async (jobId: number) => {
    if (deletingId === jobId) return
    const ok = window.confirm(
      t('app.app.batch.page.deleteThisDubbingJobAnyWorkInProgress'),
    )
    if (!ok) return

    setDeletingId(jobId)
    queryClient.setQueryData(['recent-jobs', user?.uid, 10], (old: typeof jobs) =>
      old ? old.filter((j) => j.id !== jobId) : old,
    )
    try {
      await dbMutation({ type: 'deleteDubbingJob', payload: { jobId } })
    } finally {
      setDeletingId(null)
      queryClient.invalidateQueries({ queryKey: ['recent-jobs'] })
    }
  }

  // Auto-complete stale jobs where avg_progress hit 100 but DB still shows 'processing'
  useEffect(() => {
    if (!user || jobs.length === 0) return
    const stale = jobs.filter(
      (j) => j.status === 'processing' && Number(j.avg_progress) >= 100,
    )
    if (stale.length === 0) return

    Promise.all(
      stale.map((j) =>
        dbMutation({ type: 'updateJobStatus', payload: { jobId: j.id, status: 'completed' } }),
      ),
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['recent-jobs'] })
    })
  }, [jobs, user, queryClient])

  const activeJobs = jobs.filter(
    (j) => (j.status === 'processing' || j.status === 'queued') && Number(j.avg_progress) < 100,
  )
  const processing = activeJobs.filter((j) => j.status === 'processing').length
  const queued = activeJobs.filter((j) => j.status === 'queued').length

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">{t('app.app.batch.page.dubbingJobs')}</h1>
          <p className="text-surface-600 dark:text-surface-400">{t('app.app.batch.page.reviewActiveDubbingJobs')}</p>
        </div>
        <div className="flex items-center gap-2 text-surface-500 dark:text-surface-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t('app.app.batch.page.loading')}</span>
        </div>
      </div>
    )
  }

  if (activeJobs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">{t('app.app.batch.page.dubbingJobs2')}</h1>
          <p className="text-surface-600 dark:text-surface-400">{t('app.app.batch.page.reviewActiveDubbingJobs2')}</p>
        </div>
        <EmptyState
          icon={<Layers className="h-12 w-12" />}
          title={t('app.app.batch.page.noActiveJobs')}
          description={t('app.app.batch.page.newDubbingJobsWillAppearHere')}
          action={
            <LocaleLink href="/dubbing">
              <Button><Plus className="h-4 w-4" /> {t('app.app.batch.page.newDubbing')}</Button>
            </LocaleLink>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">{t('app.app.batch.page.dubbingJobs3')}</h1>
          <p className="text-surface-600 dark:text-surface-400">
            {processing > 0 && t('app.app.batch.page.valueProcessing', { processing: processing })}
            {processing > 0 && queued > 0 && ' · '}
            {queued > 0 && t('app.app.batch.page.valueQueued', { queued: queued })}
          </p>
        </div>
        <LocaleLink href="/dubbing">
          <Button><Plus className="h-4 w-4" /> {t('app.app.batch.page.newDubbing2')}</Button>
        </LocaleLink>
      </div>

      <Card>
        <CardTitle>{t('app.app.batch.page.jobsValue', { activeJobsLength: activeJobs.length })}</CardTitle>

        <div className="mt-4 space-y-2">
          {activeJobs.map((job) => {
            const langList = job.languages
              ? String(job.languages).split(',').filter(Boolean)
              : []
            const progress = Math.round(Number(job.avg_progress) || 0)
            const status = statusConfig[job.status as keyof typeof statusConfig] ?? statusConfig.queued

            return (
              <div
                key={job.id}
                className="flex flex-col gap-3 rounded-lg border border-surface-200 p-3 transition-colors hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/50 sm:flex-row sm:items-center"
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-surface-300" />

                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md bg-surface-200 text-xs text-surface-500 dark:bg-surface-800 dark:text-surface-300">
                  {formatDuration(Math.round(job.video_duration_ms / 1000))}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-surface-900 dark:text-white">
                    {job.video_title}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {langList.slice(0, 3).map((lang) => (
                      <LanguageBadge key={lang} code={lang} />
                    ))}
                    {langList.length > 3 && (
                      <span className="text-xs text-surface-500 dark:text-surface-400">+{langList.length - 3}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
                  <Badge variant={status.variant}>{t(status.label)}</Badge>
                  {job.status === 'processing' && (
                    <Progress value={progress} size="sm" className="w-24" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteJob(job.id)}
                  disabled={deletingId === job.id}
                  aria-label={t('app.app.batch.page.deleteJob')}
                  className={`shrink-0 rounded-md p-1.5 transition-colors ${
                    deletingId === job.id
                      ? 'cursor-not-allowed text-surface-300'
                      : 'text-surface-500 hover:bg-red-50 hover:text-red-600 dark:text-surface-400 dark:hover:bg-red-900/20 dark:hover:text-red-400'
                  }`}
                  title={deletingId === job.id
                    ? t('app.app.batch.page.deleting')
                    : t('app.app.batch.page.deleteJob2')}
                >
                  {deletingId === job.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
