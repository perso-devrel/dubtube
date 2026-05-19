'use client'

import { type FormEvent, useState } from 'react'
import { ArrowRight, Link2 } from 'lucide-react'
import { isValidYouTubeUrl } from '@/utils/validators'
import { useLocaleText } from '@/hooks/useLocaleText'
import { useLocaleRouter } from '@/hooks/useLocalePath'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { signInWithGoogle } from '@/lib/google-auth'

const SIGN_IN_REDIRECT_DELAY_MS = 900

export function HeroUrlInput() {
  const [url, setUrl] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const router = useLocaleRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const authLoading = useAuthStore((state) => state.isLoading)
  const addToast = useNotificationStore((state) => state.addToast)
  const isValid = url.length > 0 && isValidYouTubeUrl(url)
  const t = useLocaleText()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isValid || authLoading || signingIn) return

    const returnTo = `/dubbing?url=${encodeURIComponent(url)}`
    if (isAuthenticated) {
      router.push(returnTo)
      return
    }

    addToast({
      type: 'info',
      title: t('features.landing.heroUrlInput.signInRequired'),
      message: t('features.landing.heroUrlInput.signInWithGoogleToContinue'),
    })
    setSigningIn(true)
    try {
      await new Promise((resolve) => window.setTimeout(resolve, SIGN_IN_REDIRECT_DELAY_MS))
      await signInWithGoogle({ returnTo })
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : t('components.layout.landingNavBar.pleaseTryAgainShortlyContactUsIfThe')
      addToast({ type: 'error', title: t('components.layout.landingNavBar.couldNotSignIn'), message })
      setSigningIn(false)
    }
  }

  return (
    <form className="mt-9 max-w-xl" onSubmit={handleSubmit}>
      <div className="group flex flex-col gap-2 rounded-lg border border-paper-200 bg-paper-50 p-1.5 shadow-[0_1px_0_rgba(20,19,15,0.03)] transition-colors focus-within:border-ink-900 dark:border-paper-800 dark:bg-paper-900 dark:focus-within:border-paper-50 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5">
          <Link2 className="h-4 w-4 shrink-0 text-ink-300 dark:text-ink-300" aria-hidden />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('features.landing.heroUrlInput.pasteAYouTubeLink')}
            className="min-w-0 flex-1 bg-transparent py-2 text-[14.5px] text-ink-900 outline-none placeholder:text-ink-300 dark:text-ink-50 dark:placeholder:text-ink-300"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button
          type="submit"
          disabled={!isValid || authLoading || signingIn}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md bg-ink-900 px-4 text-[13.5px] font-medium text-paper-50 transition-colors hover:bg-clay-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-paper-50 dark:text-ink-900 dark:hover:bg-clay-400 dark:hover:text-paper-50"
        >
          {signingIn ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          ) : null}
          {t('features.landing.heroUrlInput.startDubbing')}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-2 px-1 font-mono text-[11px] text-ink-300 dark:text-ink-300">
        youtube.com/watch?v=… &nbsp;·&nbsp; youtu.be/…
      </p>
    </form>
  )
}
