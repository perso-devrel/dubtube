'use client'

import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useNotificationStore, type ToastType } from '@/stores/notificationStore'
import { useLocaleText } from '@/hooks/useLocaleText'

const icons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const styles: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-paper-50 dark:border-emerald-700 dark:bg-paper-900',
  error: 'border-red-200 bg-paper-50 dark:border-red-700 dark:bg-paper-900',
  info: 'border-blue-200 bg-paper-50 dark:border-blue-700 dark:bg-paper-900',
  warning: 'border-amber-200 bg-paper-50 dark:border-amber-700 dark:bg-paper-900',
}

const accentStyles: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
}

const iconBgStyles: Record<ToastType, string> = {
  success: 'bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-800',
  error: 'bg-red-50 ring-red-100 dark:bg-red-950/40 dark:ring-red-800',
  info: 'bg-blue-50 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-800',
  warning: 'bg-amber-50 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-800',
}

const iconColors: Record<ToastType, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-amber-600 dark:text-amber-400',
}

export function ToastContainer() {
  const { toasts, removeToast } = useNotificationStore()
  const t = useLocaleText()

  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-3 top-3 z-[120] flex flex-col items-center gap-3 sm:top-5"
    >
      {toasts.map((toast) => {
        const Icon = icons[toast.type]
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto relative flex w-full max-w-[560px] items-start gap-3 overflow-hidden rounded-lg border p-4 pl-5 shadow-[0_20px_70px_-34px_rgb(20_19_15/0.72)] ring-1 ring-black/5 animate-slide-down dark:ring-white/10 sm:p-5 sm:pl-6',
              styles[toast.type],
            )}
          >
            <div className={cn('absolute inset-y-0 left-0 w-1.5', accentStyles[toast.type])} aria-hidden="true" />
            <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1', iconBgStyles[toast.type])}>
              <Icon className={cn('h-5 w-5', iconColors[toast.type])} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="break-words text-base font-semibold leading-6 text-ink-900 dark:text-ink-50">{toast.title}</p>
              {toast.message && (
                <p className="mt-1 break-words text-sm leading-6 text-ink-600 dark:text-ink-200">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label={t('components.feedback.toast.closeNotification')}
              className="shrink-0 rounded-md p-1 text-ink-500 hover:bg-paper-100 hover:text-ink-900 dark:text-ink-200 dark:hover:bg-paper-800 dark:hover:text-ink-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
