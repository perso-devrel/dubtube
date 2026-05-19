'use client'

import { useState } from 'react'
import { CreditCard, Coins, ArrowRight, Loader2, Check } from 'lucide-react'
import { Card, CardTitle, Button } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/utils/cn'
import { CREDIT_PACKS } from '@/features/billing/constants/plans'
import { formatKrw } from '@/utils/formatters'
import { useDashboardSummary } from '@/hooks/useDashboardData'
import { useLocaleText } from '@/hooks/useLocaleText'

export default function BillingPage() {
  const t = useLocaleText()
  const [selectedPack, setSelectedPack] = useState<number | null>(null)
  const [isCharging, setIsCharging] = useState(false)
  const [charged, setCharged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: summary, isLoading } = useDashboardSummary()

  const handleCharge = async () => {
    if (!selectedPack) return
    setIsCharging(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/toss/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: selectedPack }),
        cache: 'no-store',
      })
      const body = await res.json().catch(() => null)
      if (!body?.ok || !body.data?.checkoutUrl) {
        throw new Error(body?.error?.message || t('app.app.billing.page.checkoutCreationFailed'))
      }
      setCharged(true)
      window.location.href = body.data.checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.app.billing.page.checkoutCreationFailed'))
      setCharged(false)
    } finally {
      setIsCharging(false)
    }
  }

  const minutesRemaining = summary ? Number(summary.credits_remaining) : null
  const selectedPackInfo = selectedPack ? CREDIT_PACKS.find((pack) => pack.minutes === selectedPack) : null
  const starterPack = CREDIT_PACKS[0] ?? null
  const previewPack = selectedPackInfo ?? starterPack
  const previewPricePerMinute = previewPack ? Math.round(previewPack.priceKrw / previewPack.minutes) : 0

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('app.app.billing.page.addDubbingMinutes')}
        description={t('app.app.billing.page.addDubbingMinutesAndReviewPaymentHistory')}
      />

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="overflow-hidden border-ink-900 bg-ink-900 p-0 text-paper-50 dark:border-paper-700 dark:bg-paper-900">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="rounded-lg border border-paper-50/10 bg-paper-50/10 p-3">
                <Coins className="h-6 w-6 text-clay-300" />
              </div>
              <p className="max-w-40 text-right text-sm leading-6 text-paper-50/60">{t('app.app.billing.page.paymentsAreProcessedInKRW')}</p>
            </div>

            <div className="mt-10">
              <p className="text-sm text-paper-50/65">{t('app.app.billing.page.remainingDubbingTime')}</p>
              {isLoading ? (
                <Loader2 className="mt-3 h-7 w-7 animate-spin text-paper-50/45" />
              ) : (
                <p className="mt-2 text-5xl font-semibold tracking-normal text-paper-50">
                  {t('common.minutes.value', { count: minutesRemaining ?? 0 })}
                </p>
              )}
            </div>

            <div className="mt-8 h-2 overflow-hidden rounded-full bg-paper-50/10">
              <div
                className="h-full rounded-full bg-clay-400"
                style={{ width: `${Math.min(100, ((minutesRemaining ?? 0) / 120) * 100)}%` }}
              />
            </div>

            <div className="mt-8 rounded-lg border border-paper-50/10 bg-paper-50/5 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-paper-50/50">{t('app.app.billing.page.selectedMinutes')}</p>
                  <p className="mt-1 text-lg font-semibold text-paper-50">
                    {selectedPackInfo
                      ? t('common.minutes.value', { count: selectedPackInfo.minutes })
                      : starterPack
                        ? t('app.app.billing.page.fromMinutes', { minutes: t('common.minutes.value', { count: starterPack.minutes }) })
                        : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-paper-50/50">{t('app.app.billing.page.paymentAmount')}</p>
                  <p className="mt-1 text-lg font-semibold text-paper-50">
                    {selectedPackInfo
                      ? formatKrw(selectedPackInfo.priceKrw)
                      : starterPack
                        ? t('app.app.billing.page.fromAmount', { amount: formatKrw(starterPack.priceKrw) })
                        : '-'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-paper-50/10 pt-4 text-sm">
                <span className="text-paper-50/55">{t('app.app.billing.page.purchasedMinutesDoNotExpire')}</span>
                <span className="whitespace-nowrap font-medium text-clay-200">
                  {previewPack
                    ? t('app.app.billing.page.pricePerMinuteValue', {
                        price: formatKrw(previewPricePerMinute),
                        minute: t('common.minutes.value', { count: 1 }),
                      })
                    : '-'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b border-paper-200 p-6 dark:border-paper-800">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-clay-600 dark:text-clay-300" />
              <CardTitle>{t('app.app.billing.page.chooseAMinutesPack')}</CardTitle>
            </div>
            <p className="mt-2 text-sm text-ink-500 dark:text-ink-200">
              {t('app.app.billing.page.purchasedMinutesDoNotExpire')}
            </p>
          </div>

          <div className="p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {CREDIT_PACKS.map((pack) => {
                const isSelected = selectedPack === pack.minutes

                return (
                  <button
                    key={pack.minutes}
                    type="button"
                    onClick={() => setSelectedPack(pack.minutes)}
                    className={cn(
                      'relative overflow-hidden rounded-lg border p-5 text-left transition-all cursor-pointer focus-ring',
                      isSelected
                        ? 'border-clay-400 bg-clay-50 shadow-sm shadow-clay-900/5 dark:border-clay-600 dark:bg-clay-800/20'
                        : 'border-paper-200 bg-paper-50 hover:border-paper-300 hover:bg-paper-100 dark:border-paper-800 dark:bg-paper-950 dark:hover:border-paper-700 dark:hover:bg-paper-900',
                    )}
                  >
                    <div className="mb-6 flex items-start justify-between gap-3">
                      <div>
                        <p className="whitespace-nowrap text-3xl font-semibold text-ink-900 dark:text-ink-50">
                          {t('common.minutes.value', { count: pack.minutes })}
                        </p>
                        {pack.labelKey && <p className="mt-1 min-h-5 text-xs text-ink-500 dark:text-ink-200">{t(pack.labelKey)}</p>}
                      </div>
                      <span className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                        isSelected
                          ? 'border-clay-500 bg-clay-500 text-paper-50 dark:border-clay-400 dark:bg-clay-400 dark:text-paper-950'
                          : 'border-paper-200 bg-paper-50 text-transparent dark:border-paper-700 dark:bg-paper-900',
                      )}>
                        <Check className="h-4 w-4" />
                      </span>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <p className="whitespace-nowrap text-xl font-semibold text-ink-900 dark:text-ink-50">
                        {formatKrw(pack.priceKrw)}
                      </p>
                      <p className="whitespace-nowrap text-xs font-medium text-ink-500 dark:text-ink-200">
                        {formatKrw(Math.round(pack.priceKrw / pack.minutes))} / {t('common.minutes.value', { count: 1 })}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            {selectedPackInfo && (
              <Button className="mt-5 h-12 w-full" onClick={handleCharge} disabled={isCharging || charged}>
                {isCharging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : charged ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {charged
                  ? t('app.app.billing.page.openingCheckout')
                  : t('app.app.billing.page.addValueMinutes', { selectedPack: selectedPackInfo.minutes })}
                {!isCharging && !charged && <ArrowRight className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardTitle>{t('app.app.billing.page.paymentHistory')}</CardTitle>
        <div className="mt-4 py-8 text-center text-sm text-ink-500 dark:text-ink-200">
          {t('app.app.billing.page.noPaymentHistoryYet')}
        </div>
      </Card>
    </div>
  )
}
