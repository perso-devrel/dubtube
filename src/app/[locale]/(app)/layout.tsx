import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { ClientMessagesProvider } from '@/lib/i18n/clientMessages'
import { appShellMessages } from '@/lib/i18n/client-messages/appShell'
import { SESSION_COOKIE, verifySessionCookie } from '@/lib/auth/session-cookie'
import { resolveAppLocale } from '@/lib/i18n/config'
import { isOperationsAdminFromCookies } from '@/lib/ops/admin'

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, cookieStore] = await Promise.all([params, cookies()])
  const rawSession = cookieStore.get(SESSION_COOKIE)?.value
  if (!rawSession || !(await verifySessionCookie(rawSession))) {
    redirect(`/${resolveAppLocale(locale)}`)
  }
  const isOpsAdmin = await isOperationsAdminFromCookies()

  return (
    <ClientMessagesProvider messages={appShellMessages}>
      <div className="app-root min-h-screen text-ink-900 dark:text-ink-50">
        <Sidebar isOpsAdmin={isOpsAdmin} />
        <div className="lg:ml-64">
          <Topbar isOpsAdmin={isOpsAdmin} />
          <main className="mx-auto max-w-[1440px] px-4 py-5 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-8 lg:pb-8">{children}</main>
        </div>
      </div>
    </ClientMessagesProvider>
  )
}
