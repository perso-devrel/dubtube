'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Puzzle, Upload, AlertCircle, ExternalLink, CheckCircle, XCircle, Loader2, Download } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { getLanguageByCode } from '@/utils/languages'
import { useNotificationStore } from '@/stores/notificationStore'
import { useExtensionDetect, sendToExtension } from '@/hooks/useExtensionDetect'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'

interface Props {
  videoId: string
  completedLangs: string[]
  getAudioUrl: (langCode: string) => Promise<string | undefined>
  autoTrigger?: boolean
}

const INSTALL_GUIDE_URL = 'https://github.com/perso-devrel/sub2tube/blob/main/extension/README.md'
const POLL_INTERVAL = 3000

type JobStatus = 'pending' | 'running' | 'done' | 'error'

interface ExtJob {
  jobId: string
  videoId: string
  languageCode: string
  status: JobStatus
  step?: string
  error?: string
}

interface LangJobState {
  jobId: string
  status: JobStatus
  step?: string
  error?: string
}

const STEP_LABELS: Record<string, string> = {
  NAVIGATING: 'extension.step.navigating',
  OPENING_LANGUAGES: 'extension.step.openingLanguages',
  SELECTING_LANGUAGE: 'extension.step.selectingLanguage',
  INJECTING_AUDIO: 'extension.step.injectingAudio',
  WAITING_PUBLISH: 'extension.step.waitingPublish',
  PUBLISHING: 'extension.step.publishing',
  COMPLETED: 'extension.step.completed',
}

const STEP_ALIASES: Record<string, string> = {
  OPENING_TRANSLATIONS: 'OPENING_LANGUAGES',
  OPENING_TRANSLATION_PAGE: 'OPENING_LANGUAGES',
  CHECKING_TRANSLATIONS: 'OPENING_LANGUAGES',
  ADDING_LANGUAGE: 'SELECTING_LANGUAGE',
  SELECT_LANGUAGE: 'SELECTING_LANGUAGE',
  LANGUAGE_SELECT: 'SELECTING_LANGUAGE',
  DOWNLOADING_AUDIO: 'INJECTING_AUDIO',
  ADDING_AUDIO: 'INJECTING_AUDIO',
  AUDIO_INJECTING: 'INJECTING_AUDIO',
  WAITING_FOR_PUBLISH: 'WAITING_PUBLISH',
  PUBLISH_READY: 'WAITING_PUBLISH',
  PUBLISHED: 'COMPLETED',
  DONE: 'COMPLETED',
}

function normalizeStep(step: string) {
  const normalized = step.trim().replace(/[\s-]+/g, '_').toUpperCase()
  return STEP_ALIASES[normalized] ?? normalized
}

