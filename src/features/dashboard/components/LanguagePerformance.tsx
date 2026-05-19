'use client'

import { Card, CardTitle } from '@/components/ui'
import { formatNumber } from '@/utils/formatters'
import { useLanguagePerformance } from '@/hooks/useDashboardData'
import { getLanguageByCode } from '@/utils/languages'
import { useLocaleText } from '@/hooks/useLocaleText'

export function LanguagePerformance() {
  const t = useLocaleText()
  const { data: rawData } = useLanguagePerformance()

  const chartData = (rawData || []).map((r) => {
    const lang = getLanguageByCode(r.language_code)
    return {
      language: lang?.name || r.language_code,
      views: Number(r.total_views) || 0,
      flag: lang?.flag || '',
    }
  })
  const maxViews = Math.max(1, ...chartData.map((item) => item.views))

  if (chartData.length === 0) {
    return (
      <Card>
        <CardTitle>{t('features.dashboard.components.languagePerformance.languagePerformance')}</CardTitle>
        <p className="mb-4 text-sm text-ink-500 dark:text-ink-200">{t('features.dashboard.components.languagePerformance.viewsByDubbingLanguage')}</p>
        <div className="flex h-64 items-center justify-center text-center text-sm text-ink-500 dark:text-ink-200">
          {t('features.dashboard.components.languagePerformance.performanceAppearsHereAfterYouUploadVideosTo')}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardTitle>{t('features.dashboard.components.languagePerformance.languagePerformance2')}</CardTitle>
      <p className="mb-4 text-sm text-ink-500 dark:text-ink-200">{t('features.dashboard.components.languagePerformance.viewsByDubbingLanguage2')}</p>

      <div className="h-64 w-full min-w-0 space-y-3 overflow-hidden" role="img" aria-label={t('features.dashboard.components.languagePerformance.viewsByDubbingLanguage2')}>
        {chartData.slice(0, 8).map((item) => {
          const width = Math.max(4, (item.views / maxViews) * 100)
          return (
            <div key={item.language} className="grid grid-cols-[5.75rem_1fr_4.5rem] items-center gap-3">
              <div className="truncate text-xs font-medium text-ink-500 dark:text-ink-200">
                {item.flag} {item.language}
              </div>
              <div className="h-5 rounded-full bg-paper-100 dark:bg-paper-800">
                <div
                  className="h-full rounded-full bg-clay-500"
                  style={{ width: `${width}%` }}
                  title={`${item.language}: ${formatNumber(item.views)} ${t('features.dashboard.components.languagePerformance.views')}`}
                />
              </div>
              <div className="text-right text-xs font-medium text-ink-600 dark:text-ink-100">
                {formatNumber(item.views)}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
