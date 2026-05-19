'use client'

import { Mic, Subtitles, Clock, BarChart3 } from 'lucide-react'
import { CategoryLabel } from './_shared'
import { useLocaleText } from '@/hooks/useLocaleText'

const features = [
  {
    icon: Mic,
    title: 'features.landing.featureShowcase.titleDubsCloseToTheOriginalTone',
    description: 'features.landing.featureShowcase.descriptionGenerateDubsThatPreserveTheFeelOf',
    tagKey: 'features.landing.featureShowcase.tagVoice',
  },
  {
    icon: Subtitles,
    title: 'features.landing.featureShowcase.titleLocalizedTitlesAndDescriptions',
    description: 'features.landing.featureShowcase.descriptionPrepareYouTubeTitlesDescriptionsAndCaptionsFor',
    tagKey: 'features.landing.featureShowcase.tagMetadata',
  },
  {
    icon: Clock,
    title: 'features.landing.featureShowcase.titleManageCompletedFiles',
    description: 'features.landing.featureShowcase.descriptionTrackProgressAndOpenCompletedFilesFrom',
    tagKey: 'features.landing.featureShowcase.tagQueue',
  },
  {
    icon: BarChart3,
    title: 'features.landing.featureShowcase.titlePerformanceByLanguage',
    description: 'features.landing.featureShowcase.descriptionReviewHowEachUploadedDubPerformsAnd',
    tagKey: 'features.landing.featureShowcase.tagAnalytics',
  },
]

export function FeatureShowcase() {
  const t = useLocaleText()

  return (
    <section id="features" className="bg-paper-100/70 py-20 dark:bg-paper-900/50 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div>
          <CategoryLabel kr="기능" en="Capabilities" />
          <h2 className="display-tight mt-3 break-keep text-[32px] font-semibold leading-[1.08] text-ink-900 dark:text-ink-50 sm:text-[40px] lg:whitespace-nowrap lg:text-[44px]">
            {t('features.landing.featureShowcase.oneWorkflowFromDubbingToPublishing')}
          </h2>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, description, tagKey }) => (
            <article
              key={title}
              className="group relative flex min-h-[240px] flex-col rounded-xl border border-paper-200 bg-paper-50 p-6 shadow-[0_1px_0_rgba(20,19,15,0.03)] transition-colors hover:border-ink-900 dark:border-paper-800 dark:bg-paper-900 dark:shadow-[0_1px_0_rgba(0,0,0,0.25)] dark:hover:border-paper-200"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-paper-200 bg-paper-100 text-ink-700 transition-colors group-hover:border-clay-500 group-hover:bg-clay-500 group-hover:text-paper-50 dark:border-paper-800 dark:bg-paper-800 dark:text-ink-100 dark:group-hover:border-clay-400 dark:group-hover:bg-clay-400 dark:group-hover:text-paper-950">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-300 dark:text-ink-300">
                  {t(tagKey)}
                </span>
              </div>

              <h3 className="display-tight mt-8 break-keep text-[19px] font-medium leading-tight text-ink-900 dark:text-ink-50">
                {t(title)}
              </h3>
              <p className="mt-2.5 break-keep text-[13.5px] leading-[1.6] text-ink-500 dark:text-ink-200">
                {t(description)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
