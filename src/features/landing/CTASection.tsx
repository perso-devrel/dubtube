'use client'

import { ArrowRight } from 'lucide-react'
import { useLocaleText } from '@/hooks/useLocaleText'
import { useLandingAuthRedirect } from './useLandingAuthRedirect'

export function CTASection() {
  const t = useLocaleText()
  const { authLoading, navigateWithAuth, signingIn } = useLandingAuthRedirect()

  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="overflow-hidden rounded-2xl border border-ink-900 bg-ink-900 px-8 py-14 text-paper-50 shadow-[0_20px_60px_-20px_rgba(20,19,15,0.4)] dark:border-paper-700 dark:bg-paper-950 sm:px-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <h2 className="display-tight max-w-[18ch] whitespace-pre-line break-keep text-[34px] font-semibold leading-[1.06] sm:text-[44px] lg:text-[52px]">
                {t('features.landing.cTASection.prepareYourNextVideoInMoreLanguages')}
              </h2>
              <p className="mt-5 max-w-xl break-keep text-[15px] leading-[1.65] text-paper-50/75">
                {t('features.landing.cTASection.reviewTheDubbedResultsPrepareCaptionsTitlesAnd')}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch lg:gap-3">
              <button
                type="button"
                disabled={authLoading || signingIn}
                onClick={() => void navigateWithAuth('/dashboard')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-paper-50 px-6 text-[14px] font-medium text-ink-900 transition-colors hover:bg-clay-500 hover:text-paper-50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-paper-50 dark:text-ink-900 dark:hover:bg-clay-400 dark:hover:text-paper-50"
              >
                {signingIn ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                ) : null}
                {t('features.landing.cTASection.startANewDub')}
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#pricing"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-paper-50/20 px-6 text-[14px] font-medium text-paper-50 transition-colors hover:border-paper-50/60 hover:bg-paper-50/5"
              >
                {t('features.landing.cTASection.viewPricing')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
