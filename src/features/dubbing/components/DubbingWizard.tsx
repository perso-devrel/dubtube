'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useLocaleText } from '@/hooks/useLocaleText'
import { useDubbingStore } from '../store/dubbingStore'

function StepLoading() {
  return (
    <div className="min-h-[24rem] rounded-lg border border-surface-200 bg-white p-6 dark:border-surface-800 dark:bg-surface-900">
      <div className="h-6 w-40 animate-pulse rounded bg-surface-200 dark:bg-surface-800" />
      <div className="mt-6 space-y-3">
        <div className="h-10 animate-pulse rounded bg-surface-100 dark:bg-surface-850" />
        <div className="h-10 animate-pulse rounded bg-surface-100 dark:bg-surface-850" />
        <div className="h-24 animate-pulse rounded bg-surface-100 dark:bg-surface-850" />
      </div>
    </div>
  )
}

const VideoInputStep = dynamic(
  () => import('./steps/VideoInputStep').then((mod) => mod.VideoInputStep),
  { loading: StepLoading },
)
const OutputModeStep = dynamic(
  () => import('./steps/OutputModeStep').then((mod) => mod.OutputModeStep),
  { loading: StepLoading },
)
const LanguageSelectStep = dynamic(
  () => import('./steps/LanguageSelectStep').then((mod) => mod.LanguageSelectStep),
  { loading: StepLoading },
)
const UploadSettingsStep = dynamic(
  () => import('./steps/UploadSettingsStep').then((mod) => mod.UploadSettingsStep),
  { loading: StepLoading },
)
const TranslationEditStep = dynamic(
  () => import('./steps/TranslationEditStep').then((mod) => mod.TranslationEditStep),
  { loading: StepLoading },
)
const ProcessingStep = dynamic(
  () => import('./steps/ProcessingStep').then((mod) => mod.ProcessingStep),
  { loading: StepLoading },
)
const UploadStep = dynamic(
  () => import('./steps/UploadStep').then((mod) => mod.UploadStep),
  { loading: StepLoading },
)

const stepPreloaders: Record<number, () => Promise<unknown>> = {
  1: () => import('./steps/VideoInputStep'),
  2: () => import('./steps/LanguageSelectStep'),
  3: () => import('./steps/OutputModeStep'),
  4: () => import('./steps/UploadSettingsStep'),
  5: () => import('./steps/TranslationEditStep'),
  6: () => import('./steps/ProcessingStep'),
  7: () => import('./steps/UploadStep'),
}

const steps = [
  {
    num: 1,
    label: 'features.dubbing.components.dubbingWizard.labelVideo',
    description: 'features.dubbing.components.steps.videoInputStep.pasteAYouTubeLinkOrUploadAVideo',
  },
  {
    num: 2,
    label: 'features.dubbing.components.steps.languageSelectStep.chooseTargetLanguages',
    description: 'features.dubbing.components.steps.languageSelectStep.chooseTheLanguagesForYourOutput',
  },
  {
    num: 3,
    label: 'features.dubbing.components.steps.outputModeStep.chooseOutput',
    description: 'features.dubbing.components.steps.outputModeStep.chooseWhatYouWantToDoWithThe',
  },
  { num: 4, label: 'features.dubbing.components.dubbingWizard.labelPublishSettings' },
  {
    num: 5,
    label: 'features.dubbing.components.steps.translationEditStep.reviewSettings',
    description: 'features.dubbing.components.steps.translationEditStep.reviewUploadSettingsBeforeStartingDubbing',
  },
  { num: 6, label: 'features.dubbing.components.dubbingWizard.labelProcessing' },
  { num: 7, label: 'features.dubbing.components.dubbingWizard.labelResults' },
] satisfies Array<{ num: number; label: string; description?: string }>

function isFinishedProgressReason(reason: string) {
  return reason === 'COMPLETED' ||
    reason === 'Completed' ||
    reason === 'FAILED' ||
    reason === 'Failed' ||
    reason === 'CANCELED'
}

