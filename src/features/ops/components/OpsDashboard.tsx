'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Languages,
  RefreshCw,
  UploadCloud,
  Webhook,
} from 'lucide-react'
import { Badge, Button, Card, CardTitle, Select } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/utils/cn'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'
import type { AppLocale } from '@/lib/i18n/config'

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical'

interface OpsAlert {
  id: string
  severity: AlertSeverity
  title: string
  message: string
  metric: string
  value: number
}

interface OperationalEvent {
  id: number
  category: 'upload_queue' | 'perso' | 'credit' | 'toss'
  eventType: string
  severity: AlertSeverity
  userId: string | null
  referenceType: string | null
  referenceId: string | null
  message: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface OpsSummary {
  generatedAt: string
  windowHours: number
  metrics: {
    uploadQueue: {
      total: number
      done: number
      pending: number
      processing: number
      failed: number
      terminalFailed: number
      failureRate: number
    }
    perso: {
      total: number
      completed: number
      failed: number
      canceled: number
      failureRate: number
    }
    creditRefunds: {
      events: number
      releasedMinutes: number
    }
    toss: {
      failureEvents: number
      affectedOrders: number
    }
  }
  alerts: OpsAlert[]
  recentEvents: OperationalEvent[]
}

const severityTone: Record<AlertSeverity, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200',
  critical:
    'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100',
}

const categoryLabel: Record<OperationalEvent['category'], string> = {
  upload_queue: 'ops.category.uploadQueue',
  perso: 'ops.category.perso',
  credit: 'ops.category.credit',
  toss: 'ops.category.toss',
}

const severityLabel: Record<AlertSeverity, string> = {
  info: 'ops.severity.info',
  warning: 'ops.severity.warning',
  error: 'ops.severity.error',
  critical: 'ops.severity.critical',
}

const eventMessageLabel: Record<string, string> = {
  'Perso language processing failed': 'ops.event.persoLanguageProcessingFailed',
  'Dubbing job failed': 'ops.event.dubbingJobFailed',
  'Toss webhook body validation failed': 'ops.event.tossWebhookBodyValidationFailed',
  'Toss webhook payment verification failed': 'ops.event.tossWebhookPaymentVerificationFailed',
  'Toss webhook processing failed': 'ops.event.tossWebhookProcessingFailed',
  'Reserved credits were released': 'ops.event.reservedCreditsWereReleased',
  'Unused reserved credits were released after finalization': 'ops.event.unusedReservedCreditsWereReleasedAfterFinalization',
  'YouTube upload queue item failed': 'ops.event.youTubeUploadQueueItemFailed',
}

