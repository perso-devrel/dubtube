'use client'

import { useState } from 'react'
import { BarChart3, Globe2, TrendingUp } from 'lucide-react'
import { formatNumber } from '@/utils/formatters'
import { useLocaleText } from '@/hooks/useLocaleText'

const BASE_VIEWS = 100000

// 언어별 추가 조회수 기여율 (원본 조회수 대비).
// 앵커 데이터:
//  - YouTube 공식 (blog.youtube, 2023): 멀티오디오 적용 영상 평균 시청시간의 25%+ 가 비주력 언어
//    → 원본 대비 약 +33% 추가 도달
//  - Jamie Oliver: 멀티오디오로 조회수 3배 (+200%)
//  - AIR Media-Tech: 채널 간 오디오 교차 적용 시 +45%
//  - 국제 구독자 평균 +40%
// 위 매크로 데이터를 언어별로 분배한 추정치로, 화자 규모·YouTube 시장 점유율·시청 시간 비중을
// 반영해 도달률 내림차순 정렬했다. 단순 누적합 = 단조 증가 + 자연스러운 한계효용 감소.
// 정확한 채널별 측정값이 아니므로 UI에서 반드시 추정치임을 명시할 것.
const LANGUAGE_LIFT_RATES = [
  0.30, // 스페인어 (LATAM + 스페인, 공개 사례 중 가장 큰 단일 언어 효과)
  0.22, // 힌디어 (인도, YouTube 1위 시장)
  0.18, // 포르투갈어 (브라질, YouTube 상위 시장)
  0.14, // 아랍어 (MENA 권역)
  0.12, // 인도네시아어
  0.10, // 프랑스어 (프랑스 + 아프리카 프랑코폰)
  0.09, // 일본어
  0.08, // 독일어
  0.06, // 한국어
  0.04, // 중국어 (YouTube 접근성 제한)
]

export function ROICalculator() {
  const [selectedCount, setSelectedCount] = useState(5)
  const t = useLocaleText()

  const lift = LANGUAGE_LIFT_RATES.slice(0, selectedCount).reduce((a, b) => a + b, 0)
  const growthPct = Math.round(lift * 100)
  const projectedViews = Math.round(BASE_VIEWS * (1 + lift))
  const maxLift = LANGUAGE_LIFT_RATES.reduce((a, b) => a + b, 0)
  const languageBars = LANGUAGE_LIFT_RATES.reduce<Array<{ lift: number; active: boolean }>>((bars, rate, index) => {
    const previousLift = bars.at(-1)?.lift ?? 0
    return [
      ...bars,
      {
        lift: previousLift + rate,
        active: index < selectedCount,
      },
    ]
  }, [])

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-[0_1px_0_rgba(15,17,21,0.03)] dark:border-surface-800 dark:bg-surface-900">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-surface-200 p-8 dark:border-surface-800 lg:border-b-0 lg:border-r">
              <div className="mb-8 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-surface-200 bg-surface-50 text-brand-600 dark:border-surface-800 dark:bg-surface-850 dark:text-brand-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h2 className="max-w-md break-keep text-3xl font-semibold leading-tight text-surface-900 dark:text-white sm:text-4xl">
                {t('features.landing.rOICalculator.estimatedReachCalculator')}
              </h2>
              <p className="mt-5 max-w-lg break-keep text-base leading-7 text-surface-600 dark:text-surface-300">
                {t('features.landing.rOICalculator.aReferenceEstimateBasedOnPublicCasesAnd')}
              </p>
              <p className="mt-4 max-w-lg break-keep text-sm leading-6 text-surface-500 dark:text-surface-400">
                {t('features.landing.rOICalculator.actualPerformanceDependsOnContentThumbnailsUploadCadence')}
              </p>
            </div>

            <div className="p-5 sm:p-8">
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-5 dark:border-surface-800 dark:bg-surface-950">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor="roi-langs" className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                    {t('features.landing.rOICalculator.numberOfDubbingLanguages')}
                  </label>
                  <span className="rounded-full border border-surface-200 bg-white px-3 py-1 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:bg-surface-900 dark:text-white">
                    {t('features.landing.rOICalculator.value', { selectedCount: selectedCount })}
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
                  className="mt-6 w-full accent-brand-600"
                />
                <div className="mt-2 flex justify-between text-xs text-surface-500 dark:text-surface-400"><span>1</span><span>10</span></div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[0.72fr_1fr]">
                <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 dark:border-brand-900/50 dark:bg-brand-900/20">
                  <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
                    <TrendingUp className="h-4 w-4" />
                    {t('features.landing.rOICalculator.referenceEstimateForSelectedLanguages')}
                  </div>
                  <div className="mt-5 text-6xl font-semibold tracking-normal text-surface-900 dark:text-white">
                    +{growthPct}%
                  </div>
                  <div className="mt-4 text-sm leading-6 text-surface-600 dark:text-surface-300">
                    {t('features.landing.rOICalculator.from')}{' '}
                    <span className="font-semibold">{formatNumber(BASE_VIEWS)}{t('features.landing.rOICalculator.monthlyViews')}</span>{' '}
                    {t('features.landing.rOICalculator.toAnEstimated')}{' '}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatNumber(projectedViews)}{t('features.landing.rOICalculator.views')}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-950">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-surface-800 dark:text-surface-200">
                      <Globe2 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      {t('features.landing.rOICalculator.numberOfDubbingLanguages')}
                    </div>
                    <span className="text-xs text-surface-500 dark:text-surface-400">{t('features.landing.rOICalculator.value', { selectedCount: selectedCount })}</span>
                  </div>
                  <div className="flex h-36 items-end gap-2">
                    {languageBars.map(({ lift: barLift, active }, index) => (
                      <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="flex h-28 w-full items-end overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                          <div
                            className={`w-full rounded-full transition-all duration-300 ${
                              active ? 'bg-brand-600 dark:bg-brand-400' : 'bg-surface-300 dark:bg-surface-700'
                            }`}
                            style={{ height: `${Math.max(14, (barLift / maxLift) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-surface-400">{index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className="mt-4 break-keep text-xs leading-5 text-surface-500 dark:text-surface-400">
                {t('features.landing.rOICalculator.thisIsAReferenceEstimateFromPublicCases')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
