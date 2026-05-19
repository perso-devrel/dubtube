import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-paper-200 bg-paper-50 p-5 shadow-[0_1px_0_rgb(20_19_15/0.04),0_18px_50px_-34px_rgb(20_19_15/0.32)] dark:border-paper-800 dark:bg-paper-900 dark:shadow-none sm:p-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold leading-6 text-ink-900 dark:text-ink-50', className)} {...props}>
      {children}
    </h3>
  )
}
