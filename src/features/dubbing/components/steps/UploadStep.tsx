'use client'

import { Download, Check, RotateCcw, Upload, Loader2 } from 'lucide-react'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Button, Card, CardTitle, Badge, Progress } from '@/components/ui'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'
import { useLocaleRouter } from '@/hooks/useLocalePath'
import { getLanguageByCode } from '@/utils/languages'
import { extractVideoId } from '@/utils/validators'
import { useNotificationStore } from '@/stores/notificationStore'
import { useDubbingStore } from '../../store/dubbingStore'
import { usePersoFlow } from '../../hooks/usePersoFlow'
import { useAuthStore } from '@/stores/authStore'
import {
  ytUploadVideo,
  ytUploadCaption,
  ytFetchVideoMetadata,
  ytUpdateVideoLocalizations,
  getPersoFileUrl,
  getTranslatedSrt,
  translateMetadata,
  type MetadataTranslation,
} from '@/lib/api-client'
import { toBcp47 } from '@/utils/languages'
import { dbMutationStrict } from '@/lib/api/dbMutation'
import { SubtitleScriptEditor } from '../SubtitleScriptEditor'
import { appendAiDisclosureFooter, appendTextFooter, stripAiDisclosureFooter } from '../../utils/aiDisclosure'
import type { YouTubeUploadState } from '../../types/dubbing.types'
import { resolveCaptionTrackName } from '@/lib/youtube/captions'
import { effectivePrivacyStatus } from '@/lib/youtube/publish-schedule'
import { cn } from '@/utils/cn'

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

type JobLanguageUploadStatusResponse = {
  jobId: number
  originalYouTubeUrl: string | null
  languages: {
    languageCode: string
    youtubeVideoId: string | null
    youtubeUploadStatus: string | null
    originalCaptionUploaded?: boolean
    originalCaptionVideoId?: string | null
  }[]
}

function isYouTubeUploadLocked(state: YouTubeUploadState | undefined) {
  return state?.status === 'uploading' || state?.status === 'done'
}

