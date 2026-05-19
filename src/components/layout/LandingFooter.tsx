'use client'

import { LocaleLink } from '@/components/i18n/LocaleLink'
import { useLocaleText } from '@/hooks/useLocaleText'

export function LandingFooter() {
  const t = useLocaleText()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-paper-200 bg-paper-50 dark:border-paper-800 dark:bg-paper-950">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr] sm:items-start">
          <div>
            <div className="inline-flex items-baseline">
              <span className="display-tight text-[20px] font-semibold tracking-tight text-ink-900 dark:text-ink-50">
                sub<span className="text-clay-500 dark:text-clay-400">2tube</span>
              </span>
            </div>
            <p className="mt-2 break-keep text-[13px] leading-[1.6] text-ink-500 dark:text-ink-200 lg:whitespace-nowrap">
              {t('components.layout.landingFooter.tagline')}
            </p>
            <div className="mt-5 font-mono text-[11px] text-ink-300 dark:text-ink-300">
              © {year} sub2tube &nbsp;·&nbsp; all rights reserved
            </div>
          </div>

          <nav className="grid gap-2 sm:justify-items-end">
            <span className="label-mono mb-1 text-ink-300 dark:text-ink-200">Pages</span>
            <LocaleLink
              href="/privacy"
              className="text-[13px] text-ink-700 transition-colors hover:text-clay-500 dark:text-ink-100 dark:hover:text-clay-400"
            >
              {t('components.layout.landingFooter.privacyPolicy')}
            </LocaleLink>
            <LocaleLink
              href="/terms"
              className="text-[13px] text-ink-700 transition-colors hover:text-clay-500 dark:text-ink-100 dark:hover:text-clay-400"
            >
              {t('components.layout.landingFooter.termsOfService')}
            </LocaleLink>
            <LocaleLink
              href="/support"
              className="text-[13px] text-ink-700 transition-colors hover:text-clay-500 dark:text-ink-100 dark:hover:text-clay-400"
            >
              {t('components.layout.landingFooter.contact')}
            </LocaleLink>
          </nav>
        </div>
      </div>
    </footer>
  )
}
