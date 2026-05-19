'use client'

import { useCallback, useRef, type ChangeEvent, type FormEvent } from 'react'
import { ChevronDown, Globe2 } from 'lucide-react'
import {
  APP_LOCALE_LABELS,
  APP_LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  withLocalePath,
  type AppLocale,
} from '@/lib/i18n/config'
import { useAppLocale } from '@/hooks/useLocaleText'
import { cn } from '@/utils/cn'

type AppLocaleSelectProps = {
  className?: string
}

export function AppLocaleSelect({ className }: AppLocaleSelectProps) {
  const appLocale = useAppLocale()
  const navigatingRef = useRef(false)

  const applyLocale = useCallback((nextLocale: AppLocale) => {
    if (navigatingRef.current || nextLocale === appLocale) return
    navigatingRef.current = true
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.replace(withLocalePath(current || '/', nextLocale))
  }, [appLocale])

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    applyLocale(event.currentTarget.value as AppLocale)
  }

  const handleInput = (event: FormEvent<HTMLSelectElement>) => {
    applyLocale(event.currentTarget.value as AppLocale)
  }

  return (
    <div className={cn('relative', className)}>
      <Globe2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500 dark:text-ink-200" />
      <select
        key={appLocale}
        aria-label="Language / 언어"
        defaultValue={appLocale}
        onChange={handleChange}
        onInput={handleInput}
        className="h-9 w-full appearance-none rounded-md border border-paper-300 bg-paper-50 pl-8 pr-8 text-sm font-medium text-ink-800 transition-colors focus-ring dark:border-paper-700 dark:bg-paper-900 dark:text-ink-50"
      >
        {APP_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {APP_LOCALE_LABELS[locale].nativeLabel}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-500 dark:text-paper-300" />
    </div>
  )
}
