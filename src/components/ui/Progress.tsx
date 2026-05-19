import { cn } from '@/utils/cn'

interface ProgressProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Progress({ value, max = 100, className, showLabel, size = 'md' }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1 flex justify-between text-xs text-ink-500 dark:text-ink-200">
          <span>Progress</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className={cn('w-full overflow-hidden rounded-full bg-paper-200 dark:bg-paper-800', heights[size])}>
        <div className={cn('h-full rounded-full bg-clay-500 transition-all duration-500')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
