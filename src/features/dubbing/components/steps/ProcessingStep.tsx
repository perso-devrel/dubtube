'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { Card, Progress, Badge, Button } from '@/components/ui'
import { cn } from '@/utils/cn'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'
import { getLanguageByCode } from '@/utils/languages'
import { useDubbingStore } from '../../store/dubbingStore'
import { usePersoFlow } from '../../hooks/usePersoFlow'
import type { JobStatus } from '../../types/dubbing.types'
import type { MessageKey } from '@/lib/i18n/clientMessages'

const statusLabels: Record<JobStatus, MessageKey> = {
  idle: 'dubbing.processing.status.idle',
  transcribing: 'dubbing.processing.status.transcribing',
  translating: 'dubbing.processing.status.translating',
  synthesizing: 'dubbing.processing.status.synthesizing',
  'lip-syncing': 'dubbing.processing.status.lipSyncing',
  merging: 'dubbing.processing.status.merging',
  completed: 'dubbing.processing.status.completed',
  failed: 'dubbing.processing.status.failed',
}

const reasonLabels: Record<string, MessageKey> = {
  PENDING: 'dubbing.processing.reason.pending',
  CREATED: 'dubbing.processing.reason.created',
  READY: 'dubbing.processing.reason.ready',
  READY_TARGET_LANGUAGES: 'dubbing.processing.reason.readyTargetLanguages',
  ENQUEUED: 'dubbing.processing.reason.enqueued',
  PROCESSING: 'dubbing.processing.reason.processing',
  COMPLETED: 'dubbing.processing.reason.completed',
  Completed: 'dubbing.processing.reason.completed',
  FAILED: 'dubbing.processing.reason.failed',
  Failed: 'dubbing.processing.reason.failed',
  CANCELED: 'dubbing.processing.reason.canceled',
}

function getProgressLabel(t: ReturnType<typeof useLocaleText>, lp: { progressReason: string; progress: number }) {
  if (lp.progress >= 100 && lp.progressReason !== 'COMPLETED' && lp.progressReason !== 'Completed' && lp.progressReason !== 'FAILED' && lp.progressReason !== 'Failed' && lp.progressReason !== 'CANCELED') {
    return t('features.dubbing.components.steps.processingStep.finalizing')
  }
  return reasonLabels[lp.progressReason]
    ? t(reasonLabels[lp.progressReason])
    : t('features.dubbing.components.steps.processingStep.processing')
}

export function ProcessingStep() {
  const { languageProgress, jobStatus, setStep, isSubmitted, setIsSubmitted, reset } = useDubbingStore()
  const { submitDubbing, startPolling, stopPolling, cancelAll } = usePersoFlow()
  const locale = useAppLocale()
  const t = useLocaleText()
  const [cancelling, setCancelling] = useState(false)
  const submittedRef = useRef(isSubmitted)

  // Submit dubbing and start polling on mount — ref guard prevents double-fire in Strict Mode
  useEffect(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    setIsSubmitted(true)

    const run = async () => {
      try {
        await submitDubbing()
        startPolling()
      } catch {
        // Error already handled in hook via toast
      }
    }
    run()

    return () => stopPolling()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount
  }, [])

  // Auto-advance when all complete
  const allCompleted = languageProgress.length > 0 && languageProgress.every(
    (p) => p.progressReason === 'COMPLETED' || p.progressReason === 'Completed' || p.progressReason === 'FAILED' || p.progressReason === 'Failed' || p.progressReason === 'CANCELED',
  )

  useEffect(() => {
    if (allCompleted) {
      stopPolling()
      const t = setTimeout(() => setStep(7), 2000)
      return () => clearTimeout(t)
    }
  }, [allCompleted, setStep, stopPolling])

  const overallProgress =
    languageProgress.length > 0
      ? Math.round(languageProgress.reduce((acc, p) => acc + p.progress, 0) / languageProgress.length)
      : 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Overall progress */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{t('features.dubbing.components.steps.processingStep.overallProgress')}</span>
          <span className="text-sm font-bold text-surface-900 dark:text-white">{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} size="lg" />
      </Card>

      {/* Cancel button */}
      {!allCompleted && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setCancelling(true)
              try {
                await cancelAll()
                reset()
              } catch {
                setCancelling(false)
              }
            }}
            loading={cancelling}
            disabled={cancelling}
            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
          >
            <XCircle className="h-4 w-4" />
            {t('features.dubbing.components.steps.processingStep.cancelJob')}
          </Button>
        </div>
      )}

      {/* Per-language cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {languageProgress.map((lp) => {
          const lang = getLanguageByCode(lp.langCode)
          if (!lang) return null

          const isCompleted = lp.progressReason === 'COMPLETED' || lp.progressReason === 'Completed'
          const isFailed = lp.progressReason === 'FAILED' || lp.progressReason === 'Failed' || lp.progressReason === 'CANCELED'

          return (
            <Card
              key={lp.langCode}
              className={cn(
                'transition-all',
                isCompleted && 'border-emerald-200 dark:border-emerald-800',
                isFailed && 'border-red-200 dark:border-red-800',
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">{lang.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white">{locale === 'ko' ? lang.nativeName : lang.name}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-300">
                {getProgressLabel(t, lp)}
                  </p>
                </div>
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : isFailed ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                )}
              </div>

              <Progress value={lp.progress} size="sm" />

              <div className="mt-2 flex items-center justify-between">
                <Badge
                  variant={
                    isCompleted ? 'success' : isFailed ? 'error' : 'brand'
                  }
                >
                  {t(statusLabels[lp.status])}
                </Badge>
                <span className="text-xs text-surface-500 dark:text-surface-300">{Math.round(lp.progress)}%</span>
              </div>

            </Card>
          )
        })}
      </div>

      {jobStatus === 'failed' && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10">
          <p className="text-sm text-red-700 dark:text-red-400">
            {t('features.dubbing.components.steps.processingStep.someLanguagesFailedCompletedLanguagesAreStillAvailable')}
          </p>
        </Card>
      )}
    </div>
  )
}
