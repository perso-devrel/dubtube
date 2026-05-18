'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Clock, Layers, ListFilter, Loader2, Plus, UploadCloud } from 'lucide-react'
import { LocaleLink } from '@/components/i18n/LocaleLink'
import { EmptyState } from '@/components/feedback/EmptyState'
import { LanguageBadge } from '@/components/shared/LanguageBadge'
import { Badge, Button, Card, CardTitle, Progress } from '@/components/ui'
import { useRecentJobs } from '@/hooks/useDashboardData'
import { useAppLocale } from '@/hooks/useLocaleText'
import type { AppLocale } from '@/lib/i18n/config'
import { cn } from '@/utils/cn'
import { formatDuration } from '@/utils/formatters'
import type { DubbingJob } from '@/features/dashboard/components/types'

type JobFilter = 'all' | 'inProgress' | 'completed' | 'uploadPending' | 'uploadCompleted'

const copy: Record<AppLocale, {
  title: string
  description: string
  newJob: string
  loading: string
  loadError: string
  emptyTitle: string
  emptyDescription: string
  noFilterTitle: string
  noFilterDescription: string
  filters: Record<JobFilter, string>
  status: {
    completed: string
    failed: string
    processing: string
    queued: string
    pending: string
    uploadPending: string
    uploadCompleted: string
  }
  createdAt: string
  progress: string
  languages: string
  uploadedCount: (done: number, total: number) => string
  uploadPendingCount: (count: number) => string
  uploadProcessingCount: (count: number) => string
}> = {
  ko: {
    title: '작업 전체',
    description: '진행 상태와 YouTube 업로드 상태를 한 곳에서 확인하세요.',
    newJob: '새 작업',
    loading: '작업을 불러오는 중',
    loadError: '작업 목록을 불러오지 못했습니다.',
    emptyTitle: '아직 작업이 없습니다',
    emptyDescription: '새 더빙 작업을 만들면 이곳에 전체 작업이 쌓입니다.',
    noFilterTitle: '해당 상태의 작업이 없습니다',
    noFilterDescription: '다른 상태 필터를 선택해 전체 작업 흐름을 확인하세요.',
    filters: {
      all: '전체',
      inProgress: '진행 중',
      completed: '완료',
      uploadPending: '업로드 대기',
      uploadCompleted: '업로드 완료',
    },
    status: {
      completed: '완료',
      failed: '실패',
      processing: '진행 중',
      queued: '대기 중',
      pending: '대기 중',
      uploadPending: '업로드 대기',
      uploadCompleted: '업로드 완료',
    },
    createdAt: '생성',
    progress: '진행률',
    languages: '언어',
    uploadedCount: (done, total) => `${done}/${total} 업로드`,
    uploadPendingCount: (count) => `${count}개 업로드 대기`,
    uploadProcessingCount: (count) => `${count}개 업로드 중`,
  },
  en: {
    title: 'All jobs',
    description: 'Track processing and YouTube upload states in one place.',
    newJob: 'New job',
    loading: 'Loading jobs',
    loadError: 'Could not load jobs.',
    emptyTitle: 'No jobs yet',
    emptyDescription: 'Create a new dubbing job to start building your job history.',
    noFilterTitle: 'No jobs in this state',
    noFilterDescription: 'Choose another status filter to review the full job flow.',
    filters: {
      all: 'All',
      inProgress: 'In progress',
      completed: 'Completed',
      uploadPending: 'Upload pending',
      uploadCompleted: 'Upload completed',
    },
    status: {
      completed: 'Completed',
      failed: 'Failed',
      processing: 'In progress',
      queued: 'Queued',
      pending: 'Pending',
      uploadPending: 'Upload pending',
      uploadCompleted: 'Upload completed',
    },
    createdAt: 'Created',
    progress: 'Progress',
    languages: 'Languages',
    uploadedCount: (done, total) => `${done}/${total} uploaded`,
    uploadPendingCount: (count) => `${count} pending upload`,
    uploadProcessingCount: (count) => `${count} uploading`,
  },
}

const statusVariant: Record<string, 'success' | 'brand' | 'default' | 'error'> = {
  completed: 'success',
  failed: 'error',
  processing: 'brand',
  queued: 'default',
  pending: 'default',
}

function getJobState(job: DubbingJob) {
  const progress = Math.round(Number(job.avg_progress) || 0)
  const languageCount = Math.max(Number(job.language_count) || 0, job.languages ? job.languages.split(',').filter(Boolean).length : 0)
  const uploadedCount = Number(job.uploaded_count) || 0
  const uploadPendingCount = Number(job.upload_pending_count) || 0
  const uploadProcessingCount = Number(job.upload_processing_count) || 0
  const isInProgress = ['processing', 'queued', 'pending'].includes(job.status) && progress < 100
  const isCompleted = job.status === 'completed' || progress >= 100
  const hasUploadPending = isCompleted && uploadPendingCount > 0
  const hasUploadCompleted = languageCount > 0 && uploadedCount >= languageCount

  return {
    progress,
    languageCount,
    uploadedCount,
    uploadPendingCount,
    uploadProcessingCount,
    isInProgress,
    isCompleted,
    hasUploadPending,
    hasUploadCompleted,
  }
}

