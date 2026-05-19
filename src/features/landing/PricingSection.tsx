'use client'

import { ArrowRight, Check, Clock, CreditCard } from 'lucide-react'
import { CategoryLabel } from './_shared'
import { CREDIT_PACKS } from '@/features/billing/constants/plans'
import { formatKrw } from '@/utils/formatters'
import { SUPPORTED_LANGUAGE_COUNT } from '@/utils/languages'
import { useLocaleText } from '@/hooks/useLocaleText'
import { useLandingAuthRedirect } from './useLandingAuthRedirect'

const INCLUDED_FEATURES = [
  'features.landing.pricingSection.includedLanguageCount',
  'features.landing.pricingSection.included1080pOutput',
  'features.landing.pricingSection.includedNoWatermark',
  'features.landing.pricingSection.includedYouTubeUploadSupport',
  'features.landing.pricingSection.includedPurchasedMinutesDoNotExpire',
] as const

export function PricingSection() {
  const t = useLocaleText()
  const { authLoading, navigateWithAuth, signingIn } = useLandingAuthRedirect()

  return (
    <section id="pricing" className="bg-paper-100/70 py-20 dark:bg-paper-900/50 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-10">
          <CategoryLabel kr="충전 시간" en="Minutes" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-paper-200 bg-paper-50 shadow-[0_1px_0_rgba(20,19,15,0.03),0_24px_60px_-30px_rgba(20,19,15,0.18)] dark:border-paper-800 dark:bg-paper-900 dark:shadow-[0_1px_0_rgba(0,0,0,0.3),0_24px_60px_-30px_rgba(0,0,0,0.7)]">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            {/* LEFT — dark editorial column */}
            <div className="flex flex-col justify-between gap-10 border-b border-paper-200 bg-ink-900 p-8 text-paper-50 dark:border-paper-800 dark:bg-paper-950 lg:border-b-0 lg:border-r lg:p-10">
              <div>
                <div className="mb-8 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-paper-50/15 bg-paper-50/10 text-clay-300 dark:border-paper-50/10 dark:text-clay-400">
                  <Clock className="h-[18px] w-[18px]" />
                </div>
                <h2 className="display-tight max-w-[16ch] break-keep text-[30px] font-semibold leading-[1.1] sm:text-[36px] lg:text-[40px]">
                  {t('features.landing.pricingSection.addOnlyTheDubbingMinutesYouNeed')}
                </h2>
                <p className="mt-5 max-w-md break-keep text-[14.5px] leading-[1.65] text-paper-50/70">
                  {t('features.landing.pricingSection.noSubscriptionRequiredPurchasedMinutesAreUsedIn')}
                </p>
              </div>

              <div className="rounded-xl border border-paper-50/10 bg-paper-50/[0.04] p-5">
                <h3 className="label-mono mb-4 text-paper-50/70">
                  {t('features.landing.pricingSection.includedWithEveryPack')}
                </h3>
                <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {INCLUDED_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[13px] leading-[1.5] text-paper-50/85">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clay-300 dark:text-clay-400" />
                      <span className="break-keep">{t(feature, { SUPPORTED_LANGUAGE_COUNT })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* RIGHT — pack cards */}
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="grid gap-3 sm:grid-cols-2">
                {CREDIT_PACKS.map((pack, i) => (
                  <div
                    key={pack.minutes}
                    className="group relative flex flex-col justify-between rounded-xl border border-paper-200 bg-paper-50 p-5 shadow-[0_1px_0_rgba(20,19,15,0.03)] transition-colors hover:border-ink-900 dark:border-paper-800 dark:bg-paper-900 dark:hover:border-paper-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-paper-200 bg-paper-100 text-ink-700 transition-colors group-hover:border-clay-500 group-hover:bg-clay-500 group-hover:text-paper-50 dark:border-paper-800 dark:bg-paper-800 dark:text-ink-100 dark:group-hover:border-clay-400 dark:group-hover:bg-clay-400 dark:group-hover:text-paper-950">
                        <CreditCard className="h-[15px] w-[15px]" />
                      </div>
                      <span className="font-mono text-[10.5px] tracking-wider text-ink-300 dark:text-ink-300">
                        Pack · 0{i + 1}
                      </span>
                    </div>
                    <div className="mt-8">
                      <p className="display-tight whitespace-nowrap text-[28px] font-medium leading-none text-ink-900 dark:text-ink-50">
                        {t('common.minutes.value', { count: pack.minutes })}
                      </p>
                      <p className="mt-3 font-mono text-[20px] font-semibold tabular-nums text-clay-500 dark:text-clay-400">
                        {formatKrw(pack.priceKrw)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={authLoading || signingIn}
                onClick={() => void navigateWithAuth('/billing')}
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink-900 text-[14px] font-medium text-paper-50 transition-colors hover:bg-clay-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-paper-50 dark:text-ink-900 dark:hover:bg-clay-400 dark:hover:text-paper-50"
              >
                {signingIn ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                ) : null}
                {t('features.landing.pricingSection.chooseAMinutesPack')}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
