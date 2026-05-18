'use client'

import { Mic, Subtitles, Clock, BarChart3 } from 'lucide-react'
import { useLocaleText } from '@/hooks/useLocaleText'

const features = [
  {
    icon: Mic,
    title: 'features.landing.featureShowcase.titleDubsCloseToTheOriginalTone',
    description: 'features.landing.featureShowcase.descriptionGenerateDubsThatPreserveTheFeelOf',
  },
  {
    icon: Subtitles,
    title: 'features.landing.featureShowcase.titleLocalizedTitlesAndDescriptions',
    description: 'features.landing.featureShowcase.descriptionPrepareYouTubeTitlesDescriptionsAndCaptionsFor',
  },
  // Lip sync feature is temporarily hidden from the landing page.
  // {
  //   icon: Wand2,
  //   title: '립싱크',
  //   description: '선택적 AI 립싱크로 실사 영상에 최적화. 입 모양이 더빙 오디오와 완벽하게 맞습니다.',
  // },
  {
    icon: Clock,
    title: 'features.landing.featureShowcase.titleManageCompletedFiles',
    description: 'features.landing.featureShowcase.descriptionTrackProgressAndOpenCompletedFilesFrom',
  },
  {
    icon: BarChart3,
    title: 'features.landing.featureShowcase.titlePerformanceByLanguage',
    description: 'features.landing.featureShowcase.descriptionReviewHowEachUploadedDubPerformsAnd',
  },
]

export function FeatureShowcase() {
  const t = useLocaleText()

  return (
    <section id="features" className="border-y border-surface-200/70 bg-surface-50 py-24 dark:border-surface-800 dark:bg-surface-950">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="max-w-xl break-keep text-3xl font-semibold leading-tight text-surface-900 dark:text-white sm:text-4xl">
            {t('features.landing.featureShowcase.oneWorkflowFromDubbingToPublishing')}
          </h2>
          <p className="max-w-2xl text-base leading-7 text-surface-600 dark:text-surface-300">
            {t('features.landing.featureShowcase.organizeDubbingCaptionsTitlesAndDescriptionsInOne')}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group relative min-h-64 rounded-2xl border border-surface-200 bg-white p-6 shadow-[0_1px_0_rgba(15,17,21,0.03)] transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_50px_rgba(15,17,21,0.08)] dark:border-surface-800 dark:bg-surface-900 dark:hover:border-brand-800 dark:hover:shadow-black/20"
            >
              <div className="mb-8 flex items-center justify-between">
                <div className="inline-flex rounded-lg border border-surface-200 bg-white p-3 text-brand-600 transition-colors group-hover:border-brand-200 group-hover:bg-brand-50 dark:border-surface-800 dark:bg-surface-900 dark:text-brand-400 dark:group-hover:border-brand-800 dark:group-hover:bg-brand-900/20">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <h3 className="break-keep text-lg font-semibold leading-7 text-surface-900 dark:text-white">{t(title)}</h3>
              <p className="mt-3 break-keep text-sm leading-6 text-surface-600 dark:text-surface-300">{t(description)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
