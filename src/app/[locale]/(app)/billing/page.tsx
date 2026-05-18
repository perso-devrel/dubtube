'use client'

import { useState } from 'react'
import { CreditCard, Coins, ArrowRight, Loader2, Check } from 'lucide-react'
import { Card, CardTitle, Button } from '@/components/ui'
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-white">{t('app.app.billing.page.addDubbingMinutes')}</h1>
          <p className="mt-1 text-surface-600 dark:text-surface-400">{t('app.app.billing.page.addDubbingMinutesAndReviewPaymentHistory')}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="overflow-hidden border-surface-800 bg-surface-950 p-0 text-white dark:border-surface-800">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                <Coins className="h-6 w-6 text-brand-300" />
              </div>
              <p className="max-w-40 text-right text-sm leading-6 text-white/55">{t('app.app.billing.page.paymentsAreProcessedInKRW')}</p>
            </div>

            <div className="mt-10">
              <p className="text-sm text-white/60">{t('app.app.billing.page.remainingDubbingTime')}</p>
              {isLoading ? (
                <Loader2 className="mt-3 h-7 w-7 animate-spin text-white/40" />
              ) : (
                <p className="mt-2 text-5xl font-semibold tracking-normal text-white">
                  {t('common.minutes.value', { count: minutesRemaining ?? 0 })}
                </p>
              )}
            </div>

            <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.min(100, ((minutesRemaining ?? 0) / 120) * 100)}%` }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b border-surface-200 p-6 dark:border-surface-800">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <CardTitle>{t('app.app.billing.page.chooseAMinutesPack')}</CardTitle>
            </div>
            <p className="mt-2 text-sm text-surface-500 dark:text-surface-400">
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
                      'relative overflow-hidden rounded-2xl border p-5 text-left transition-all cursor-pointer focus-ring',
                      isSelected
                        ? 'border-brand-500 bg-brand-50 shadow-sm shadow-brand-900/5 dark:border-brand-500 dark:bg-brand-900/20'
                        : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50 dark:border-surface-800 dark:bg-surface-950 dark:hover:border-surface-700 dark:hover:bg-surface-900',
                    )}
                  >
                    <div className="mb-6 flex items-start justify-between gap-3">
                      <div>
                        <p className="whitespace-nowrap text-3xl font-semibold text-surface-900 dark:text-white">
                          {t('common.minutes.value', { count: pack.minutes })}
                        </p>
                        {pack.labelKey && <p className="mt-1 min-h-5 text-xs text-surface-600 dark:text-surface-300">{t(pack.labelKey)}</p>}
                      </div>
                      <span className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                        isSelected
                          ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-400 dark:text-surface-950'
                          : 'border-surface-200 bg-white text-transparent dark:border-surface-700 dark:bg-surface-900',
                      )}>
                        <Check className="h-4 w-4" />
                      </span>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <p className="whitespace-nowrap text-xl font-semibold text-surface-900 dark:text-white">
                        {formatKrw(pack.priceKrw)}
                      </p>
                      <p className="whitespace-nowrap text-xs font-medium text-surface-500 dark:text-surface-400">
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
              <Button className="mt-5 h-12 w-full rounded-xl" onClick={handleCharge} disabled={isCharging || charged}>
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
      <Card className="rounded-2xl">
        <CardTitle>{t('app.app.billing.page.paymentHistory')}</CardTitle>
        <div className="mt-4 py-8 text-center text-sm text-surface-500 dark:text-surface-400">
          {t('app.app.billing.page.noPaymentHistoryYet')}
        </div>
      </Card>
    </div>
  )
}
