'use client'

import { useState } from 'react'
import { LocaleLink } from '@/components/i18n/LocaleLink'
import { useAuthStore } from '@/stores/authStore'
import { signInWithGoogle } from '@/lib/google-auth'
import { useNotificationStore } from '@/stores/notificationStore'
import { AppLocaleSelect } from '@/components/layout/AppLocaleSelect'
import { useLocaleText } from '@/hooks/useLocaleText'

export function LandingNavBar() {
  const { isAuthenticated } = useAuthStore()
  const addToast = useNotificationStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)
  const t = useLocaleText()

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      await signInWithGoogle({ returnTo: '/dashboard' })
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : t('components.layout.landingNavBar.pleaseTryAgainShortlyContactUsIfThe')
      addToast({ type: 'error', title: t('components.layout.landingNavBar.couldNotSignIn'), message })
      setLoading(false)
    }
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-paper-200 bg-paper-50/95 backdrop-blur-[1px] dark:border-paper-800 dark:bg-paper-950/95">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
        <LocaleLink href="/" className="group inline-flex items-baseline">
          <span className="display-tight text-[17px] font-semibold tracking-tight text-ink-900 dark:text-ink-50">
            sub<span className="text-clay-500 dark:text-clay-400">2tube</span>
          </span>
        </LocaleLink>

        <div className="hidden items-center gap-7 md:flex">
          <a href="#how-it-works" className="text-[13px] text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-200 dark:hover:text-ink-50">
            {t('components.layout.landingNavBar.howItWorks')}
          </a>
          <a href="#features" className="text-[13px] text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-200 dark:hover:text-ink-50">
            {t('components.layout.landingNavBar.features')}
          </a>
          <a href="#pricing" className="text-[13px] text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-200 dark:hover:text-ink-50">
            {t('components.layout.landingNavBar.pricing')}
          </a>
        </div>

        <div className="flex items-center gap-2.5">
          <AppLocaleSelect className="w-24 sm:w-28" />
          {isAuthenticated ? (
            <LocaleLink
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-md bg-ink-900 px-3.5 text-[13px] font-medium text-paper-50 transition-colors hover:bg-ink-700 dark:bg-paper-50 dark:text-ink-900 dark:hover:bg-paper-200"
            >
              <span className="hidden sm:inline">{t('components.layout.landingNavBar.dashboard')}</span>
              <span className="sm:hidden">{t('components.layout.landingNavBar.home')}</span>
            </LocaleLink>
          ) : (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              aria-label={t('components.layout.landingNavBar.startWithGoogle')}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#747775] bg-white px-3 text-[13px] font-medium text-[#1f1f1f] transition-colors hover:bg-[#f8f9fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f1f]"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              <span className="hidden sm:inline">{t('components.layout.landingNavBar.startWithGoogle2')}</span>
              <span className="sm:hidden">{t('components.layout.landingNavBar.start')}</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
