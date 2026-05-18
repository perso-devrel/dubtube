'use client'

import { useEffect, useState } from 'react'
import { LocaleLink } from '@/components/i18n/LocaleLink'
import { Check, Loader2, XCircle } from 'lucide-react'
import { Button, Card, CardTitle } from '@/components/ui'
import { useLocaleText } from '@/hooks/useLocaleText'

interface Props {
  paymentKey: string | null
  orderId: string | null
  amount: string | null
}

type Status = 'confirming' | 'done' | 'error'

export function BillingSuccessClient({ paymentKey, orderId, amount }: Props) {
  const t = useLocaleText()
  const hasRequiredParams = Boolean(paymentKey && orderId && amount)
  const [status, setStatus] = useState<Status>(hasRequiredParams ? 'confirming' : 'error')
  const [message, setMessage] = useState(
    hasRequiredParams
      ? t('app.app.billing.success.billingSuccessClient.confirmingPaymentAndAddingDubbingMinutes')
      : t('app.app.billing.success.billingSuccessClient.requiredPaymentConfirmationValuesAreMissing'),
  )

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) return

    let cancelled = false
    async function confirm() {
      try {
        const res = await fetch('/api/billing/toss/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentKey, orderId, amount }),
          cache: 'no-store',
        })
        const body = await res.json().catch(() => null)
        if (!body?.ok) {
          throw new Error(body?.error?.message || t('app.app.billing.success.billingSuccessClient.paymentConfirmationFailedFallback'))
        }
        if (!cancelled) {
          setStatus('done')
          setMessage(t('app.app.billing.success.billingSuccessClient.valueMinutesWereAdded', { bodyDataMinutes: body.data.minutes }))
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setMessage(err instanceof Error ? err.message : t('app.app.billing.success.billingSuccessClient.paymentConfirmationFailed'))
        }
      }
    }

    confirm()
    return () => {
      cancelled = true
    }
  }, [paymentKey, orderId, amount, t])

  return (
    <div className="mx-auto max-w-xl">
      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="border-b border-surface-200 bg-surface-50 p-6 dark:border-surface-800 dark:bg-surface-950">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            {status === 'confirming' ? (
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            ) : status === 'done' ? (
              <Check className="h-6 w-6 text-emerald-500" />
            ) : (
              <XCircle className="h-6 w-6 text-red-500" />
            )}
          </div>
          <CardTitle>
            {status === 'done'
              ? t('app.app.billing.success.billingSuccessClient.minutesAdded')
              : status === 'error'
                ? t('app.app.billing.success.billingSuccessClient.paymentConfirmationFailed2')
                : t('app.app.billing.success.billingSuccessClient.confirmingPayment')}
          </CardTitle>
          <p className="mt-2 break-keep text-sm leading-6 text-surface-600 dark:text-surface-300">{message}</p>
        </div>

        <div className="p-6">
          <div className="mb-5 h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
            <div
              className={`h-full rounded-full ${
                status === 'done'
                  ? 'bg-emerald-500'
                  : status === 'error'
                    ? 'bg-red-500'
                    : 'bg-brand-600'
              }`}
              style={{ width: status === 'confirming' ? '62%' : '100%' }}
            />
          </div>
          <LocaleLink href="/billing">
            <Button className="w-full rounded-xl">{t('app.app.billing.success.billingSuccessClient.backToBilling')}</Button>
          </LocaleLink>
        </div>
      </Card>
    </div>
  )
}
