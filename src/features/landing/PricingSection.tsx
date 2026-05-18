'use client'

import { ArrowRight, Check, Clock, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui'
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
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-[0_1px_0_rgba(15,17,21,0.03),0_24px_80px_rgba(15,17,21,0.08)] dark:border-surface-800 dark:bg-surface-900 dark:shadow-black/30">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-between border-b border-surface-200 bg-surface-950 p-8 text-white dark:border-surface-800 lg:border-b-0 lg:border-r">
              <div>
                <div className="mb-8 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                  <Clock className="h-5 w-5" />
                </div>
                <h2 className="max-w-md break-keep text-3xl font-semibold leading-tight sm:text-4xl">
                  {t('features.landing.pricingSection.addOnlyTheDubbingMinutesYouNeed')}
                </h2>
                <p className="mt-5 max-w-md break-keep text-base leading-7 text-white/70">
                  {t('features.landing.pricingSection.noSubscriptionRequiredPurchasedMinutesAreUsedIn')}
                </p>
              </div>

              <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="mb-4 text-sm font-semibold text-white">{t('features.landing.pricingSection.includedWithEveryPack')}</h3>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {INCLUDED_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-white/75">
                      <Check className="h-4 w-4 shrink-0 text-brand-300" />
                      {t(feature, { SUPPORTED_LANGUAGE_COUNT })}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
              <div className="grid gap-3 sm:grid-cols-2">
                {CREDIT_PACKS.map((pack) => (
                  <div
                    key={pack.minutes}
                    className="group relative overflow-hidden rounded-2xl border border-surface-200 bg-white p-5 transition-colors hover:border-brand-300 dark:border-surface-800 dark:bg-surface-950 dark:hover:border-brand-700"
                  >
                    <div className="mb-8 flex items-center justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 bg-surface-50 text-brand-600 dark:border-surface-800 dark:bg-surface-900 dark:text-brand-400">
                        <CreditCard className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="whitespace-nowrap text-3xl font-semibold text-surface-900 dark:text-white">
                      {t('common.minutes.value', { count: pack.minutes })}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <p className="whitespace-nowrap text-2xl font-semibold text-brand-600 dark:text-brand-400">{formatKrw(pack.priceKrw)}</p>
                      <p className="whitespace-nowrap text-xs font-medium text-surface-500 dark:text-surface-400">
                        {formatKrw(Math.round(pack.priceKrw / pack.minutes))} / {t('common.minutes.value', { count: 1 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                className="mt-5 w-full rounded-xl bg-surface-950 hover:bg-surface-800 dark:bg-white dark:text-surface-950 dark:hover:bg-surface-200"
                disabled={authLoading}
                loading={signingIn}
                onClick={() => void navigateWithAuth('/billing')}
              >
                {t('features.landing.pricingSection.chooseAMinutesPack')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
