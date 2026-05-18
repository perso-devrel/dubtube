import { LocaleLink } from '@/components/i18n/LocaleLink'
import { XCircle } from 'lucide-react'
import { Button, Card, CardTitle } from '@/components/ui'
import { resolveAppLocale } from '@/lib/i18n/config'
import { message } from '@/lib/i18n/messages'

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default async function BillingFailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [routeParams, queryParams] = await Promise.all([params, searchParams])
  const locale = resolveAppLocale(routeParams.locale)
  const code = getParam(queryParams.code)

  return (
    <div className="mx-auto max-w-xl">
      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="border-b border-red-100 bg-red-50 p-6 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-red-100 bg-white dark:border-red-900/40 dark:bg-surface-950">
            <XCircle className="h-6 w-6 text-red-500" />
          </div>
          <CardTitle>{message(locale, 'app.app.billing.fail.page.paymentNotCompleted')}</CardTitle>
          <p className="mt-2 break-keep text-sm leading-6 text-surface-600 dark:text-surface-300">
            {message(locale, 'app.app.billing.fail.page.paymentCanceledOrFailed')}
          </p>
          {code && (
            <p className="mt-2 text-xs text-surface-500 dark:text-surface-400">
              {message(locale, 'app.app.billing.fail.page.supportErrorCode', { code })}
            </p>
          )}
        </div>

        <div className="p-6">
          <div className="mb-5 h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
            <div className="h-full w-full rounded-full bg-red-500" />
          </div>
          <LocaleLink href="/billing">
            <Button className="w-full rounded-xl">{message(locale, 'app.app.billing.fail.page.tryAgain')}</Button>
          </LocaleLink>
        </div>
      </Card>
    </div>
  )
}
