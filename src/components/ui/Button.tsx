'use client'

import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'
import { Loader2 } from 'lucide-react'

const variants = {
  primary:
    'bg-ink-900 text-paper-50 shadow-[0_1px_0_rgb(20_19_15/0.18)] hover:bg-clay-500 dark:bg-paper-50 dark:text-ink-900 dark:hover:bg-clay-400 dark:hover:text-paper-50',
  secondary:
    'border border-paper-200 bg-paper-100 text-ink-900 hover:bg-paper-200 dark:border-paper-700 dark:bg-paper-800 dark:text-ink-50 dark:hover:bg-paper-700',
  ghost: 'text-ink-600 hover:bg-paper-100 hover:text-ink-900 dark:text-ink-200 dark:hover:bg-paper-800 dark:hover:text-ink-50',
  destructive: 'bg-red-600 text-paper-50 shadow-[0_1px_0_rgb(127_29_29/0.18)] hover:bg-red-700',
  outline:
    'border border-paper-300 bg-paper-50 text-ink-700 hover:border-ink-900 hover:bg-paper-100 hover:text-ink-900 dark:border-paper-700 dark:bg-transparent dark:text-ink-100 dark:hover:border-paper-500 dark:hover:bg-paper-800',
} as const

const sizes = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus-ring disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
          variants[variant],
          sizes[size],
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
