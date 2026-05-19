import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-b border-paper-200 pb-5 dark:border-paper-800 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {meta && (
          <div className="mb-2 font-mono text-[11px] font-medium uppercase text-clay-600 dark:text-clay-300">
            {meta}
          </div>
        )}
        <h1 className="text-[26px] font-semibold leading-tight text-ink-900 dark:text-ink-50 sm:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl break-keep text-sm leading-6 text-ink-500 dark:text-ink-200">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
