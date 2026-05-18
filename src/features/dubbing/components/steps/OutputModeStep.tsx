'use client'

import { useEffect, useMemo } from 'react'
import { ArrowLeft, ArrowRight, Film, Subtitles, Download, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'
import { useLocaleText } from '@/hooks/useLocaleText'
import { useLocaleRouter } from '@/hooks/useLocalePath'
import { useChannelStats } from '@/hooks/useYouTubeData'
import { useAuthStore } from '@/stores/authStore'
import { useDubbingStore } from '../../store/dubbingStore'
import type { DeliverableMode, VideoSourceType } from '../../types/dubbing.types'

interface DeliverableOption {
  value: DeliverableMode
  icon: typeof Film
  title: string
  description: string
  disabled?: boolean
  badge?: string
}

function getAvailableOptions(sourceType: VideoSourceType, youtubeUploadDisabled: boolean): DeliverableOption[] {
  const youtubeRequired = youtubeUploadDisabled
    ? {
      disabled: true,
      badge: 'features.dubbing.components.steps.outputModeStep.youtubeConnectionRequiredBadge',
    }
    : {}

  const options: DeliverableOption[] = [
    {
      value: 'newDubbedVideos',
      icon: Film,
      title: 'features.dubbing.components.steps.outputModeStep.titleCreateNewVideosForEachLanguage',
      description: 'features.dubbing.components.steps.outputModeStep.descriptionPrepareASeparateDubbedYouTubeVideoFor',
      ...youtubeRequired,
    },
  ]

  if (sourceType === 'channel') {
    options.push({
      value: 'originalWithMultiAudio',
      icon: Subtitles,
      title: 'features.dubbing.components.steps.outputModeStep.titleAddCaptionsToTheOriginalVideo',
      description: 'features.dubbing.components.steps.outputModeStep.descriptionAddTranslatedCaptionsTitlesAndDescriptionsTo',
      ...youtubeRequired,
    })
  } else if (sourceType === 'upload') {
    options.push({
      value: 'originalWithMultiAudio',
      icon: Subtitles,
      title: 'features.dubbing.components.steps.outputModeStep.titleUploadOriginalWithCaptions',
      description: 'features.dubbing.components.steps.outputModeStep.descriptionUploadTheOriginalVideoToYouTubeAnd',
      ...youtubeRequired,
    })
  }

  options.push({
    value: 'downloadOnly',
    icon: Download,
    title: 'features.dubbing.components.steps.outputModeStep.titleDownloadFilesOnly',
    description: 'features.dubbing.components.steps.outputModeStep.descriptionDownloadDubbedVideoAudioAndCaptionFiles',
  })

  return options
}

export function OutputModeStep() {
  const { deliverableMode, setDeliverableMode, videoSource, prevStep, nextStep } = useDubbingStore()
  const t = useLocaleText()
  const router = useLocaleRouter()
  const { data: channel, isLoading: channelLoading } = useChannelStats()
  const authLoading = useAuthStore((s) => s.isLoading)
  const sourceType = videoSource?.type ?? 'upload'
  const checkingYouTubeConnection = authLoading || channelLoading
  const youtubeUploadDisabled = !checkingYouTubeConnection && !channel
  const options = useMemo(() => getAvailableOptions(sourceType, youtubeUploadDisabled), [sourceType, youtubeUploadDisabled])
  const isExternalUrl = videoSource?.type === 'url'
  const needsYouTubeConnection = deliverableMode !== 'downloadOnly'
  const canContinue = !(checkingYouTubeConnection && needsYouTubeConnection)

  useEffect(() => {
    const selectedOption = options.find((o) => o.value === deliverableMode)
    if (selectedOption && !selectedOption.disabled) return

    const fallback = options.find((o) => !o.disabled)?.value ?? 'downloadOnly'
    if (fallback !== deliverableMode) setDeliverableMode(fallback)
  }, [options, deliverableMode, setDeliverableMode])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {isExternalUrl && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-300">{t('features.dubbing.components.steps.outputModeStep.copyrightNotice')}</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              {t('features.dubbing.components.steps.outputModeStep.reUploadingVideosYouDoNotOwnCan')}
            </p>
          </div>
        </div>
      )}

      {youtubeUploadDisabled && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-300">{t('features.dubbing.components.steps.outputModeStep.youtubeConnectionRequired')}</p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                {t('features.dubbing.components.steps.outputModeStep.connectYouTubeInSettingsToUpload')}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/settings?section=youtube')}>
            {t('features.dubbing.components.steps.outputModeStep.connectInSettings')}
          </Button>
        </div>
      )}

      <div className={cn('grid gap-4', options.length === 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2')}>
        {options.map(({ value, icon: Icon, title, description, disabled, badge }) => {
          const selected = deliverableMode === value && !disabled
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) setDeliverableMode(value)
              }}
              className={cn(
                'flex flex-col items-center gap-4 rounded-lg border-2 p-4 text-center transition-all sm:p-5',
                disabled && 'cursor-not-allowed opacity-60',
                !disabled && 'cursor-pointer',
                selected
                  ? 'border-brand-600 bg-brand-50 shadow-sm dark:bg-brand-900/10'
                  : disabled
                    ? 'border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-800/60'
                    : 'border-surface-200 bg-white hover:border-surface-300 dark:border-surface-700 dark:bg-surface-800 dark:hover:border-surface-600',
              )}
            >
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full',
                  selected
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400',
                )}
              >
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <p className={cn(
                    'text-base font-semibold leading-snug break-keep',
                    selected ? 'text-brand-700 dark:text-brand-300' : 'text-surface-900 dark:text-white',
                  )}>
                    {t(title)}
                  </p>
                  {badge && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      {t(badge)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-300 break-keep">{t(description)}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={prevStep}>
          <ArrowLeft className="h-4 w-4" />
          {t('features.dubbing.components.steps.outputModeStep.back')}
        </Button>
        <Button onClick={nextStep} disabled={!canContinue}>
          {deliverableMode === 'downloadOnly'
            ? t('features.dubbing.components.steps.outputModeStep.nextReviewSettings')
            : t('features.dubbing.components.steps.outputModeStep.nextUploadSettings')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