export function YouTubeExtensionUpload({ videoId, completedLangs, getAudioUrl, autoTrigger = false }: Props) {
  const { status: extensionStatus, version, recheck } = useExtensionDetect()
  const locale = useAppLocale()
  const t = useLocaleText()
  const [uploadingLang, setUploadingLang] = useState<string | null>(null)
  const [langJobs, setLangJobs] = useState<Record<string, LangJobState>>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoTriggered = useRef(false)
  const loggedExtensionErrors = useRef<Set<string>>(new Set())
  const addToast = useNotificationStore((s) => s.addToast)

  const getDisplayLanguageName = useCallback((langCode: string) => {
    const lang = getLanguageByCode(langCode)
    if (!lang) return langCode
    return locale === 'ko' ? lang.nativeName : lang.name
  }, [locale])

  const getStepLabel = useCallback((step?: string) => {
    if (!step) return t('features.dubbing.components.youTubeExtensionUpload.inProgress')
    const label = STEP_LABELS[normalizeStep(step)]
    return label ? t(label) : t('features.dubbing.components.youTubeExtensionUpload.inProgress2')
  }, [t])

  const pollJobs = useCallback(async () => {
    try {
      const response = await sendToExtension({ type: 'GET_JOBS' }) as { ok: boolean; jobs?: ExtJob[] }
      if (!response.ok || !response.jobs) return

      const updated: Record<string, LangJobState> = {}
      for (const job of response.jobs) {
        if (job.videoId === videoId) {
          if (job.error) {
            const errorKey = `${job.jobId}:${job.error}`
            if (!loggedExtensionErrors.current.has(errorKey)) {
              loggedExtensionErrors.current.add(errorKey)
              console.warn('[sub2tube] Extension upload error', {
                jobId: job.jobId,
                languageCode: job.languageCode,
                step: job.step,
                error: job.error,
              })
            }
          }
          updated[job.languageCode] = {
            jobId: job.jobId,
            status: job.status,
            step: job.step,
            error: job.error,
          }
        }
      }
      if (Object.keys(updated).length > 0) {
        setLangJobs((prev) => ({ ...prev, ...updated }))
      }
    } catch {
      // extension unavailable — stop polling
    }
  }, [videoId])

  useEffect(() => {
    const hasActiveJobs = Object.values(langJobs).some(
      (j) => j.status === 'pending' || j.status === 'running',
    )
    if (hasActiveJobs && extensionStatus === 'installed') {
      pollRef.current = setInterval(pollJobs, POLL_INTERVAL)
      return () => {
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [langJobs, extensionStatus, pollJobs])

  const handleExtensionUpload = useCallback(async (langCode: string) => {
    const lang = getLanguageByCode(langCode)
    if (!lang) return

    setUploadingLang(langCode)
    try {
      const audioUrl = await getAudioUrl(langCode)
      if (!audioUrl) {
        addToast({ type: 'error', title: t('features.dubbing.components.youTubeExtensionUpload.couldNotPrepareTheAudioFile') })
        return
      }

      const response = await sendToExtension({
        type: 'UPLOAD_TO_YOUTUBE',
        payload: { videoId, languageCode: langCode, audioUrl, mode: 'assisted' },
      }) as { ok: boolean; jobId?: string; error?: string }

      if (response.ok && response.jobId) {
        setLangJobs((prev) => ({
          ...prev,
          [langCode]: { jobId: response.jobId!, status: 'running' },
        }))
      } else {
        if (response.error) {
          console.warn('[sub2tube] Extension upload request failed', response.error)
        }
        addToast({
          type: 'error',
          title: t('features.dubbing.components.youTubeExtensionUpload.audioTrackUploadFailed'),
          message: t('features.dubbing.components.youTubeExtensionUpload.tryAgainShortlyOrAddItManually'),
        })
      }
    } catch (err) {
      console.warn('[sub2tube] Extension connection failed', err)
      addToast({
        type: 'error',
        title: t('features.dubbing.components.youTubeExtensionUpload.extensionConnectionFailed'),
        message: t('features.dubbing.components.youTubeExtensionUpload.checkThatTheChromeExtensionIsEnabled'),
      })
    } finally {
      setUploadingLang(null)
    }
  }, [videoId, getAudioUrl, addToast, t])

  // Auto-trigger: sequentially upload all languages without user clicking
  useEffect(() => {
    if (!autoTrigger || autoTriggered.current) return
    if (extensionStatus !== 'installed') return
    if (completedLangs.length === 0) return
    autoTriggered.current = true

    const runAll = async () => {
      for (const code of completedLangs) {
        if (langJobs[code]?.status === 'done') continue
        await handleExtensionUpload(code)
      }
    }
    runAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrigger, extensionStatus, completedLangs.length])

  if (extensionStatus === 'checking') return null

  if (extensionStatus === 'not-installed') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-paper-300 p-3 dark:border-paper-700">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-ink-500 dark:text-ink-200" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-600 dark:text-ink-100">
            {t('features.dubbing.components.youTubeExtensionUpload.chromeExtensionRequired')}
          </p>
          <p className="mb-2 text-xs text-ink-500 dark:text-ink-200">
            {t('features.dubbing.components.youTubeExtensionUpload.installTheExtensionToAddAudioTracksIn')}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(INSTALL_GUIDE_URL, '_blank')}>
              <ExternalLink className="h-3 w-3" />
              {t('features.dubbing.components.youTubeExtensionUpload.installGuide')}
            </Button>
            <Button variant="ghost" size="sm" onClick={recheck}>
              {t('features.dubbing.components.youTubeExtensionUpload.checkAgain')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Puzzle className="h-4 w-4 text-clay-500" />
        <span className="text-sm font-medium text-ink-600 dark:text-ink-200">
          {t('features.dubbing.components.youTubeExtensionUpload.audioTrackAssistant')}
        </span>
        <Badge variant="success">{t('features.dubbing.components.youTubeExtensionUpload.connected')}{version ? ` v${version}` : ''}</Badge>
      </div>
      <p className="mb-3 text-xs text-ink-500 dark:text-ink-200">
        {t('features.dubbing.components.youTubeExtensionUpload.theChromeExtensionOpensYouTubeStudioAndAdds')}
      </p>
      {completedLangs.map((code) => {
        const lang = getLanguageByCode(code)
        if (!lang) return null
        const job = langJobs[code]

        return (
          <div
            key={code}
            className="flex items-center justify-between rounded-lg border border-paper-200 p-3 dark:border-paper-800"
          >
            <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg">{lang.flag}</span>
                <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{getDisplayLanguageName(code)}</p>
                {job?.status === 'running' && (
                  <p className="text-xs text-clay-500">
                    {getStepLabel(job.step)}
                  </p>
                )}
                {job?.status === 'done' && (
                  <p className="text-xs text-emerald-600">{t('features.dubbing.components.youTubeExtensionUpload.audioTrackAdded')}</p>
                )}
                {job?.status === 'error' && (
                  <div>
                    <p className="text-xs text-red-500">{t('features.dubbing.components.youTubeExtensionUpload.autoAddFailed')}</p>
                    <p className="text-[10px] text-red-400">
                      {t('features.dubbing.components.youTubeExtensionUpload.uploadCouldNotBeCompletedPleaseCheckIn')}
                    </p>
                    {job.step && (
                      <p className="text-[10px] text-red-400">
                        {t('features.dubbing.components.youTubeExtensionUpload.stoppedAt')}: {getStepLabel(job.step)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {job?.status === 'done' ? (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            ) : job?.status === 'running' || job?.status === 'pending' ? (
              <Loader2 className="h-5 w-5 animate-spin text-clay-500" />
            ) : job?.status === 'error' ? (
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExtensionUpload(code)}
                    disabled={uploadingLang !== null}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {t('features.dubbing.components.youTubeExtensionUpload.retry')}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const url = await getAudioUrl(code)
                      if (url) window.open(url, '_blank')
                    }}
                  >
                    <Download className="h-3 w-3" />
                    {t('features.dubbing.components.youTubeExtensionUpload.downloadAudio')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `https://studio.youtube.com/video/${videoId}/translations`,
                        '_blank',
                      )
                    }
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t('features.dubbing.components.youTubeExtensionUpload.openStudio')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleExtensionUpload(code)}
                loading={uploadingLang === code}
                disabled={uploadingLang !== null}
              >
                <Upload className="h-3.5 w-3.5" />
                {t('features.dubbing.components.youTubeExtensionUpload.autoAdd')}
              </Button>
            )}
          </div>
        )
      })}

      {Object.values(langJobs).some((j) => j.status === 'error') && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-900/10 dark:border-amber-800">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
            {t('features.dubbing.components.youTubeExtensionUpload.addManually')}
          </p>
          <ol className="text-xs text-amber-700 dark:text-amber-400 list-decimal list-inside space-y-0.5">
            <li>{t('features.dubbing.components.youTubeExtensionUpload.downloadTheAudioFile')}</li>
            <li>{t('features.dubbing.components.youTubeExtensionUpload.openTheTranslationsPageInYouTubeStudio')}</li>
            <li>{t('features.dubbing.components.youTubeExtensionUpload.addTheFileToTheAudioTrackFor')}</li>
          </ol>
        </div>
      )}
    </div>
  )
}
