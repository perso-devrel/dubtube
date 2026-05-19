'use client'

import { FileVideo, Languages, FileText, Upload } from 'lucide-react'
import { SectionHeading } from './_shared'
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
    <section id="how-it-works" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          kr="작동 방식"
          en="Process"
          title={t('features.landing.howItWorks.startMultilingualDubbingInFourSteps')}
        />

        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, step, title, description }, i) => (
            <li
              key={step}
              className="group relative flex min-h-[240px] flex-col rounded-xl border border-paper-200 bg-paper-50 p-6 shadow-[0_1px_0_rgba(20,19,15,0.03)] transition-colors hover:border-ink-900 dark:border-paper-800 dark:bg-paper-900 dark:shadow-[0_1px_0_rgba(0,0,0,0.2)] dark:hover:border-paper-200"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-paper-200 bg-paper-100 text-ink-700 transition-colors group-hover:border-clay-500 group-hover:bg-clay-500 group-hover:text-paper-50 dark:border-paper-800 dark:bg-paper-800 dark:text-ink-100 dark:group-hover:border-clay-400 dark:group-hover:bg-clay-400 dark:group-hover:text-paper-950">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="font-mono text-[11px] tracking-wider text-ink-300 dark:text-ink-300">
                  {step}
                  {i < steps.length - 1 ? <span className="ml-1.5 text-ink-300/60 dark:text-ink-300/60">→</span> : null}
                </span>
              </div>

              <h3 className="display-tight mt-8 break-keep text-[19px] font-medium leading-tight text-ink-900 dark:text-ink-50">
                {t(title)}
              </h3>
              <p className="mt-2.5 break-keep text-[13.5px] leading-[1.6] text-ink-500 dark:text-ink-200">
                {t(description)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
