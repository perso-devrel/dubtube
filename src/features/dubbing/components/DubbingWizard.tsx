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
  { num: 1, label: 'features.dubbing.components.dubbingWizard.labelVideo' },
  { num: 2, label: 'features.dubbing.components.dubbingWizard.labelLanguages' },
  { num: 3, label: 'features.dubbing.components.dubbingWizard.labelOutput' },
  { num: 4, label: 'features.dubbing.components.dubbingWizard.labelPublishSettings' },
  { num: 5, label: 'features.dubbing.components.dubbingWizard.labelReview' },
  { num: 6, label: 'features.dubbing.components.dubbingWizard.labelProcessing' },
  { num: 7, label: 'features.dubbing.components.dubbingWizard.labelResults' },
] satisfies Array<{ num: number; label: string }>

export function DubbingWizard() {
  const currentStep = useDubbingStore((s) => s.currentStep)
  const t = useLocaleText()
  const currentStepInfo = steps.find((step) => step.num === currentStep) ?? steps[0]

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
            <p className="text-xs font-medium text-surface-500 dark:text-surface-400">
              {currentStep} / {steps.length}
            </p>
            <p className="mt-1 truncate text-base font-semibold text-surface-900 dark:text-white">
              {t(currentStepInfo.label)}
            </p>
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
