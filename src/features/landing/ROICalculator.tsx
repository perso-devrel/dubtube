'use client'

import { useState } from 'react'
import { BarChart3, Globe2, TrendingUp } from 'lucide-react'
import { CategoryLabel } from './_shared'
import { formatNumber } from '@/utils/formatters'
import { useLocaleText } from '@/hooks/useLocaleText'

const BASE_VIEWS = 100000

// Per-language reach contribution (relative to source views). Values are an
// internal heuristic distributed from public macro data; NOT a guarantee and
// NOT shown per-language on the page — the UI only renders generic bars.
const LIFT_PER_LANGUAGE = [0.30, 0.22, 0.18, 0.14, 0.12, 0.10, 0.09, 0.08, 0.06, 0.04]
const CUMULATIVE_LIFT = LIFT_PER_LANGUAGE.reduce<number[]>((acc, rate) => {
  acc.push((acc.at(-1) ?? 0) + rate)
  return acc
}, [])
const TOTAL_LIFT = CUMULATIVE_LIFT.at(-1) ?? 0

export function ROICalculator() {
  const [selectedCount, setSelectedCount] = useState(5)
  const t = useLocaleText()

  const lift = LIFT_PER_LANGUAGE.slice(0, selectedCount).reduce((a, b) => a + b, 0)
  const growthPct = Math.round(lift * 100)
  const projectedViews = Math.round(BASE_VIEWS * (1 + lift))

  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* LEFT — editorial column */}
          <div>
            <CategoryLabel kr="도달 범위" en="Reach" />
            <h2 className="display-tight mt-3 max-w-md break-keep text-[32px] font-semibold leading-[1.08] text-ink-900 dark:text-ink-50 sm:text-[40px] lg:text-[44px]">
              {t('features.landing.rOICalculator.estimatedReachCalculator')}
            </h2>
            <p className="mt-5 max-w-md break-keep text-[15px] leading-[1.65] text-ink-500 dark:text-ink-200">
              {t('features.landing.rOICalculator.aReferenceEstimateBasedOnPublicCasesAnd')}
            </p>
            <p className="mt-4 max-w-md break-keep text-[12.5px] leading-[1.6] text-ink-300 dark:text-ink-300">
              <span aria-hidden>* </span>
              {t('features.landing.rOICalculator.actualPerformanceDependsOnContentThumbnailsUploadCadence')}
            </p>
          </div>

          {/* RIGHT — instrument panel */}
          <div className="overflow-hidden rounded-xl border border-paper-200 bg-paper-50 shadow-[0_1px_0_rgba(20,19,15,0.03),0_12px_32px_-16px_rgba(20,19,15,0.12)] dark:border-paper-800 dark:bg-paper-900 dark:shadow-[0_1px_0_rgba(0,0,0,0.3),0_12px_32px_-16px_rgba(0,0,0,0.5)]">
            {/* Slider strip */}
            <div className="border-b border-paper-200 bg-paper-50 p-5 dark:border-paper-800 dark:bg-paper-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor="roi-langs" className="flex items-center gap-2 text-[13px] font-medium text-ink-900 dark:text-ink-50">
                  <BarChart3 className="h-4 w-4 text-clay-500 dark:text-clay-400" />
                  {t('features.landing.rOICalculator.numberOfDubbingLanguages')}
                </label>
                <span className="inline-flex h-7 items-center rounded-md border border-paper-300 bg-paper-100 px-2.5 font-mono text-[12.5px] tabular-nums text-ink-900 dark:border-paper-700 dark:bg-paper-800 dark:text-ink-50">
                  {t('features.landing.rOICalculator.value', { selectedCount })}
                </span>
              </div>
              <input
                id="roi-langs"
                type="range"
                min={1}
                max={10}
                value={selectedCount}
                onChange={(e) => setSelectedCount(Number(e.target.value))}
                aria-label={t('features.landing.rOICalculator.numberOfDubbingLanguages2')}
                className="mt-4 w-full accent-clay-500 dark:accent-clay-400"
              />
              <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-ink-300 dark:text-ink-300">
                <span>1</span><span>10</span>
              </div>
            </div>

            {/* Result split */}
            <div className="grid grid-cols-1 sm:grid-cols-[0.85fr_1.15fr]">
              <div className="border-b border-paper-200 p-6 dark:border-paper-800 sm:border-b-0 sm:border-r">
                <div className="flex items-center gap-2 text-[12px] font-medium text-ink-700 dark:text-ink-100">
                  <TrendingUp className="h-3.5 w-3.5 text-clay-500 dark:text-clay-400" />
                  <span className="break-keep">
                    {t('features.landing.rOICalculator.referenceEstimateForSelectedLanguages')}
                  </span>
                </div>
                {/* fixed-width container so digit-count changes never jitter the layout */}
                <div className="mt-5">
                  <span
                    className="display-tight inline-block min-w-[6ch] text-left font-semibold tabular-nums text-clay-500 dark:text-clay-400"
                    style={{ fontSize: 'clamp(48px, 7vw, 72px)', lineHeight: 1 }}
                  >
                    +{growthPct}%
                  </span>
                </div>
                <p className="mt-5 break-keep text-[13px] leading-[1.6] text-ink-500 dark:text-ink-200">
                  {t('features.landing.rOICalculator.from')}{' '}
                  <span className="font-mono tabular-nums text-ink-900 dark:text-ink-50">{formatNumber(BASE_VIEWS)}</span>
                  {t('features.landing.rOICalculator.monthlyViews')}{' '}
                  {t('features.landing.rOICalculator.toAnEstimated')}{' '}
                  <span className="font-mono font-semibold tabular-nums text-ink-900 dark:text-ink-50">{formatNumber(projectedViews)}</span>
                  {t('features.landing.rOICalculator.views')}
                </p>
              </div>

              <div className="p-6">
                <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-ink-700 dark:text-ink-100">
                  <Globe2 className="h-3.5 w-3.5 text-clay-500 dark:text-clay-400" />
                  <span className="whitespace-nowrap">
                    {t('features.landing.rOICalculator.numberOfDubbingLanguages')}
                  </span>
                </div>
                <ol className="space-y-2">
                  {CUMULATIVE_LIFT.map((cumulative, index) => {
                    const isActive = index < selectedCount
                    // Cumulative reach up to this language count — the bar
                    // grows as more languages are added, matching the "reach"
                    // label intuitively (an increasing graph).
                    const widthPct = Math.max(8, Math.round((cumulative / TOTAL_LIFT) * 100))
                    const label = String(index + 1).padStart(2, '0')
                    return (
                      <li key={index} className="flex items-center gap-3">
                        <span
                          className={`inline-flex h-5 w-8 shrink-0 items-center justify-center rounded-[3px] border font-mono text-[10.5px] font-medium tabular-nums transition-colors ${
                            isActive
                              ? 'border-clay-500 bg-clay-500 text-paper-50 dark:border-clay-400 dark:bg-clay-400 dark:text-paper-950'
                              : 'border-paper-300 bg-paper-100 text-ink-300 dark:border-paper-700 dark:bg-paper-800 dark:text-ink-300'
                          }`}
                        >
                          {label}
                        </span>
                        <div className="relative h-[10px] flex-1 overflow-hidden rounded-full bg-paper-200 dark:bg-paper-800">
                          <div
                            className={`h-full rounded-full transition-colors duration-300 ${
                              isActive ? 'bg-clay-500 dark:bg-clay-400' : 'bg-paper-300 dark:bg-paper-700'
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span
                          className={`w-12 text-right font-mono text-[11px] tabular-nums ${
                            isActive ? 'text-ink-900 dark:text-ink-50' : 'text-ink-300 dark:text-ink-300'
                          }`}
                        >
                          +{Math.round(cumulative * 100)}%
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
