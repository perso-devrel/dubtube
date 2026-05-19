'use client'

import { Card, CardTitle } from '@/components/ui'
import { useCreditUsage } from '@/hooks/useDashboardData'
import { useLocaleText } from '@/hooks/useLocaleText'
import type { CreditUsageRow } from './types'

// Fallback data when DB has no data yet
const fallbackData = [
  { month: '2026-01', used: 0 },
  { month: '2026-02', used: 0 },
  { month: '2026-03', used: 0 },
  { month: '2026-04', used: 0 },
]

interface CreditChartProps {
  initialData?: CreditUsageRow[]
}

export function CreditChart({ initialData }: CreditChartProps) {
  const t = useLocaleText()
  const { data: rawData } = useCreditUsage(initialData)

  const chartData = rawData && rawData.length > 0
    ? rawData.map((r) => ({
        month: r.month.slice(5),
        used: Number(r.minutes_used) || 0,
      })).reverse()
    : fallbackData.map((d) => ({ month: d.month.slice(5), used: d.used }))
  const maxUsed = Math.max(1, ...chartData.map((item) => item.used))
  const points = chartData.map((item, index) => {
    const x = chartData.length === 1 ? 50 : (index / (chartData.length - 1)) * 100
    const y = 100 - (item.used / maxUsed) * 84
    return { ...item, x, y }
  })
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? 100} 100 L ${points[0]?.x ?? 0} 100 Z`

  return (
    <Card>
      <CardTitle>{t('features.dashboard.components.creditChart.dubbingTimeUsage')}</CardTitle>
      <p className="mb-4 text-sm text-ink-500 dark:text-ink-200">{t('features.dashboard.components.creditChart.monthlyUsage')}</p>

      <div className="h-64 w-full min-w-0" role="img" aria-label={t('features.dashboard.components.creditChart.monthlyUsage')}>
        <svg viewBox="0 0 100 112" className="h-full w-full overflow-visible text-paper-200 dark:text-paper-800" preserveAspectRatio="none">
          <defs>
            <linearGradient id="creditGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d9472b" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#d9472b" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[16, 44, 72, 100].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="currentColor" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={areaPath} fill="url(#creditGradient)" />
          <path d={linePath} fill="none" stroke="#d9472b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.map((point) => (
            <circle key={point.month} cx={point.x} cy={point.y} r="1.6" fill="#d9472b" vectorEffect="non-scaling-stroke">
              <title>{`${point.month}: ${point.used}${t('features.dashboard.components.creditChart.min')}`}</title>
            </circle>
          ))}
        </svg>
        <div className="mt-2 flex justify-between text-xs text-ink-500 dark:text-ink-200">
          {points.map((point) => (
            <span key={point.month}>{point.month}</span>
          ))}
        </div>
      </div>
    </Card>
  )
}
