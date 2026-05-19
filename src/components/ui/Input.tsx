'use client'

import { type InputHTMLAttributes, forwardRef, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-600 dark:text-ink-200">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-paper-500 dark:text-paper-300">{icon}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'h-10 w-full rounded-md border border-paper-300 bg-paper-50 px-3 text-sm text-ink-900 placeholder:text-paper-500 transition-colors focus-ring dark:border-paper-700 dark:bg-paper-900 dark:text-ink-50 dark:placeholder:text-paper-400',
              icon && 'pl-10',
              error && 'border-red-500 dark:border-red-500',
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