function matchesFilter(job: DubbingJob, filter: JobFilter) {
  const state = getJobState(job)
  if (filter === 'all') return true
  if (filter === 'inProgress') return state.isInProgress
  if (filter === 'completed') return state.isCompleted
  if (filter === 'uploadPending') return state.hasUploadPending
  return state.hasUploadCompleted
}

export default function JobsPage() {
  const locale = useAppLocale()
  const text = copy[locale]
  const { data: jobs = [], isLoading, isError } = useRecentJobs(undefined, 100)
  const [filter, setFilter] = useState<JobFilter>('all')
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    [locale],
  )
  const visibleJobs = useMemo(
    () => jobs.filter((job) => matchesFilter(job, filter)),
    [filter, jobs],
  )
  const filters = useMemo(
    () => ([
      { id: 'all' as const, icon: ListFilter },
      { id: 'inProgress' as const, icon: Clock },
      { id: 'completed' as const, icon: CheckCircle2 },
      { id: 'uploadPending' as const, icon: UploadCloud },
      { id: 'uploadCompleted' as const, icon: CheckCircle2 },
    ]).map((item) => ({
      ...item,
      label: text.filters[item.id],
      count: item.id === 'all' ? jobs.length : jobs.filter((job) => matchesFilter(job, item.id)).length,
    })),
    [jobs, text],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">{text.title}</h1>
          <p className="text-surface-600 dark:text-surface-400">{text.description}</p>
        </div>
        <LocaleLink href="/dubbing">
          <Button><Plus className="h-4 w-4" /> {text.newJob}</Button>
        </LocaleLink>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(({ id, label, count, icon: Icon }) => {
          const active = filter === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-ring',
                active
                  ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300'
                  : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300 dark:hover:bg-surface-850',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[11px]',
                active
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200'
                  : 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-300',
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <Card>
        <CardTitle>{text.filters[filter]}</CardTitle>

        {isLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {text.loading}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<Layers className="h-10 w-10" />}
            title={text.loadError}
          />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-12 w-12" />}
            title={text.emptyTitle}
            description={text.emptyDescription}
            action={
              <LocaleLink href="/dubbing">
                <Button><Plus className="h-4 w-4" /> {text.newJob}</Button>
              </LocaleLink>
            }
          />
        ) : visibleJobs.length === 0 ? (
          <EmptyState
            icon={<ListFilter className="h-10 w-10" />}
            title={text.noFilterTitle}
            description={text.noFilterDescription}
          />
        ) : (
          <div className="mt-4 space-y-3">
            {visibleJobs.map((job) => {
              const languages = job.languages ? String(job.languages).split(',').filter(Boolean) : []
              const state = getJobState(job)
              const createdAt = new Date(job.created_at)
              const baseStatus = job.status in text.status ? job.status : 'pending'

              return (
                <div
                  key={job.id}
                  className="rounded-lg border border-surface-200 p-4 transition-colors hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-850"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant[baseStatus] ?? 'default'}>
                          {text.status[baseStatus as keyof typeof text.status]}
                        </Badge>
                        {state.hasUploadPending && (
                          <Badge variant="warning">{text.status.uploadPending}</Badge>
                        )}
                        {state.hasUploadCompleted && (
                          <Badge variant="success">{text.status.uploadCompleted}</Badge>
                        )}
                      </div>
                      <h2 className="mt-2 truncate text-base font-semibold text-surface-900 dark:text-white">
                        {job.video_title}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-500 dark:text-surface-400">
                        <span>{formatDuration(Math.round(job.video_duration_ms / 1000))}</span>
                        <span>
                          {text.createdAt}: {Number.isNaN(createdAt.getTime()) ? job.created_at : dateFormatter.format(createdAt)}
                        </span>
                        <span>{text.languages}: {state.languageCount}</span>
                      </div>
                    </div>

                    <div className="w-full shrink-0 space-y-2 lg:w-56">
                      <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
                        <span>{text.progress}</span>
                        <span>{state.progress}%</span>
                      </div>
                      <Progress value={state.progress} size="sm" />
                      <div className="flex flex-wrap gap-1 text-xs text-surface-500 dark:text-surface-400">
                        <span>{text.uploadedCount(state.uploadedCount, state.languageCount)}</span>
                        {state.uploadProcessingCount > 0 && <span>{text.uploadProcessingCount(state.uploadProcessingCount)}</span>}
                        {state.uploadPendingCount > 0 && <span>{text.uploadPendingCount(state.uploadPendingCount)}</span>}
                      </div>
                    </div>
                  </div>

                  {languages.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {languages.slice(0, 8).map((lang) => (
                        <LanguageBadge key={lang} code={lang} />
                      ))}
                      {languages.length > 8 && (
                        <span className="text-xs text-surface-500 dark:text-surface-400">+{languages.length - 8}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
