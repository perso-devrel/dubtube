'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Search, X } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { cn } from '@/utils/cn'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'

import {
  REGION_LABELS,
  SUPPORTED_LANGUAGES,
  getLanguageByCode,
  type LanguageRegion,
} from '@/utils/languages'
import { useDubbingStore } from '../../store/dubbingStore'
import { useDashboardSummary } from '@/hooks/useDashboardData'
import { useI18nStore } from '@/stores/i18nStore'
import { getMetadataTargetLanguageCodes } from '@/lib/i18n/config'

type RegionFilter = 'all' | LanguageRegion
type LocaleText = ReturnType<typeof useLocaleText>

function countLocaleMessage(
  locale: ReturnType<typeof useAppLocale>,
  count: number,
  key: string,
  t: LocaleText,
) {
  const unit = t(key)
  return locale === 'ko' ? `${count}${unit}` : `${count} ${unit}`
}

export function LanguageSelectStep() {
  const {
    selectedLanguages,
    sourceLanguage,
    videoMeta,
    videoSource,
    existingCaptionLanguages,
    toggleLanguage,
    setSelectedLanguages,
    prevStep,
    nextStep,
  } = useDubbingStore()
  const metadataTargetPreset = useI18nStore((s) => s.metadataTargetPreset)
  const metadataTargetLanguages = useI18nStore((s) => s.metadataTargetLanguages)
  const locale = useAppLocale()
  const t = useLocaleText()

  // 내 영상 모드에서만 기존 자막 검사를 적용 — 외부 URL/업로드는 무시.
  const existingCaptionSet = useMemo(
    () => (videoSource?.type === 'channel' ? new Set(existingCaptionLanguages) : new Set<string>()),
    [videoSource?.type, existingCaptionLanguages],
  )

  // Settings에서 고른 희망 언어를 첫 진입 시 기본값으로 채운다.
  // 사용자가 명시적으로 비웠을 때 다시 채우지 않도록 단 한 번만 적용.
  const didInitializeRef = useRef(false)
  useEffect(() => {
    if (didInitializeRef.current) return
    if (selectedLanguages.length > 0) {
      didInitializeRef.current = true
      return
    }
    const defaults = getMetadataTargetLanguageCodes(metadataTargetPreset, metadataTargetLanguages)
      .filter((code) => code !== sourceLanguage && !existingCaptionSet.has(code))
    if (defaults.length === 0) return
    setSelectedLanguages(defaults)
    didInitializeRef.current = true
  }, [metadataTargetPreset, metadataTargetLanguages, selectedLanguages.length, sourceLanguage, existingCaptionSet, setSelectedLanguages])

  // 영상이 바뀌어 기존 자막 언어가 갱신되면 이미 선택된 항목 중 충돌하는 것을 제거.
  useEffect(() => {
    if (existingCaptionSet.size === 0) return
    if (selectedLanguages.length === 0) return
    const filtered = selectedLanguages.filter((code) => !existingCaptionSet.has(code))
    if (filtered.length !== selectedLanguages.length) setSelectedLanguages(filtered)
  }, [existingCaptionSet, selectedLanguages, setSelectedLanguages])

  const [region, setRegion] = useState<RegionFilter>('popular')
  const [query, setQuery] = useState('')
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary()
  const regionTabs: { id: RegionFilter; label: string }[] = useMemo(() => [
    { id: 'all', label: t('features.dubbing.components.steps.languageSelectStep.all') },
    { id: 'popular', label: locale === 'ko' ? REGION_LABELS.popular : 'Popular' },
    { id: 'asia', label: locale === 'ko' ? REGION_LABELS.asia : 'Asia' },
    { id: 'europe', label: locale === 'ko' ? REGION_LABELS.europe : 'Europe' },
    { id: 'middle-east', label: locale === 'ko' ? REGION_LABELS['middle-east'] : 'Middle East' },
  ], [locale, t])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SUPPORTED_LANGUAGES.filter((l) => {
      if (q) {
        return (
          l.code.toLowerCase().includes(q) ||
          l.name.toLowerCase().includes(q) ||
          l.nativeName.toLowerCase().includes(q)
        )
      }
      return region === 'all' ? true : l.region === region
    })
  }, [region, query])

  const videoMinutes = videoMeta
    ? Math.max(1, Math.ceil((videoMeta.durationMs || videoMeta.duration * 1000) / 60_000))
    : 0
  const estimatedMinutes = selectedLanguages.length * videoMinutes
  const remainingMinutes = summary ? Number(summary.credits_remaining) : null
  const remainingAfter = remainingMinutes === null ? null : remainingMinutes - estimatedMinutes
  const hasInsufficientMinutes = remainingAfter !== null && selectedLanguages.length > 0 && remainingAfter < 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Selected chips */}
      {selectedLanguages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedLanguages.map((code) => {
            const lang = getLanguageByCode(code)
            if (!lang) return null
            return (
              <button
                key={code}
                onClick={() => toggleLanguage(code)}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-500 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 transition hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-200 dark:hover:bg-brand-900/50"
              >
                <span>{lang.flag}</span>
                <span>{locale === 'ko' ? lang.nativeName : lang.name}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            )
          })}
        </div>
      )}

      {/* Search + region tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('features.dubbing.components.steps.languageSelectStep.searchLanguages')}
            className="w-full rounded-md border border-surface-300 bg-white py-2 pl-9 pr-9 text-sm text-surface-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-surface-700 dark:bg-surface-900 dark:text-white"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!query && (
          <div className="flex flex-wrap gap-2">
            {regionTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRegion(tab.id)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium transition',
                  region === tab.id
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-100 text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {existingCaptionSet.size > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200">
          {t('features.dubbing.components.steps.languageSelectStep.languagesWithExistingCaptionsDisabled', {
            count: existingCaptionSet.size,
          })}
        </div>
      )}

      {/* Language grid */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-surface-500 dark:text-surface-300">
          {t('features.dubbing.components.steps.languageSelectStep.noMatchingLanguages')}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {filtered.map((lang) => {
            const isSelected = selectedLanguages.includes(lang.code)
            const alreadyHasCaption = existingCaptionSet.has(lang.code)
            return (
              <button
                key={lang.code}
                onClick={() => {
                  if (alreadyHasCaption) return
                  toggleLanguage(lang.code)
                }}
                disabled={alreadyHasCaption}
                title={alreadyHasCaption
                  ? t('features.dubbing.components.steps.languageSelectStep.captionAlreadyExistsForThisLanguage')
                  : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
                  alreadyHasCaption
                    ? 'cursor-not-allowed border-surface-200 bg-surface-100 opacity-60 dark:border-surface-800 dark:bg-surface-800'
                    : isSelected
                      ? 'cursor-pointer border-brand-600 bg-brand-50 shadow-sm dark:bg-brand-900/20'
                      : 'cursor-pointer border-surface-200 bg-white hover:border-surface-300 dark:border-surface-800 dark:bg-surface-900 dark:hover:border-surface-700',
                )}
              >
                {isSelected && !alreadyHasCaption && (
                  <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check className="h-3 w-3" />
                  </div>
                )}
                {alreadyHasCaption && (
                  <div className="absolute -right-1.5 -top-1.5 rounded-full bg-surface-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {t('features.dubbing.components.steps.languageSelectStep.captionExistsBadge')}
                  </div>
                )}
                <span className="text-2xl">{lang.flag}</span>
                <span className="text-sm font-medium text-surface-900 dark:text-white">
                  {locale === 'ko' ? lang.nativeName : lang.name}
                </span>
                <span className="max-w-full truncate text-xs text-surface-500 dark:text-surface-400">
                  {locale === 'ko' ? lang.name : lang.nativeName}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Dub options */}
      <Card>
        <div className="space-y-2 rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
          <EstimateRow
            label={t('features.dubbing.components.steps.languageSelectStep.videoLengthRounded')}
            value={videoMinutes > 0
              ? countLocaleMessage(locale, videoMinutes, 'features.dubbing.components.steps.languageSelectStep.unitMin', t)
              : t('common.loading')}
          />
          <EstimateRow
            label={t('features.dubbing.components.steps.languageSelectStep.selectedLanguageCount')}
            value={countLocaleMessage(locale, selectedLanguages.length, 'features.dubbing.components.steps.languageSelectStep.unitSelected', t)}
          />
          <EstimateRow
            label={t('features.dubbing.components.steps.languageSelectStep.estimatedUsage')}
            value={countLocaleMessage(locale, estimatedMinutes, 'features.dubbing.components.steps.languageSelectStep.unitMin', t)}
            strong
          />
          <EstimateRow
            label={t('features.dubbing.components.steps.languageSelectStep.remainingDubbingTime')}
            value={summaryLoading
              ? t('common.loading')
              : remainingMinutes === null
                ? '-'
                : countLocaleMessage(locale, remainingMinutes, 'features.dubbing.components.steps.languageSelectStep.unitMin', t)}
          />
          {remainingAfter !== null && selectedLanguages.length > 0 && (
            <EstimateRow
              label={t('features.dubbing.components.steps.languageSelectStep.remainingAfterThisJob')}
              value={countLocaleMessage(locale, Math.max(0, remainingAfter), 'features.dubbing.components.steps.languageSelectStep.unitMin', t)}
              danger={hasInsufficientMinutes}
            />
          )}
          {hasInsufficientMinutes && (
            <p className="pt-1 text-xs text-red-600 dark:text-red-400">
              {t('features.dubbing.components.steps.languageSelectStep.notEnoughDubbingTime')}
            </p>
          )}
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={prevStep}>
          <ArrowLeft className="h-4 w-4" />
          {t('features.dubbing.components.steps.languageSelectStep.back')}
        </Button>
        <Button onClick={nextStep} disabled={selectedLanguages.length === 0 || hasInsufficientMinutes}>
          {t('features.dubbing.components.steps.languageSelectStep.nextChooseOutput')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function EstimateRow({
  label,
  value,
  strong,
  danger,
}: {
  label: string
  value: string
  strong?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-surface-600 dark:text-surface-400">{label}</span>
      <span className={cn(
        'whitespace-nowrap text-right',
        strong ? 'font-bold text-surface-900 dark:text-white' : 'font-medium text-surface-700 dark:text-surface-200',
        danger && 'text-red-600 dark:text-red-400',
      )}>
        {value}
      </span>
    </div>
  )
}
