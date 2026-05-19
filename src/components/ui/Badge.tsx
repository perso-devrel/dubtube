import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

const variants = {
  default: 'bg-paper-100 text-ink-600 ring-1 ring-paper-200 dark:bg-paper-800 dark:text-ink-100 dark:ring-paper-700',
  brand: 'bg-clay-50 text-clay-700 ring-1 ring-clay-100 dark:bg-clay-800/35 dark:text-clay-200 dark:ring-clay-700/60',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
} as const

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
  truncate?: boolean
}

export function Badge({ className, variant = 'default', truncate, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        truncate && 'max-w-full overflow-hidden text-ellipsis',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
