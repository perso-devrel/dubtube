'use client'

import { FileText, FileVideo, Languages, Upload } from 'lucide-react'
import { useLocaleText } from '@/hooks/useLocaleText'

const steps = [
  {
    icon: FileVideo,
    step: '01',
    title: 'features.landing.howItWorks.titleAddVideo',
    description: 'features.landing.howItWorks.descriptionPasteAYouTubeLinkOrUploadA',
  },
  {
    icon: Languages,
    step: '02',
    title: 'features.landing.howItWorks.titleChooseLanguages',
    description: 'features.landing.howItWorks.descriptionChooseTargetLanguagesAndReviewTitleAnd',
  },
  {
    icon: FileText,
    step: '03',
    title: 'features.landing.howItWorks.titleReviewAndEdit',
    description: 'features.landing.howItWorks.descriptionReviewEachDubCaptionTitleAndDescription',
  },
  {
    icon: Upload,
    step: '04',
    title: 'features.landing.howItWorks.titlePublishToYouTube',
    description: 'features.landing.howItWorks.descriptionDownloadFilesOrContinueDirectlyToYouTube',
  },
]

export function HowItWorks() {
  const t = useLocaleText()

  return (
    <section id="how-it-works" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <h2 className="max-w-xl break-keep text-3xl font-semibold leading-tight text-surface-900 dark:text-white sm:text-4xl">
              {t('features.landing.howItWorks.startMultilingualDubbingInFourSteps')}
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-surface-600 dark:text-surface-300 lg:justify-self-end">
            {t('features.landing.howItWorks.moveFromVideoSelectionToYouTubeUploadIn')}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, step, title, description }) => (
            <div
              key={step}
              className="group relative min-h-64 rounded-2xl border border-surface-200 bg-white p-6 shadow-[0_1px_0_rgba(15,17,21,0.03)] transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_50px_rgba(15,17,21,0.08)] dark:border-surface-800 dark:bg-surface-900 dark:hover:border-brand-800 dark:hover:shadow-black/20"
            >
              <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-lg border border-surface-200 bg-surface-50 text-brand-600 transition-colors group-hover:border-brand-200 group-hover:bg-brand-50 dark:border-surface-800 dark:bg-surface-850 dark:text-brand-400 dark:group-hover:border-brand-800 dark:group-hover:bg-brand-900/20">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="break-keep text-lg font-semibold text-surface-900 dark:text-white">{t(title)}</h3>
              <p className="mt-3 break-keep text-sm leading-6 text-surface-600 dark:text-surface-300">{t(description)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