function formatDate(value: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function fetchOpsSummary(hours: number): Promise<OpsSummary> {
  const res = await fetch(`/api/ops/summary?hours=${hours}`, { cache: 'no-store' })
  const body = await res.json().catch(() => null)

  if (!res.ok || !body?.ok) {
    throw new Error(body?.error?.message || 'Unable to load operations summary')
  }

  return body.data as OpsSummary
}

function severityVariant(severity: AlertSeverity) {
  if (severity === 'critical' || severity === 'error') return 'error'
  if (severity === 'warning') return 'warning'
  return 'info'
}

export function OpsDashboard() {
  const [hours, setHours] = useState(24)
  const locale = useAppLocale()
  const t = useLocaleText()
  const windowOptions = [
    { value: '6', label: t('features.ops.components.opsDashboard.last6Hours') },
    { value: '24', label: t('features.ops.components.opsDashboard.last24Hours') },
    { value: '72', label: t('features.ops.components.opsDashboard.last3Days') },
    { value: '168', label: t('features.ops.components.opsDashboard.last7Days') },
  ]
  const query = useQuery({
    queryKey: ['ops-summary', hours],
    queryFn: () => fetchOpsSummary(hours),
    retry: false,
    refetchInterval: 60_000,
  })

  const summary = query.data
  const generatedLabel = summary?.generatedAt ? new Date(summary.generatedAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US') : null

  if (query.isError) {
    return (
      <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/10">
        <CardTitle>{t('features.ops.components.opsDashboard.operationsAccessUnavailable')}</CardTitle>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          {t('features.ops.components.opsDashboard.adminPermissionIsRequiredOrOperationsDataCould')}
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('features.ops.components.opsDashboard.operations')}
        description={(
          <>
            {t('features.ops.components.opsDashboard.monitorUploadQueueDubbingJobsMinuteReleasesAnd')}
            {generatedLabel && (
              <span className="mt-1 block text-xs">
                {t('features.ops.components.opsDashboard.lastUpdated')}: {generatedLabel}
              </span>
            )}
          </>
        )}
        actions={(
          <div className="flex items-end gap-2">
          <Select
            label={t('features.ops.components.opsDashboard.window')}
            value={String(hours)}
            onChange={(event) => setHours(Number(event.target.value))}
            options={windowOptions}
            className="min-w-36"
          />
          <Button variant="outline" onClick={() => query.refetch()} loading={query.isFetching}>
            <RefreshCw className="h-4 w-4" />
            {t('features.ops.components.opsDashboard.refresh')}
          </Button>
          </div>
        )}
      />

      {summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<UploadCloud className="h-5 w-5" />}
              title={t('features.ops.components.opsDashboard.uploadFailureRate')}
              value={`${summary.metrics.uploadQueue.failureRate}%`}
              detail={t('ops.metric.uploadQueueDetail', {
                total: summary.metrics.uploadQueue.total,
                failed: summary.metrics.uploadQueue.failed,
                terminalFailed: summary.metrics.uploadQueue.terminalFailed,
              })}
              tone={summary.metrics.uploadQueue.failureRate >= 10 ? 'danger' : 'normal'}
            />
            <MetricCard
              icon={<Languages className="h-5 w-5" />}
              title={t('features.ops.components.opsDashboard.dubbingFailureRate')}
              value={`${summary.metrics.perso.failureRate}%`}
              detail={t('ops.metric.persoDetail', {
                total: summary.metrics.perso.total,
                failed: summary.metrics.perso.failed,
                canceled: summary.metrics.perso.canceled,
              })}
              tone={summary.metrics.perso.failureRate >= 10 ? 'danger' : 'normal'}
            />
            <MetricCard
              icon={<CreditCard className="h-5 w-5" />}
              title={t('features.ops.components.opsDashboard.minuteReleaseEvents')}
              value={`${summary.metrics.creditRefunds.events}`}
              detail={t('ops.metric.creditRefundDetail', {
                releasedMinutes: summary.metrics.creditRefunds.releasedMinutes,
              })}
              tone={summary.metrics.creditRefunds.events > 0 ? 'warn' : 'normal'}
            />
            <MetricCard
              icon={<Webhook className="h-5 w-5" />}
              title={t('features.ops.components.opsDashboard.paymentWebhookFailures')}
              value={`${summary.metrics.toss.failureEvents}`}
              detail={t('ops.metric.tossDetail', {
                affectedOrders: summary.metrics.toss.affectedOrders,
              })}
              tone={summary.metrics.toss.failureEvents > 0 ? 'danger' : 'normal'}
            />
          </div>

          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <CardTitle>{t('features.ops.components.opsDashboard.alerts')}</CardTitle>
                <p className="mt-1 text-sm text-ink-500 dark:text-ink-200">
                  {t('features.ops.components.opsDashboard.thresholdAlertsForTheSelectedWindow')}
                </p>
              </div>
              <Badge variant={summary.alerts.length > 0 ? 'error' : 'success'}>
                {summary.alerts.length > 0
                  ? t('features.ops.components.opsDashboard.valueActive', { summaryAlertsLength: summary.alerts.length })
                  : t('features.ops.components.opsDashboard.healthy')}
              </Badge>
            </div>
            {summary.alerts.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-paper-100 p-4 text-sm text-ink-500 dark:bg-paper-800/60 dark:text-ink-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {t('features.ops.components.opsDashboard.noActiveOperationsAlertsForThisWindow')}
              </div>
            ) : (
              <div className="space-y-2">
                {summary.alerts.map((alert) => (
                  <div key={alert.id} className={cn('rounded-lg border p-3', severityTone[alert.severity])}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{alert.title}</p>
                        <p className="mt-0.5 text-xs opacity-80">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>{t('features.ops.components.opsDashboard.recentEvents')}</CardTitle>
            <div className="mt-4 overflow-hidden rounded-lg border border-paper-200 dark:border-paper-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-paper-100 text-xs text-ink-500 dark:bg-paper-800 dark:text-ink-200">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('features.ops.components.opsDashboard.time')}</th>
                      <th className="px-3 py-2 font-medium">{t('features.ops.components.opsDashboard.category')}</th>
                      <th className="px-3 py-2 font-medium">{t('features.ops.components.opsDashboard.severity')}</th>
                      <th className="px-3 py-2 font-medium">{t('features.ops.components.opsDashboard.message')}</th>
                      <th className="px-3 py-2 font-medium">{t('features.ops.components.opsDashboard.reference')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-200 dark:divide-paper-800">
                    {summary.recentEvents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-ink-500 dark:text-ink-200">
                          {t('features.ops.components.opsDashboard.noRecentOperationalEvents')}
                        </td>
                      </tr>
                    ) : (
                      summary.recentEvents.map((event) => (
                        <tr key={event.id} className="text-ink-600 dark:text-ink-100">
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-500 dark:text-ink-200">
                            {formatDate(event.createdAt, locale)}
                          </td>
                          <td className="px-3 py-2">{t(categoryLabel[event.category])}</td>
                          <td className="px-3 py-2">
                            <Badge variant={severityVariant(event.severity)}>{t(severityLabel[event.severity])}</Badge>
                          </td>
                          <td className="px-3 py-2">{eventMessageLabel[event.message] ? t(eventMessageLabel[event.message]) : event.message}</td>
                          <td className="px-3 py-2 text-xs text-ink-500 dark:text-ink-200">
                            {event.referenceType && event.referenceId
                              ? `${event.referenceType}:${event.referenceId}`
                              : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-200">
            <Clock className="h-4 w-4 animate-pulse" />
            {t('features.ops.components.opsDashboard.loadingOperationsSummary')}
          </div>
        </Card>
      )}
    </div>
  )
}

function MetricCard({
  icon,
  title,
  value,
  detail,
  tone,
}: {
  icon: ReactNode
  title: string
  value: string
  detail: string
  tone: 'normal' | 'warn' | 'danger'
}) {
  return (
    <Card
      className={cn(
        tone === 'danger' && 'border-red-200 dark:border-red-900',
        tone === 'warn' && 'border-amber-200 dark:border-amber-900',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500 dark:text-ink-200">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900 dark:text-ink-50">{value}</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-200">{detail}</p>
        </div>
        <div
          className={cn(
            'rounded-lg p-2',
            tone === 'danger'
              ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300'
              : tone === 'warn'
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300'
                : 'bg-paper-100 text-ink-500 dark:bg-paper-800 dark:text-ink-200',
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}
