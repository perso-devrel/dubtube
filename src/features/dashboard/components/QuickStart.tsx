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
    <Card className="border-clay-200 dark:border-clay-800/70">
      <CardTitle>{t('features.dashboard.components.quickStart.quickStart')}</CardTitle>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {actions.map(({ source, label, description, icon: Icon }) => (
          <button
            key={source}
            type="button"
            onClick={() => router.push(`/dubbing?source=${source}`)}
            className="group flex min-h-24 flex-col rounded-lg border border-paper-200 bg-paper-50 p-3 text-left transition-colors hover:border-clay-300 hover:bg-clay-50/70 focus-ring dark:border-paper-800 dark:bg-paper-900 dark:hover:border-clay-800 dark:hover:bg-clay-800/20"
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-paper-100 text-ink-500 transition-colors group-hover:bg-clay-100 group-hover:text-clay-700 dark:bg-paper-800 dark:text-ink-200 dark:group-hover:bg-clay-800/40 dark:group-hover:text-clay-200">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{label}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-paper-400 transition-colors group-hover:text-clay-500" />
            </span>
            <span className="mt-3 block text-xs leading-5 text-ink-500 dark:text-ink-200">{description}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}
