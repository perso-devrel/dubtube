import { cn } from '@/utils/cn'
import { getLanguageByCode } from '@/utils/languages'

interface LanguageBadgeProps {
  code: string
  className?: string
}

export function LanguageBadge({ code, className }: LanguageBadgeProps) {
  const lang = getLanguageByCode(code)
  if (!lang) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-paper-100 px-1.5 py-0.5 text-xs font-medium text-ink-600 ring-1 ring-paper-200 dark:bg-paper-800 dark:text-ink-100 dark:ring-paper-700',
        className,
      )}
    >
      <span>{lang.flag}</span>
      <span>{code.toUpperCase()}</span>
    </span>
  )
}