export function DubbingWizard() {
  const currentStep = useDubbingStore((s) => s.currentStep)
  const deliverableMode = useDubbingStore((s) => s.deliverableMode)
  const languageProgress = useDubbingStore((s) => s.languageProgress)
  const selectedLanguages = useDubbingStore((s) => s.selectedLanguages)
  const t = useLocaleText()
  const currentStepInfo = steps.find((step) => step.num === currentStep) ?? steps[0]
  const allProcessingFinished = languageProgress.length > 0 && languageProgress.every((p) => isFinishedProgressReason(p.progressReason))
  const completedLanguageCount = selectedLanguages.filter((code) => {
    const progress = languageProgress.find((p) => p.langCode === code)
    return progress?.progressReason === 'COMPLETED' || progress?.progressReason === 'Completed'
  }).length
  const failedLanguageCount = selectedLanguages.filter((code) => {
    const progress = languageProgress.find((p) => p.langCode === code)
    return progress?.progressReason === 'FAILED' || progress?.progressReason === 'Failed' || progress?.progressReason === 'CANCELED'
  }).length

  const stepTitle = currentStep === 6
    ? allProcessingFinished
      ? t('features.dubbing.components.steps.processingStep.processingComplete')
      : t('features.dubbing.components.steps.processingStep.processingVideo')
    : currentStep === 7
      ? failedLanguageCount > 0
        ? t('features.dubbing.components.steps.uploadStep.someLanguagesFinished')
        : t('features.dubbing.components.steps.uploadStep.dubbingFilesAreReady')
      : t(currentStepInfo.label)

  const stepDescription = currentStepInfo.description
    ? t(currentStepInfo.description)
    : currentStep === 4
      ? deliverableMode === 'originalWithMultiAudio'
        ? t('features.dubbing.components.steps.uploadSettingsStep.reviewTheSettingsBeforeAddingCaptionsToThe')
        : t('features.dubbing.components.steps.uploadSettingsStep.chooseHowTheFinishedDubbingShouldBeUploaded')
      : currentStep === 6
        ? allProcessingFinished
          ? t('features.dubbing.components.steps.processingStep.reviewTheFinishedFilesAndContinueWithThe')
          : deliverableMode === 'originalWithMultiAudio'
            ? t('features.dubbing.components.steps.processingStep.creatingCaptionsProcessingTimeDependsOnVideoLength')
            : t('features.dubbing.components.steps.processingStep.creatingCaptionsAndDubbedAudioProcessingTimeDepends')
        : currentStep === 7
          ? `${t('features.dubbing.components.steps.uploadStep.completedLanguageProgress', {
            completed: completedLanguageCount,
            total: selectedLanguages.length,
          })}${deliverableMode === 'downloadOnly'
            ? t('features.dubbing.components.steps.uploadStep.downloadTheFilesYouNeed')
            : deliverableMode === 'originalWithMultiAudio'
              ? t('features.dubbing.components.steps.uploadStep.youCanAddCaptionsToTheOriginalVideo')
              : t('features.dubbing.components.steps.uploadStep.downloadThemOrUploadToYouTube')}`
          : null

  useEffect(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    })
  }, [currentStep])

  useEffect(() => {
    const nextStep = currentStep + 1
    if (!stepPreloaders[nextStep]) return
    const id = window.setTimeout(() => {
      void stepPreloaders[nextStep]()
    }, 200)
    return () => window.clearTimeout(id)
  }, [currentStep])

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-surface-900 dark:text-white">
              {stepTitle}
            </p>
            {stepDescription && (
              <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">
                {stepDescription}
              </p>
            )}
          </div>
          <div className="shrink-0 rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-600 dark:bg-surface-800 dark:text-surface-300">
            {currentStep} / {steps.length}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5" aria-hidden="true">
          {steps.map(({ num }) => (
            <div
              key={num}
              className={`h-1.5 rounded-full transition-colors ${
                currentStep >= num
                  ? 'bg-brand-600'
                  : 'bg-surface-200 dark:bg-surface-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="animate-fade-in">
        {currentStep === 1 && <VideoInputStep />}
        {currentStep === 2 && <LanguageSelectStep />}
        {currentStep === 3 && <OutputModeStep />}
        {currentStep === 4 && <UploadSettingsStep />}
        {currentStep === 5 && <TranslationEditStep />}
        {currentStep === 6 && <ProcessingStep />}
        {currentStep === 7 && <UploadStep />}
      </div>
    </div>
  )
}