export function UploadStep() {
  const {
    selectedLanguages, videoMeta, videoSource, languageProgress, dbJobId,
    spaceSeq, projectMap, youtubeUploads: ytUploads, setYouTubeUploadState,
    uploadSettings, deliverableMode, originalVideoUrl, isShort, reset,
  } = useDubbingStore()
  const { fetchDownloads } = usePersoFlow()
  const addToast = useNotificationStore((s) => s.addToast)
  const router = useLocaleRouter()
  const locale = useAppLocale()
  const t = useLocaleText()

  const originalYouTubeId =
    videoSource?.type === 'url' && videoSource.url ? extractVideoId(videoSource.url) : null
  const channelVideoId = videoSource?.type === 'channel' ? videoSource.videoId : null
  const originalYouTubeUrl = originalYouTubeId
    ? `https://www.youtube.com/watch?v=${originalYouTubeId}`
    : null

  const {
    autoUpload,
    attachOriginalLink,
    title: settingsTitle,
    description: settingsDescription,
    tags: settingsTags,
    categoryId,
    privacyStatus,
    publishAt,
    notifySubscribers,
    thumbnailUrl,
    playlistIds,
    metadataLanguage,
    uploadCaptions: uploadCaptionsEnabled,
    selfDeclaredMadeForKids,
    containsSyntheticMedia,
    uploadReviewConfirmed,
  } = uploadSettings
  const editableDescription = stripAiDisclosureFooter(settingsDescription || '')
  const uploadPrivacyStatus = effectivePrivacyStatus(privacyStatus, publishAt)
  const shouldUploadCaptions = autoUpload && uploadCaptionsEnabled
  const shouldApplyAiDisclosure = deliverableMode === 'newDubbedVideos' && containsSyntheticMedia
  const videoMetaTitle = videoMeta?.title

  const [loadingDownload, setLoadingDownload] = useState<string | null>(null)
  const [captionUploads, setCaptionUploads] = useState<Record<string, UploadStatus>>({})
  const allowDialogueEditingInOutput = deliverableMode !== 'originalWithMultiAudio'
  const autoChainTriggered = useRef(false)
  const existingVideoMetadataSyncRef = useRef<Set<string>>(new Set())
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const videoSourceType = videoSource?.type
  const getDisplayLanguageName = useCallback((langCode: string) => {
    const language = getLanguageByCode(langCode)
    if (!language) return langCode
    return locale === 'ko' ? language.nativeName : language.name
  }, [locale])
  // ─── Metadata translations (Gemini) ─────────────────────────────────
  // Upload Step에 진입한 시점의 (title, description, metadataLanguage, selectedLanguages) 조합으로
  // 한 번 번역해두고 캐시. 모든 언어별 업로드와 localizations에서 공용으로 쓴다.
  // AI 고지 문구는 Gemini에 보내지 않고, 번역 후 로컬 문구 목록에서 언어별로 붙인다.
  // 실패해도 fallback으로 원문이 들어가도록 처리되어 업로드를 막지 않는다.
  const [translations, setTranslations] = useState<Record<string, MetadataTranslation>>({})
  const translatePromiseRef = useRef<Promise<Record<string, MetadataTranslation>> | null>(null)
  const translationCacheKeyRef = useRef<string | null>(null)
  const ensureTranslations = useCallback(async (): Promise<Record<string, MetadataTranslation>> => {
    const cacheKey = JSON.stringify({
      title: settingsTitle?.trim() || videoMeta?.title || '',
      description: editableDescription,
      metadataLanguage,
      selectedLanguages,
    })
    if (translationCacheKeyRef.current === cacheKey && Object.keys(translations).length > 0) {
      return translations
    }
    if (translatePromiseRef.current) return translatePromiseRef.current

    const baseTitle = settingsTitle?.trim() || videoMeta?.title || t('features.dubbing.components.steps.uploadStep.dubbedVideo')
    if (!baseTitle || selectedLanguages.length === 0) return {}
    translationCacheKeyRef.current = cacheKey

    const p = (async () => {
      try {
        const result = await translateMetadata({
          title: baseTitle,
          description: editableDescription,
          sourceLang: metadataLanguage || 'ko',
          targetLangs: selectedLanguages,
        })
        setTranslations(result)
        return result
      } catch (err) {
        // 실패 시 모든 언어를 원문으로 fallback. 사용자에게는 toast로 1회 안내.
        const fallback: Record<string, MetadataTranslation> = {}
        for (const code of selectedLanguages) {
          fallback[code] = { title: baseTitle, description: editableDescription }
        }
        setTranslations(fallback)
        addToast({
          type: 'warning',
          title: t('features.dubbing.components.steps.uploadStep.titleAndDescriptionTranslationFailed'),
          message: err instanceof Error ? err.message : t('features.dubbing.components.steps.uploadStep.uploadingWithTheOriginalTitleAndDescription'),
        })
        return fallback
      } finally {
        translatePromiseRef.current = null
      }
    })()
    translatePromiseRef.current = p
    return p
  }, [translations, settingsTitle, videoMeta?.title, editableDescription, metadataLanguage, selectedLanguages, addToast, t])

  // Original video upload state (for upload + originalWithMultiAudio)
  const [originalUploadState, setOriginalUploadState] = useState<{
    status: 'idle' | 'uploading' | 'done' | 'skipped'
    videoId?: string
    error?: string
  }>({ status: videoSource?.type === 'channel' ? 'skipped' : 'idle' })
  const serverUploadStatusKey = `${dbJobId ?? 'none'}:${deliverableMode}`
  const [serverUploadStatusLoadedKey, setServerUploadStatusLoadedKey] = useState<string | null>(null)
  const serverUploadStatusLoaded = serverUploadStatusLoadedKey === serverUploadStatusKey

  // Resolve the target videoId for multi-audio
  const multiAudioVideoId =
    originalUploadState.videoId || channelVideoId || null

  const syncServerUploadStatus = useCallback(async (): Promise<JobLanguageUploadStatusResponse | null> => {
    await Promise.resolve()

    if (!dbJobId) {
      setServerUploadStatusLoadedKey(serverUploadStatusKey)
      return null
    }

    try {
      const res = await fetch(`/api/dashboard/job-language-status?jobId=${dbJobId}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error?.message || 'status_check_failed')

      const data = json.data as JobLanguageUploadStatusResponse
      const persistedOriginalVideoId = data.originalYouTubeUrl ? extractVideoId(data.originalYouTubeUrl) : null
      if (persistedOriginalVideoId) {
        setOriginalUploadState({ status: 'done', videoId: persistedOriginalVideoId })
      }

      for (const item of data.languages) {
        const languageUploadDone = Boolean(item.youtubeVideoId || item.youtubeUploadStatus === 'uploaded')
        if (deliverableMode === 'newDubbedVideos') {
          if (languageUploadDone) {
            setYouTubeUploadState(item.languageCode, {
              status: 'done',
              progress: 100,
              videoId: item.youtubeVideoId || undefined,
            })
          } else if (item.youtubeUploadStatus === 'failed') {
            setYouTubeUploadState(item.languageCode, {
              status: 'error',
              progress: 0,
              error: t('features.dubbing.components.steps.uploadStep.couldNotCompleteTheYouTubeUploadPleaseTry'),
            })
          }
        }

        if (
          item.originalCaptionUploaded ||
          (deliverableMode === 'originalWithMultiAudio' && languageUploadDone)
        ) {
          setCaptionUploads((prev) => ({ ...prev, [item.languageCode]: 'done' }))
        }
      }

      return data
    } catch (err) {
      console.warn('[sub2tube] Could not check YouTube upload status', err)
      return null
    } finally {
      setServerUploadStatusLoadedKey(serverUploadStatusKey)
    }
  }, [dbJobId, deliverableMode, serverUploadStatusKey, setYouTubeUploadState, t])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void syncServerUploadStatus()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [syncServerUploadStatus])

  /** 번역되었거나 원문인 description에 공통 footer를 붙여 준다. AI 고지는 더빙 영상 업로드에만 붙인다. */
  const applyDescriptionFooter = useCallback(
    (desc: string, languageCode: string) => {
      let next = stripAiDisclosureFooter(desc)
      if (attachOriginalLink && originalYouTubeUrl) {
        next = appendTextFooter(next, `${t('features.dubbing.components.steps.uploadStep.originalVideo')}: ${originalYouTubeUrl}`)
      }
      return appendAiDisclosureFooter(next, languageCode, shouldApplyAiDisclosure)
    },
    [attachOriginalLink, originalYouTubeUrl, shouldApplyAiDisclosure, t],
  )

  const applyMetadataToExistingVideo = useCallback(async (targetVideoId: string) => {
    if (!isAuthenticated) return

    const requestedTags = Array.from(new Set(settingsTags.map((tag) => tag.trim()).filter(Boolean)))

    // selectedLanguages별 번역을 localizations 맵으로 변환. 번역 캐시 사용.
    // 원본 제목/설명은 건드리지 않고 localizations에만 추가한다.
    const allTranslations = await ensureTranslations()
    const newLocalizations: Record<string, { title: string; description: string }> = {}
    for (const code of selectedLanguages) {
      const t = allTranslations[code]
      if (t) {
        newLocalizations[toBcp47(code)] = {
          title: t.title,
          description: applyDescriptionFooter(t.description, code),
        }
      }
    }

    const localizationKey = Object.keys(newLocalizations).sort().join(',')
    const syncKey = `${targetVideoId}:${requestedTags.join('\n')}:${localizationKey}`
    if (existingVideoMetadataSyncRef.current.has(syncKey)) return
    existingVideoMetadataSyncRef.current.add(syncKey)

    try {
      const requestedSourceLang = toBcp47(metadataLanguage)
      const metadata = await ytFetchVideoMetadata(targetVideoId, requestedSourceLang)
      const mergedTags = requestedTags.length === 0
        ? metadata.tags
        : Array.from(new Set([...metadata.tags, ...requestedTags]))
      const mergedLocalizations = { ...metadata.localizations, ...newLocalizations }

      const tagsChanged =
        mergedTags.length !== metadata.tags.length ||
        mergedTags.some((tag, index) => tag !== metadata.tags[index])
      const localizationsChanged = Object.entries(newLocalizations).some(([lang, next]) => {
        const existing = metadata.localizations[lang]
        return !existing || existing.title !== next.title || existing.description !== next.description
      })
      if (!tagsChanged && !localizationsChanged) return

      // 원본 제목/설명은 그대로 유지 — localizations와 tags만 갱신.
      await ytUpdateVideoLocalizations({
        videoId: targetVideoId,
        sourceLang: metadata.resolvedLanguage || metadata.defaultLanguage || requestedSourceLang,
        title: metadata.title || settingsTitle?.trim() || videoMetaTitle || t('features.dubbing.components.steps.uploadStep.untitled'),
        description: metadata.description,
        tags: mergedTags,
        localizations: mergedLocalizations,
      })
    } catch (err) {
      addToast({
        type: 'warning',
        title: t('features.dubbing.components.steps.uploadStep.couldNotUpdateYouTubeTitleAndDescription'),
        message: err instanceof Error ? err.message : t('features.dubbing.components.steps.uploadStep.captionUploadWillContinue'),
      })
    }
  }, [
    addToast,
    applyDescriptionFooter,
    ensureTranslations,
    isAuthenticated,
    metadataLanguage,
    selectedLanguages,
    settingsTags,
    settingsTitle,
    t,
    videoMetaTitle,
  ])

  const handleNewDubbing = () => reset()
  const handleGoToDashboard = () => { reset(); router.push('/dashboard') }

  // ─── Original video upload (for upload + originalWithMultiAudio) ──────
  const uploadOriginalToYouTube = useCallback(async () => {
    if (!isAuthenticated) return null

    const cachedVideoId = originalUploadState.videoId
    if (!cachedVideoId && !originalVideoUrl) return null

    if (!cachedVideoId && dbJobId) {
      const serverStatus = await syncServerUploadStatus()
      const persistedOriginalVideoId = serverStatus?.originalYouTubeUrl
        ? extractVideoId(serverStatus.originalYouTubeUrl)
        : null
      if (persistedOriginalVideoId) {
        setOriginalUploadState({ status: 'done', videoId: persistedOriginalVideoId })
        return persistedOriginalVideoId
      }
    }

    setOriginalUploadState({ status: 'uploading', videoId: cachedVideoId })
    try {
      const persistOriginalVideoId = async (youtubeVideoId: string) => {
        if (!dbJobId) {
          throw new Error(t('features.dubbing.components.steps.uploadStep.couldNotSaveTheUploadedOriginalVideoPleaseTry'))
        }
        await dbMutationStrict({
          type: 'updateDubbingJobOriginalYouTubeUrl',
          payload: {
            jobId: dbJobId,
            originalYouTubeUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
          },
        })
      }

      if (cachedVideoId) {
        await persistOriginalVideoId(cachedVideoId)
        setOriginalUploadState({ status: 'done', videoId: cachedVideoId })
        return cachedVideoId
      }

      if (!originalVideoUrl) return null
      // 다국어 자막 모드는 영상 1개에 localizations 맵을 함께 보내 YouTube가 시청자
      // 로케일에 맞춰 제목·설명을 보여주도록 한다.
      const allTranslations = await ensureTranslations()
      const localizations: Record<string, { title: string; description: string }> = {}
      for (const code of selectedLanguages) {
        const t = allTranslations[code]
        if (t) {
          localizations[toBcp47(code)] = {
            title: t.title,
            description: applyDescriptionFooter(t.description, code),
          }
        }
      }

      const result = await ytUploadVideo({
        videoUrl: originalVideoUrl,
        title: settingsTitle?.trim() || videoMeta?.title || t('features.dubbing.components.steps.uploadStep.originalVideo2'),
        description: applyDescriptionFooter(editableDescription, metadataLanguage),
        tags: settingsTags,
        categoryId,
        privacyStatus: uploadPrivacyStatus,
        publishAt,
        notifySubscribers,
        selfDeclaredMadeForKids,
        containsSyntheticMedia: shouldApplyAiDisclosure,
        language: toBcp47(metadataLanguage),
        thumbnailUrl,
        playlistIds,
        localizations: Object.keys(localizations).length > 0 ? localizations : undefined,
      })
      setOriginalUploadState({ status: 'uploading', videoId: result.videoId })
      await persistOriginalVideoId(result.videoId)
      setOriginalUploadState({ status: 'done', videoId: result.videoId })
      return result.videoId
    } catch (err) {
      console.warn('[sub2tube] Original video upload failed', err)
      const msg = err instanceof Error
        ? err.message
        : t('features.dubbing.components.steps.uploadStep.couldNotCompleteTheOriginalVideoUploadPlease')
      setOriginalUploadState((current) => ({ status: 'idle', videoId: current.videoId ?? cachedVideoId, error: msg }))
      addToast({ type: 'error', title: t('features.dubbing.components.steps.uploadStep.originalUploadFailed'), message: msg })
      return null
    }
  }, [isAuthenticated, originalUploadState.videoId, originalVideoUrl, dbJobId, syncServerUploadStatus, settingsTitle, editableDescription, settingsTags, categoryId, uploadPrivacyStatus, publishAt, notifySubscribers, selfDeclaredMadeForKids, shouldApplyAiDisclosure, thumbnailUrl, playlistIds, videoMeta, addToast, ensureTranslations, selectedLanguages, metadataLanguage, applyDescriptionFooter, t])

  // ─── File download ──────────────────────────────────────────────────
  const handleDownload = useCallback(async (langCode: string, type: 'video' | 'voiceAudio' | 'translatedSubtitle') => {
    setLoadingDownload(`${langCode}-${type}`)
    try {
      const lang = getLanguageByCode(langCode)

      if (type === 'translatedSubtitle') {
        const pSeq = projectMap[langCode]
        if (!pSeq || !spaceSeq) return
        const srtContent = await getTranslatedSrt(pSeq, spaceSeq, 'translated')
        const blob = new Blob([srtContent], { type: 'application/x-subrip;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${lang?.name || langCode}_${langCode}.srt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        return
      }

      const target = type === 'video' ? 'dubbingVideo' : 'voiceAudio'
      const data = await fetchDownloads(langCode, target as 'all')
      if (!data) return

      let rawUrl: string | undefined
      if (type === 'video' && data.videoFile?.videoDownloadLink) rawUrl = data.videoFile.videoDownloadLink
      else if (type === 'voiceAudio' && data.audioFile?.voiceAudioDownloadLink) rawUrl = data.audioFile.voiceAudioDownloadLink
      else if (data.zippedFileDownloadLink) rawUrl = data.zippedFileDownloadLink

      if (rawUrl) {
        const fullUrl = rawUrl.startsWith('http') ? rawUrl : getPersoFileUrl(rawUrl)
        const ext = type === 'video' ? 'mp4' : 'wav'
        const a = document.createElement('a')
        a.href = fullUrl
        a.download = `${lang?.name || langCode}_${langCode}.${ext}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } finally {
      setLoadingDownload(null)
    }
  }, [fetchDownloads, projectMap, spaceSeq])

  // ─── Upload dubbed video to YouTube (newDubbedVideos mode) ──────────
  const handleYouTubeUpload = useCallback(async (langCode: string, processNow = true) => {
    const existingUpload = useDubbingStore.getState().youtubeUploads[langCode]
    if (isYouTubeUploadLocked(existingUpload)) return

    if (!isAuthenticated) {
      addToast({ type: 'error', title: t('features.dubbing.components.steps.uploadStep.pleaseSignInToYouTubeFirst') })
      return
    }

    if (!getLanguageByCode(langCode)) return

    if (!dbJobId) return

    const serverStatus = await syncServerUploadStatus()
    const serverLanguage = serverStatus?.languages.find((item) => item.languageCode === langCode)
    if (serverLanguage?.youtubeVideoId || serverLanguage?.youtubeUploadStatus === 'uploaded') {
      setYouTubeUploadState(langCode, {
        status: 'done',
        progress: 100,
        videoId: serverLanguage.youtubeVideoId || undefined,
      })
      return
    }
    if (serverLanguage?.youtubeUploadStatus === 'uploading') {
      setYouTubeUploadState(langCode, { status: 'uploading', progress: 10 })
      return
    }

    setYouTubeUploadState(langCode, { status: 'uploading', progress: 10 })

    try {
      const result = await dbMutationStrict<{
        status: string
        queueId?: number
        youtubeVideoId?: string | null
        error?: string
      }>({
        type: 'queueJobLanguageYouTubeUpload',
        payload: { jobId: dbJobId, langCode, processNow },
      })
      if (result.status === 'already_uploaded' || result.status === 'uploaded') {
        setYouTubeUploadState(langCode, {
          status: 'done',
          progress: 100,
          videoId: result.youtubeVideoId || undefined,
        })
        return
      }
      if (result.status === 'failed') {
        throw new Error(result.error || t('features.dubbing.components.steps.uploadStep.couldNotCompleteTheYouTubeUploadPleaseTry'))
      }
      if (result.status === 'queued' || result.status === 'already_queued' || result.status === 'already_uploading') {
        setYouTubeUploadState(langCode, { status: 'uploading', progress: 10 })
      } else {
        throw new Error(result.status || t('features.dubbing.components.steps.uploadStep.couldNotScheduleTheYouTubeUploadPleaseTry'))
      }

    } catch (err) {
      console.warn('[sub2tube] YouTube upload scheduling failed', err)
      const msg = t('features.dubbing.components.steps.uploadStep.couldNotScheduleTheYouTubeUploadPleaseTry')
      setYouTubeUploadState(langCode, { status: 'error', progress: 0, error: msg })
      addToast({ type: 'error', title: t('features.dubbing.components.steps.uploadStep.valueUploadSchedulingFailed', { getDisplayLanguageNameLangCode: getDisplayLanguageName(langCode) }), message: msg })
    }
  }, [addToast, dbJobId, isAuthenticated, setYouTubeUploadState, getDisplayLanguageName, syncServerUploadStatus, t])

  // ─── Queue upload (background — survives tab close) ─────────────────
  const queueYouTubeUpload = useCallback(async (langCode: string) => {
    await handleYouTubeUpload(langCode, false)
  }, [handleYouTubeUpload])

  const completedLangs = useMemo(() => selectedLanguages.filter((code) => {
    const lp = languageProgress.find((p) => p.langCode === code)
    return lp?.progressReason === 'COMPLETED' || lp?.progressReason === 'Completed'
  }), [languageProgress, selectedLanguages])

  const failedLangs = useMemo(() => selectedLanguages.filter((code) => {
    const lp = languageProgress.find((p) => p.langCode === code)
    return lp?.progressReason === 'FAILED' || lp?.progressReason === 'Failed' || lp?.progressReason === 'CANCELED'
  }), [languageProgress, selectedLanguages])

  const anyUploading = Object.values(ytUploads).some((s) => s.status === 'uploading')
  const hasPendingYouTubeUploads = completedLangs.some((code) => !isYouTubeUploadLocked(ytUploads[code]))
  const hasAutoUploadCandidates = completedLangs.some((code) => !ytUploads[code])
  const hasYouTubeUploadFailures = completedLangs.some((code) => ytUploads[code]?.status === 'error')
  const showBulkYouTubeUploadActions = !autoUpload || hasYouTubeUploadFailures

  const handleUploadAll = useCallback(async () => {
    const pending = completedLangs.filter((code) => !isYouTubeUploadLocked(ytUploads[code]))
    const CONCURRENCY = 2
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map((code) => handleYouTubeUpload(code)))
    }
  }, [completedLangs, ytUploads, handleYouTubeUpload])

  const persistOriginalCaptionUpload = useCallback(async (targetVideoId: string, langCode: string) => {
    if (deliverableMode === 'downloadOnly' || !dbJobId) return

    if (deliverableMode === 'originalWithMultiAudio') {
      await dbMutationStrict({
        type: 'updateJobLanguageYouTube',
        payload: {
          jobId: dbJobId,
          langCode,
          youtubeVideoId: targetVideoId,
        },
      })
    }

    try {
      await dbMutationStrict({
        type: 'recordJobLanguageCaptionUpload',
        payload: {
          jobId: dbJobId,
          langCode,
          youtubeVideoId: targetVideoId,
          title: settingsTitle?.trim() || videoMetaTitle || t('features.dubbing.components.steps.uploadStep.untitled'),
          languageCode: langCode,
          privacyStatus: uploadPrivacyStatus,
          isShort,
          uploadKind: videoSourceType === 'channel'
            ? 'my_video_original_captions'
            : 'new_video_original_captions',
        },
      })
    } catch (err) {
      console.warn('[sub2tube] Could not record caption upload', err)
    }
  }, [
    dbJobId,
    deliverableMode,
    isShort,
    uploadPrivacyStatus,
    settingsTitle,
    t,
    videoMetaTitle,
    videoSourceType,
  ])

  // ─── Caption upload to YouTube ───────────────────────────────────────
  const uploadCaptions = useCallback(async (targetVideoId: string, langs: string[]) => {
    const serverStatus = await syncServerUploadStatus()
    const alreadyUploadedCaptionLangs = new Set(
      (serverStatus?.languages ?? [])
        .filter((item) =>
          item.originalCaptionUploaded ||
          (deliverableMode === 'originalWithMultiAudio' && Boolean(item.youtubeVideoId || item.youtubeUploadStatus === 'uploaded')),
        )
        .map((item) => item.languageCode),
    )

    for (const langCode of langs) {
      const lang = getLanguageByCode(langCode)
      if (!lang) continue
      const pSeq = projectMap[langCode]
      if (!pSeq || !spaceSeq) continue

      if (alreadyUploadedCaptionLangs.has(langCode)) {
        setCaptionUploads((prev) => ({ ...prev, [langCode]: 'done' }))
        continue
      }

      setCaptionUploads((prev) => ({ ...prev, [langCode]: 'uploading' }))
      try {
        const srtContent = await getTranslatedSrt(pSeq, spaceSeq, 'translated')
        if (srtContent.trim().length === 0) {
          setCaptionUploads((prev) => ({ ...prev, [langCode]: 'error' }))
          continue
        }
        await ytUploadCaption({
          videoId: targetVideoId,
          language: toBcp47(langCode),
          name: resolveCaptionTrackName(toBcp47(langCode), lang.name),
          srtContent,
        })
        await persistOriginalCaptionUpload(targetVideoId, langCode)
        setCaptionUploads((prev) => ({ ...prev, [langCode]: 'done' }))
      } catch (err) {
        console.warn('[sub2tube] Caption upload failed', err)
        setCaptionUploads((prev) => ({ ...prev, [langCode]: 'error' }))
        const msg = t('features.dubbing.components.steps.uploadStep.couldNotCompleteTheCaptionUploadPleaseTry')
        addToast({ type: 'error', title: t('features.dubbing.components.steps.uploadStep.valueCaptionUploadFailed', { getDisplayLanguageNameLangCode: getDisplayLanguageName(langCode) }), message: msg })
      }
    }
  }, [deliverableMode, projectMap, spaceSeq, persistOriginalCaptionUpload, addToast, getDisplayLanguageName, syncServerUploadStatus, t])

  const uploadCaptionsWithMetadata = useCallback(async (targetVideoId: string, langs: string[]) => {
    if (deliverableMode === 'originalWithMultiAudio' && videoSource?.type === 'channel') {
      await applyMetadataToExistingVideo(targetVideoId)
    }
    await uploadCaptions(targetVideoId, langs)
  }, [applyMetadataToExistingVideo, deliverableMode, uploadCaptions, videoSource?.type])

  const handleUploadCaptionsToVideo = useCallback(async (targetVideoId: string) => {
    const pending = completedLangs.filter((code) => captionUploads[code] !== 'done')
    await uploadCaptionsWithMetadata(targetVideoId, pending)
  }, [completedLangs, captionUploads, uploadCaptionsWithMetadata])

  // ─── Auto-chain: originalWithMultiAudio ──────────────────────────────
  // 1. Upload original (if file upload) → 2. Auto-upload captions → 3. Extension for audio tracks
  useEffect(() => {
    if (deliverableMode !== 'originalWithMultiAudio') return
    if (!autoUpload || !isAuthenticated) return
    if (!uploadReviewConfirmed) return
    if (!serverUploadStatusLoaded) return
    if (completedLangs.length === 0) return
    if (autoChainTriggered.current) return
    autoChainTriggered.current = true

    const chain = async () => {
      let targetVideoId: string | undefined | null

      if (videoSource?.type === 'channel' && channelVideoId) {
        targetVideoId = channelVideoId
      } else if (videoSource?.type === 'upload' && originalVideoUrl) {
        targetVideoId = await uploadOriginalToYouTube()
      }

      if (targetVideoId && videoSource?.type === 'channel') {
        await applyMetadataToExistingVideo(targetVideoId)
      }

      if (targetVideoId && shouldUploadCaptions) {
        await uploadCaptionsWithMetadata(targetVideoId, completedLangs)
      }
    }

    chain()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliverableMode, autoUpload, isAuthenticated, uploadReviewConfirmed, serverUploadStatusLoaded, completedLangs.length])

  // ─── Auto-upload: newDubbedVideos ────────────────────────────────────
  useEffect(() => {
    if (deliverableMode !== 'newDubbedVideos') return
    if (!uploadReviewConfirmed) return
    if (!serverUploadStatusLoaded) return
    if (autoUpload && isAuthenticated && hasAutoUploadCandidates && !anyUploading) {
      handleUploadAll()
    }
  }, [deliverableMode, autoUpload, isAuthenticated, uploadReviewConfirmed, serverUploadStatusLoaded, hasAutoUploadCandidates, anyUploading, handleUploadAll])

  useEffect(() => {
    if (!dbJobId || !anyUploading) return

    let cancelled = false

    const syncUploadStatus = async () => {
      if (!cancelled) await syncServerUploadStatus()
    }

    syncUploadStatus()
    const interval = window.setInterval(syncUploadStatus, 5_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [anyUploading, dbJobId, syncServerUploadStatus])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ─── originalWithMultiAudio: Original upload + extension auto ─── */}
      {deliverableMode === 'originalWithMultiAudio' && completedLangs.length > 0 && (
        <>
          {/* Original upload status (file upload only) */}
          {videoSource?.type === 'upload' && (
            <Card>
              <CardTitle>{t('features.dubbing.components.steps.uploadStep.originalVideoYouTubeUpload')}</CardTitle>
              <div className="mt-3">
                {originalUploadState.status === 'idle' && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-ink-500 dark:text-ink-200">
                      {t('features.dubbing.components.steps.uploadStep.afterTheOriginalVideoIsUploadedToYouTube')}
                    </p>
                    <Button
                      size="sm"
                      onClick={uploadOriginalToYouTube}
                      disabled={!isAuthenticated}
                    >
                      <Upload className="h-4 w-4" />
                      {t('features.dubbing.components.steps.uploadStep.uploadOriginal')}
                    </Button>
                  </div>
                )}
                {originalUploadState.status === 'uploading' && (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-clay-500" />
                    <p className="text-sm text-ink-500 dark:text-paper-400">{t('features.dubbing.components.steps.uploadStep.uploadingOriginalVideo')}</p>
                  </div>
                )}
                {originalUploadState.status === 'done' && originalUploadState.videoId && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-emerald-500" />
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        {t('features.dubbing.components.steps.uploadStep.uploaded')} - <a
                          href={`https://youtube.com/watch?v=${originalUploadState.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >{t('features.dubbing.components.steps.uploadStep.viewVideo')}</a>
                      </p>
                    </div>
                    <Badge variant="success">{t('features.dubbing.components.steps.uploadStep.done')}</Badge>
                  </div>
                )}
                {originalUploadState.error && (
                  <p className="text-xs text-red-500 mt-1">{originalUploadState.error}</p>
                )}
              </div>
            </Card>
          )}

          {/* Channel source — already on YouTube */}
          {videoSource?.type === 'channel' && channelVideoId && (
            <Card>
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-500" />
                <p className="text-sm text-ink-600 dark:text-ink-200">
                  {t('features.dubbing.components.steps.uploadStep.translatedCaptionsWillBeAddedToTheExisting')}
                </p>
                <a
                  href={`https://youtube.com/watch?v=${channelVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-clay-500 underline"
                >
                  {t('features.dubbing.components.steps.uploadStep.viewVideo2')}
                </a>
              </div>
            </Card>
          )}

          {/* Caption auto-upload */}
          {multiAudioVideoId && (
            <Card className="border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between mb-4">
                <CardTitle>{t('features.dubbing.components.steps.uploadStep.uploadCaptionsSRT')}</CardTitle>
                {isAuthenticated ? (
                  <Badge variant="success">{t('features.dubbing.components.steps.uploadStep.connected')}</Badge>
                ) : (
                  <Badge variant="warning">{t('features.dubbing.components.steps.uploadStep.signInRequired')}</Badge>
                )}
              </div>
              <p className="mb-4 text-sm text-ink-500 dark:text-ink-200">
                {t('features.dubbing.components.steps.uploadStep.uploadTranslatedCaptionsToTheOriginalVideo')}
              </p>
              <div className="space-y-2">
                {completedLangs.map((code) => {
                  const lang = getLanguageByCode(code)
                  if (!lang) return null
                  const status = captionUploads[code]
                  return (
                    <div key={code} className="flex items-center justify-between rounded-lg border border-paper-200 p-3 dark:border-paper-800">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">{lang.flag}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{getDisplayLanguageName(code)}</p>
                          {status === 'uploading' && <p className="text-xs text-clay-500">{t('features.dubbing.components.steps.uploadStep.uploading')}</p>}
                          {status === 'done' && <p className="text-xs text-emerald-600">{t('features.dubbing.components.steps.uploadStep.captionsUploaded')}</p>}
                          {status === 'error' && <p className="text-xs text-red-500">{t('features.dubbing.components.steps.uploadStep.uploadFailed')}</p>}
                        </div>
                      </div>
                      {status === 'done' ? (
                        <Badge variant="success">{t('features.dubbing.components.steps.uploadStep.done2')}</Badge>
                      ) : status === 'uploading' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-clay-500" />
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => uploadCaptionsWithMetadata(multiAudioVideoId, [code])}
                          disabled={!isAuthenticated}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {status === 'error' ? t('features.dubbing.components.steps.uploadStep.retry') : t('features.dubbing.components.steps.uploadStep.upload')}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
              {completedLangs.length > 1 && (
                <Button
                  className="mt-3 w-full"
                  variant="secondary"
                  onClick={() => handleUploadCaptionsToVideo(multiAudioVideoId)}
                  disabled={!isAuthenticated || completedLangs.every((c) => captionUploads[c] === 'done')}
                >
                  <Upload className="h-4 w-4" />
                  {t('features.dubbing.components.steps.uploadStep.uploadAllCaptions')}
                </Button>
              )}
            </Card>
          )}

        </>
      )}

      {/* ─── Audio preview for manual mode ─── */}
      {!autoUpload && completedLangs.length > 0 && (
        <Card>
          <CardTitle>{t('features.dubbing.components.steps.uploadStep.reviewDubbedAudio')}</CardTitle>
          <p className="mb-4 mt-1 text-xs text-ink-500 dark:text-ink-200">
            {t('features.dubbing.components.steps.uploadStep.reviewTheDubbedAudioBeforeUploading')}
          </p>
          <div className="space-y-3">
            {completedLangs.map((code) => {
              const lang = getLanguageByCode(code)
              const lp = languageProgress.find((p) => p.langCode === code)
              if (!lang || !lp?.audioUrl) return null
              return (
                <div key={code} className="flex items-center gap-3 rounded-lg border border-paper-200 p-3 dark:border-paper-800">
                  <span className="text-lg">{lang.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-50 mb-1">{getDisplayLanguageName(code)}</p>
                    <audio controls preload="none" className="w-full h-8" src={lp.audioUrl}>
                      <track kind="captions" />
                    </audio>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ─── newDubbedVideos: YouTube Auto Upload ─── */}
      {deliverableMode === 'newDubbedVideos' && (
        <Card className="border-clay-200 dark:border-clay-800">
          <div className="flex items-center justify-between mb-4">
            <CardTitle>{t('features.dubbing.components.steps.uploadStep.youTubeUpload')}</CardTitle>
            {isAuthenticated ? (
              <Badge variant="success">{t('features.dubbing.components.steps.uploadStep.connected2')}</Badge>
            ) : (
              <Badge variant="warning">{t('features.dubbing.components.steps.uploadStep.googleSignInRequired')}</Badge>
            )}
          </div>

          {isAuthenticated ? (
            <>
              <p className="mb-4 text-sm text-ink-500 dark:text-ink-200">
                {t('features.dubbing.components.steps.uploadStep.uploadEachLanguageAsANewDubbedYouTube')}
              </p>

              <div className="space-y-2">
                {completedLangs.map((code) => {
                  const lang = getLanguageByCode(code)
                  if (!lang) return null
                  const state = ytUploads[code]

                  return (
                    <div
                      key={code}
                      className="flex flex-col gap-3 rounded-lg border border-paper-200 p-3 dark:border-paper-800 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">{lang.flag}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{getDisplayLanguageName(code)}</p>
                          {state?.status === 'uploading' && (
                            <Progress value={state.progress} size="sm" className="mt-1 w-32" />
                          )}
                          {state?.status === 'done' && state.videoId && (
                            <p className="text-xs text-emerald-600">
                              {t('features.dubbing.components.steps.uploadStep.uploaded2')} - <a
                                href={`https://youtube.com/watch?v=${state.videoId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >{t('features.dubbing.components.steps.uploadStep.viewVideo3')}</a>
                            </p>
                          )}
                          {state?.status === 'error' && (
                            <p className="text-xs text-red-500">{state.error}</p>
                          )}
                        </div>
                      </div>

                      {state?.status === 'done' ? (
                        <Badge variant="success">{t('features.dubbing.components.steps.uploadStep.uploaded3')}</Badge>
                      ) : state?.status === 'uploading' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-clay-500" />
                      ) : (
                        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-w-0 justify-center"
                            onClick={() => handleYouTubeUpload(code)}
                            disabled={anyUploading || isYouTubeUploadLocked(state)}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {t('features.dubbing.components.steps.uploadStep.uploadNow')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-w-0 justify-center"
                            onClick={() => queueYouTubeUpload(code)}
                            disabled={anyUploading || isYouTubeUploadLocked(state)}
                          >
                            {t('features.dubbing.components.steps.uploadStep.uploadLater')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {completedLangs.length > 1 && showBulkYouTubeUploadActions && (
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <Button
                    className="min-w-0 justify-center"
                    onClick={handleUploadAll}
                    disabled={anyUploading || !hasPendingYouTubeUploads}
                    loading={anyUploading}
                  >
                    <Upload className="h-4 w-4" />
                    {t('features.dubbing.components.steps.uploadStep.uploadAllNow')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-500 dark:text-ink-200">
              {t('features.dubbing.components.steps.uploadStep.signInToYouTubeToUploadDubbedVideos')}
            </p>
          )}
        </Card>
      )}

      {/* ─── Caption upload to original video (URL source) ─── */}
      {deliverableMode === 'newDubbedVideos' && originalYouTubeId && completedLangs.length > 0 && isAuthenticated && (
        <Card>
          <CardTitle>{t('features.dubbing.components.steps.uploadStep.addCaptionsToOriginalVideo')}</CardTitle>
          <p className="mb-4 mt-1 text-sm text-ink-500 dark:text-ink-200">
            {t('features.dubbing.components.steps.uploadStep.uploadTranslatedCaptionsSRTToTheOriginalYouTube')}
          </p>
          <div className="space-y-2">
            {completedLangs.map((code) => {
              const lang = getLanguageByCode(code)
              if (!lang) return null
              const status = captionUploads[code]
              return (
                <div key={code} className="flex flex-col gap-3 rounded-lg border border-paper-200 p-3 dark:border-paper-800 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{lang.flag}</span>
                    <div>
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{getDisplayLanguageName(code)}</p>
                      {status === 'done' && <p className="text-xs text-emerald-600">{t('features.dubbing.components.steps.uploadStep.captionsUploaded2')}</p>}
                      {status === 'error' && <p className="text-xs text-red-500">{t('features.dubbing.components.steps.uploadStep.uploadFailed2')}</p>}
                    </div>
                  </div>
                  {status === 'done' ? (
                    <Badge variant="success">{t('features.dubbing.components.steps.uploadStep.done3')}</Badge>
                  ) : status === 'uploading' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-clay-500" />
                  ) : (
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => uploadCaptions(originalYouTubeId, [code])}>
                      <Upload className="h-3.5 w-3.5" />
                      {t('features.dubbing.components.steps.uploadStep.uploadCaptions')}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ─── Download section ─── */}
      {completedLangs.length > 0 && (
        <Card>
          <CardTitle>{t('features.dubbing.components.steps.uploadStep.downloadDubbingFiles')}</CardTitle>
          <div className="mt-4 space-y-2">
            {completedLangs.map((code) => {
              const lang = getLanguageByCode(code)
              if (!lang) return null

              return (
                <div
                  key={code}
                  className="flex flex-col gap-3 rounded-lg border border-paper-200 p-3 dark:border-paper-800 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{lang.flag}</span>
                    <div>
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{getDisplayLanguageName(code)}</p>
                      <p className="text-xs text-ink-500 dark:text-ink-200">
                        {deliverableMode === 'originalWithMultiAudio'
                          ? t('features.dubbing.components.steps.uploadStep.audioCaptions')
                          : t('features.dubbing.components.steps.uploadStep.videoAudioCaptions')}
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'grid min-w-0 grid-cols-1 gap-2 sm:ml-auto',
                      deliverableMode === 'originalWithMultiAudio' ? 'sm:grid-cols-2' : 'sm:grid-cols-3',
                    )}
                  >
                    {deliverableMode !== 'originalWithMultiAudio' && (
                      <Button variant="outline" size="sm" className="min-w-0 justify-center" onClick={() => handleDownload(code, 'video')}
                        loading={loadingDownload === `${code}-video`}>
                        <Download className="h-3.5 w-3.5" /> {t('features.dubbing.components.steps.uploadStep.video')}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="min-w-0 justify-center" onClick={() => handleDownload(code, 'voiceAudio')}
                      loading={loadingDownload === `${code}-voiceAudio`}>
                      <Download className="h-3.5 w-3.5" /> {t('features.dubbing.components.steps.uploadStep.audio')}
                    </Button>
                    <Button variant="outline" size="sm" className="min-w-0 justify-center" onClick={() => handleDownload(code, 'translatedSubtitle')}
                      loading={loadingDownload === `${code}-translatedSubtitle`}>
                      <Download className="h-3.5 w-3.5" /> {t('features.dubbing.components.steps.uploadStep.captions2')}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ─── Failed languages ─── */}
      {failedLangs.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardTitle>{t('features.dubbing.components.steps.uploadStep.failedLanguages')}</CardTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {failedLangs.map((code) => {
              const lang = getLanguageByCode(code)
              return lang ? <Badge key={code} variant="error">{lang.flag} {getDisplayLanguageName(code)}</Badge> : null
            })}
          </div>
          <p className="mt-2 text-xs text-ink-500 dark:text-ink-200">
            {t('features.dubbing.components.steps.uploadStep.theseLanguagesFailedYouCanTryThemAgain')}
          </p>
        </Card>
      )}

      {/* ─── Subtitle & Script editor (merged) ─── */}
      {completedLangs.length > 0 && spaceSeq && (
        <Card>
          <CardTitle>
            {t(
              allowDialogueEditingInOutput
                ? 'features.dubbing.components.steps.uploadStep.editCaptionsAndDialogue'
                : 'features.dubbing.components.steps.uploadStep.editCaptionsOnly',
            )}
          </CardTitle>
          <p className="mb-4 mt-1 text-xs text-ink-500 dark:text-ink-200">
            {t(
              allowDialogueEditingInOutput
                ? 'features.dubbing.components.steps.uploadStep.textEditsApplyToRegeneratedDubbingAudioTiming'
                : 'features.dubbing.components.steps.uploadStep.captionOnlyEditsApplyToCaptionFiles',
            )}
          </p>
          <div className="space-y-2">
            {completedLangs.map((code) => {
              const projectSeq = projectMap[code]
              if (!projectSeq) return null

              // 자막/스크립트 편집 화면에 노출할 영상은 모드에 따라 다르게 가져온다.
              // - 원본+자막 모드: 원본 영상(모든 언어 공유)
              // - 새 더빙 영상 모드: 해당 언어의 더빙 영상
              const lp = languageProgress.find((p) => p.langCode === code)
              const previewVideoUrl = deliverableMode === 'originalWithMultiAudio'
                ? originalVideoUrl
                : (lp?.dubbingVideoUrl ?? null)

              return (
                <SubtitleScriptEditor
                  key={code}
                  langCode={code}
                  projectSeq={projectSeq}
                  spaceSeq={spaceSeq}
                  allowDialogueEditing={allowDialogueEditingInOutput}
                  youtubeVideoId={ytUploads[code]?.videoId ?? null}
                  previewVideoTarget={deliverableMode === 'originalWithMultiAudio' ? 'originalVideo' : 'dubbingVideo'}
                  previewVideoUrl={previewVideoUrl}
                />
              )
            })}
          </div>
        </Card>
      )}

      {/* ─── Actions ─── */}
      <div className="flex gap-3 justify-center">
        <Button variant="secondary" onClick={handleNewDubbing}>
          <RotateCcw className="h-4 w-4" /> {t('features.dubbing.components.steps.uploadStep.newDubbing')}
        </Button>
        <Button onClick={handleGoToDashboard}>{t('features.dubbing.components.steps.uploadStep.goToDashboard')}</Button>
      </div>
    </div>
  )
}
