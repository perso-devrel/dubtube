'use client'

import { ArrowRight, Film, Link2, Upload } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui'
import { useLocaleText } from '@/hooks/useLocaleText'
import { useLocaleRouter } from '@/hooks/useLocalePath'

export function QuickStart() {
  const t = useLocaleText()
  const router = useLocaleRouter()
  const actions = [
    {
      source: 'upload',
      label: t('features.dashboard.components.quickStart.uploadVideo'),
      description: t('features.dashboard.components.quickStart.uploadVideoDescription'),
      icon: Upload,
    },
    {
      source: 'channel',
      label: t('features.dashboard.components.quickStart.myYouTubeVideos'),
      description: t('features.dashboard.components.quickStart.myYouTubeVideosDescription'),
      icon: Film,
    },
    {
      source: 'url',
      label: t('features.dashboard.components.quickStart.importByLink'),
      description: t('features.dashboard.components.quickStart.importByLinkDescription'),
      icon: Link2,
    },
  ] as const

  return (
    <Card className="border-brand-200 dark:border-brand-900/60">
      <CardTitle>{t('features.dashboard.components.quickStart.quickStart')}</CardTitle>
      <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">
        {t('features.dashboard.components.quickStart.startWithSourceType')}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {actions.map(({ source, label, description, icon: Icon }) => (
          <button
            key={source}
            type="button"
            onClick={() => router.push(`/dubbing?source=${source}`)}
            className="group flex min-h-24 flex-col rounded-lg border border-surface-200 bg-white p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 focus-ring dark:border-surface-800 dark:bg-surface-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/30"
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-100 text-surface-600 transition-colors group-hover:bg-brand-100 group-hover:text-brand-700 dark:bg-surface-800 dark:text-surface-300 dark:group-hover:bg-brand-900/40 dark:group-hover:text-brand-300">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate text-sm font-semibold text-surface-900 dark:text-white">{label}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-surface-300 transition-colors group-hover:text-brand-500" />
            </span>
            <span className="mt-3 block text-xs leading-5 text-surface-500 dark:text-surface-400">{description}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}
