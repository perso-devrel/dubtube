'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LocaleLink } from '@/components/i18n/LocaleLink'
import { cn } from '@/utils/cn'
import { stripLocalePrefix } from '@/lib/i18n/config'
import { useLocaleText } from '@/hooks/useLocaleText'
import { useOperationsAccess } from '@/features/ops/hooks/useOperationsAccess'
import {
  LayoutDashboard,
  Languages,
  CreditCard,
  Layers,
  Settings,
  Globe2,
  Activity,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'components.layout.sidebar.labelDashboard', mobileLabel: 'components.layout.sidebar.mobileLabelHome', icon: LayoutDashboard },
  { to: '/dubbing', label: 'components.layout.sidebar.labelNewDubbing', mobileLabel: 'components.layout.sidebar.mobileLabelDub', icon: Languages },
  { to: '/metadata', label: 'components.layout.sidebar.labelTitleDescription', mobileLabel: 'components.layout.sidebar.mobileLabelTitle', icon: Globe2 },
  { to: '/jobs', label: 'components.layout.sidebar.labelDubbingJobs', mobileLabel: 'components.layout.sidebar.mobileLabelJobs', icon: Layers, activePaths: ['/batch', '/uploads'] },
  { to: '/ops', label: 'components.layout.sidebar.labelOperations', mobileLabel: 'components.layout.sidebar.mobileLabelOps', icon: Activity, opsAdminOnly: true },
  { to: '/billing', label: 'components.layout.sidebar.labelBilling', mobileLabel: 'components.layout.sidebar.mobileLabelBilling', icon: CreditCard },
]

export function Sidebar({ isOpsAdmin = false }: { isOpsAdmin?: boolean }) {
  const pathname = usePathname()
  const activePathname = stripLocalePrefix(pathname || '/')
  const t = useLocaleText()
  const opsAccess = useOperationsAccess({ enabled: isOpsAdmin })
  const canViewOps = isOpsAdmin || opsAccess.data?.isOpsAdmin === true
  const visibleItems = navItems.filter((item) => !item.opsAdminOnly || canViewOps)
  const settingsLabel = t('components.layout.sidebar.labelSettings')

  const renderNavItem = ({ to, label, icon: Icon, activePaths }: (typeof navItems)[number]) => {
    const isActive = activePathname === to ||
      activePathname.startsWith(to + '/') ||
      Boolean(activePaths?.some((path) => activePathname === path || activePathname.startsWith(path + '/')))
    return (
      <LocaleLink
        key={to}
        href={to}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-ink-900 text-paper-50 dark:bg-paper-50 dark:text-ink-900'
            : 'text-ink-500 hover:bg-paper-100 hover:text-ink-900 dark:text-ink-200 dark:hover:bg-paper-800 dark:hover:text-ink-50',
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {t(label)}
      </LocaleLink>
    )
  }

  const renderMobileNavItem = ({ to, label, mobileLabel, icon: Icon, activePaths }: (typeof navItems)[number]) => {
    const isActive = activePathname === to ||
      activePathname.startsWith(to + '/') ||
      Boolean(activePaths?.some((path) => activePathname === path || activePathname.startsWith(path + '/')))
    return (
      <LocaleLink
        key={to}
        href={to}
        className={cn(
          'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors',
          isActive
            ? 'bg-ink-900 text-paper-50 dark:bg-paper-50 dark:text-ink-900'
            : 'text-ink-500 hover:bg-paper-100 hover:text-ink-900 dark:text-ink-200 dark:hover:bg-paper-800 dark:hover:text-ink-50',
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="max-w-[4.25rem] truncate">{t(mobileLabel ?? label)}</span>
      </LocaleLink>
    )
  }

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-paper-200 bg-paper-50/95 backdrop-blur dark:border-paper-800 dark:bg-paper-950/95 lg:flex">
        <LocaleLink
          href="/dashboard"
          className="flex h-16 items-center gap-2.5 border-b border-paper-200 px-6 transition-colors hover:bg-paper-100 focus-ring dark:border-paper-800 dark:hover:bg-paper-900"
        >
          <Image
            src="/logo.png"
            alt="sub2tube"
            width={36}
            height={36}
            className="rounded-md"
            priority
          />
          <span className="text-lg font-semibold text-ink-900 dark:text-ink-50">
            sub<span className="text-clay-500 dark:text-clay-300">2tube</span>
          </span>
        </LocaleLink>

        <nav className="flex-1 space-y-1 p-3">
          {visibleItems.map(renderNavItem)}
        </nav>

        <div className="border-t border-paper-200 p-3 dark:border-paper-800">
          <LocaleLink
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-500 hover:bg-paper-100 hover:text-ink-900 dark:text-ink-200 dark:hover:bg-paper-800 dark:hover:text-ink-50"
          >
            <Settings className="h-5 w-5 shrink-0" />
            {settingsLabel}
          </LocaleLink>
        </div>
      </aside>

      <nav
        aria-label={t('components.layout.sidebar.appNavigation')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-paper-200 bg-paper-50/95 px-2 py-2 backdrop-blur-md dark:border-paper-800 dark:bg-paper-950/95 lg:hidden"
      >
        <div className="flex gap-0.5">
          {visibleItems.map(renderMobileNavItem)}
          <LocaleLink
            href="/settings"
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors',
              activePathname === '/settings' || activePathname.startsWith('/settings/')
                ? 'bg-ink-900 text-paper-50 dark:bg-paper-50 dark:text-ink-900'
              : 'text-ink-500 hover:bg-paper-100 hover:text-ink-900 dark:text-ink-200 dark:hover:bg-paper-800 dark:hover:text-ink-50',
            )}
          >
            <Settings className="h-5 w-5" />
            <span className="max-w-[4.25rem] truncate">{settingsLabel}</span>
          </LocaleLink>
        </div>
      </nav>
    </>
  )
}
